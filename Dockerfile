# Node base image
FROM node:22.14.0-alpine3.21 AS node-base
LABEL maintainer="kernoeb <kernoeb@protonmail.com>"

FROM node-base AS build-tools

RUN apk add --no-cache curl bash
RUN npm install -g clean-modules@3

FROM build-tools AS builder

# https://github.com/hadolint/hadolint/wiki/DL4006
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

WORKDIR /home/node/build
RUN chown -R node:node /home/node/build

USER node

# Only copy the files we need for the moment
COPY --chown=node:node apps/web-app/package.json apps/web-app/package-lock.json ./
RUN npm ci

# Copy all files
COPY --chown=node:node apps/web-app ./

# Check JSON is valid
COPY ./scripts ./scripts
COPY resources/plannings ./resources/plannings
RUN node ./scripts/check-plannings-json.js

# Nuxt.js build
RUN npm run build

# Now we remove the node_modules, as we only need production dependencies in the docker image
RUN rm -rf ./node_modules/

# Only production dependencies
RUN npm ci --omit=dev && npm cache clean --force
RUN rm -rf node_modules/.cache

# Clean node_modules, one of the heaviest object in the universe
RUN clean-modules --yes "**/*.d.ts" "**/@types/**" "prettier/esm/*" "rxjs/src/**" "rxjs/bundles/**" "rxjs/_esm5/**" "rxjs/_esm2015/**" "!**/*.mustache"

FROM node-base AS app

RUN apk --no-cache add dumb-init curl bash

# Remove some useless stuff
RUN rm -rf /usr/local/lib/node_modules/npm/ /usr/local/bin/npm /opt/yarn-*

# No evil root access
USER node
WORKDIR /app

COPY --chown=node:node apps/web-app ./
COPY --chown=node:node --from=builder /home/node/build/node_modules ./node_modules
COPY --chown=node:node --from=builder /home/node/build/.nuxt ./.nuxt
COPY --chown=node:node --from=builder /home/node/build/static/ ./static/
COPY --chown=node:node resources/plannings ./resources/plannings

# The planning never falls, but you never know
HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD ["curl", "-H", "ignore-statistics: true", "http://localhost:3000"]

ENV NODE_ENV=production
ENV HOST=0.0.0.0
EXPOSE 3000
CMD ["dumb-init", "node", "--max-old-space-size=2048", "node_modules/nuxt-start/bin/nuxt-start.js", "--port", "3000"]
