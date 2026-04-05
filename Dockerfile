ARG BUN_VERSION=1
FROM oven/bun:${BUN_VERSION} AS build

RUN apt-get update && apt-get install -y curl && curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && apt-get install -y nodejs

WORKDIR /app

COPY /scripts/run.ts ./scripts/run.ts

# Cache packages
# COPY patches patches
COPY package.json package.json
COPY bun.lock bun.lock

COPY /packages/config/package.json ./packages/config/package.json
COPY /packages/libs/package.json ./packages/libs/package.json

COPY /apps/api/package.json ./apps/api/package.json
COPY /apps/web/package.json ./apps/web/package.json
COPY /apps/extension/package.json ./apps/extension/package.json
COPY /apps/app/package.json ./apps/app/package.json
COPY ./test/package.json ./test/package.json

RUN bun install --frozen-lockfile # or `bun ci` but at least it's explicit

COPY /resources/plannings/index.ts ./resources/plannings/index.ts
COPY /apps/api ./apps/api
COPY /apps/web ./apps/web
COPY /packages/config ./packages/config
COPY /packages/libs ./packages/libs

RUN bun run lint && bun run typecheck

ENV NODE_ENV=production
RUN bun run build

COPY /resources/plannings/ /tmp/plannings/
RUN mkdir -p ./plannings && \
  cp /tmp/plannings/*.json ./plannings/
ENV PLANNINGS_LOCATION=/app/plannings

COPY /test ./test
ENV NODE_ENV=test
RUN bun run test:unit

COPY .git/HEAD /tmp/git/HEAD
COPY .git/refs /tmp/git/refs
RUN set -e; \
    head=$(cat /tmp/git/HEAD); \
    if echo "$head" | grep -q '^ref: '; then \
      ref=$(echo "$head" | sed 's/^ref: //'); \
      sha=$(cat "/tmp/git/$ref"); \
    else \
      sha="$head"; \
    fi; \
    printf '%.7s' "$sha" > /tmp/commit_sha


##########################################################
FROM cgr.dev/chainguard/glibc-dynamic:latest

WORKDIR /app

COPY --from=ghcr.io/tarampampam/microcheck:1 /bin/httpcheck /bin/httpcheck

ENV PLANNINGS_LOCATION=/app/plannings
ENV WEB_DIST_LOCATION=/app/web/dist

COPY /apps/api/drizzle.config.ts ./drizzle.config.ts
COPY /apps/api/drizzle ./drizzle

COPY --from=build /app/apps/api/server ./server
COPY --from=build /app/apps/web/dist ./web/dist/

COPY --from=build /app/plannings ./plannings

COPY --from=build /tmp/commit_sha ./commit_sha

ENV NODE_ENV=production
ENV PORT=20000

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD ["/bin/httpcheck", "http://127.0.0.1:20000/api/ping"]

CMD ["./server"]

EXPOSE $PORT
