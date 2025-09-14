ARG BUN_VERSION=1
FROM oven/bun:${BUN_VERSION} AS build

#RUN apt update && apt install python3 python3-pip make g++ -y

WORKDIR /app

COPY /scripts/run.ts ./scripts/run.ts

# Cache packages
COPY patches patches
COPY package.json package.json
COPY bun.lock bun.lock

COPY /packages/config/package.json ./packages/config/package.json
COPY /packages/libs/package.json ./packages/libs/package.json

COPY /apps/api/package.json ./apps/api/package.json
COPY /apps/web/package.json ./apps/web/package.json
COPY /apps/extension/package.json ./apps/extension/package.json

RUN bun install --frozen-lockfile # or `bun ci` but at least it's explicit

COPY /resources/plannings/index.ts ./resources/plannings/index.ts
COPY /apps/api ./apps/api
COPY /apps/web ./apps/web
COPY /packages/config ./packages/config
COPY /packages/libs ./packages/libs

RUN bun run lint && bun run typecheck

ENV NODE_ENV=production
RUN bun run build

##########################################################
# Copy json planning files using a simple sh image
FROM build AS copy-and-test-plannings

WORKDIR /app

COPY /resources/plannings/ /tmp/plannings/

RUN mkdir -p ./plannings && \
  cp /tmp/plannings/*.json ./plannings/

ENV PLANNINGS_LOCATION=/app/plannings

COPY /test ./test
RUN bun test test/jobs.test.ts test/plannings.routes.test.ts

##########################################################
FROM gcr.io/distroless/base-debian12

WORKDIR /app

ENV PLANNINGS_LOCATION=/app/plannings
ENV WEB_DIST_LOCATION=/app/web/dist

COPY /apps/api/drizzle.config.ts ./drizzle.config.ts
COPY /apps/api/drizzle ./drizzle

COPY --from=build /app/apps/api/server ./server
COPY --from=build /app/apps/web/dist ./web/dist/

COPY --from=copy-and-test-plannings /app/plannings ./plannings

ENV NODE_ENV=production

CMD ["./server"]

ENV PORT=20000
EXPOSE $PORT
