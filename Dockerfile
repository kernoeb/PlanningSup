FROM node:16.14.0-alpine3.15 as builder
LABEL maintainer="kernoeb <kernoeb@protonmail.com>"

RUN apk add --no-cache curl bash

# https://github.com/hadolint/hadolint/wiki/DL4006
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN curl -f https://get.pnpm.io/v6.16.js | node - add --global pnpm


WORKDIR /app

ENV NUXT_VERSION=2.15.8

COPY . /app/

RUN pnpm install --frozen-lockfile \
  && pnpm build -- --standalone \
  && rm -rf node_modules \
  && pnpm install --frozen-lockfile --prod \
  && pnpm i "nuxt-start@${NUXT_VERSION}" \
  && pnpm i clean-modules@2.0.4 \
  && node_modules/clean-modules/bin/cli.js --yes --exclude "**/*.mustache" \
  && pnpm remove clean-modules


FROM node:16.14.0-alpine3.15 as app

RUN apk --no-cache add dumb-init curl bash

ENV NODE_ENV production
ENV HOST 0.0.0.0
USER node
WORKDIR /app

COPY --chown=node:node --from=builder /app/node_modules /app/node_modules
COPY --chown=node:node --from=builder /app/.nuxt /app/.nuxt
COPY --chown=node:node . /app

HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD ["/bin/bash", "-c", "curl", "-H", "ignore-statistics: true", "http://localhost:3000"]

EXPOSE 3000
CMD ["dumb-init", "node", "--max-old-space-size=2048", "node_modules/nuxt-start/bin/nuxt-start.js", "--port", "3000"]
