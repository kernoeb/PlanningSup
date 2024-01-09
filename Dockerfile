# Node base image
FROM node:20.10.0-alpine3.19 as node-base

FROM node-base as build-tools
LABEL maintainer="kernoeb <kernoeb@protonmail.com>"

RUN apk add --no-cache curl bash

# For ARM / Macbook M1 Pro
RUN apk add --no-cache python3 python3-dev py3-pip libcurl build-base curl-dev

RUN npm install -g clean-modules@3

FROM build-tools as builder
LABEL maintainer="kernoeb <kernoeb@protonmail.com>"

# https://github.com/hadolint/hadolint/wiki/DL4006
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

WORKDIR /home/node/build
RUN chown -R node:node /home/node/build

USER node

# Only copy the files we need for the moment
COPY --chown=node:node package.json package-lock.json .npmrc ./
RUN npm ci

# Copy all files
COPY --chown=node:node . ./

# Check JSON is valid
RUN node ./resources/check-plannings-json.mjs && rm -rf ./resources

# Nuxt.js build
RUN npm run build

# Now we remove the node_modules, as we only need production dependencies in the docker image
RUN rm -rf ./node_modules/

# Only production dependencies
RUN npm prune --omit=dev && npm cache clean --force
RUN rm -rf node_modules/.cache

# Clean node_modules, one of the heaviest object in the universe
RUN clean-modules --yes "!**/*.mustache"

FROM node-base as app

RUN apk --no-cache add dumb-init curl bash

ENV NODE_ENV production
ENV HOST 0.0.0.0

# Remove some useless stuff
RUN rm -rf /usr/local/lib/node_modules/npm/ /usr/local/bin/npm /opt/yarn-*

# No evil root access
USER node
WORKDIR /app

COPY --chown=node:node . ./
COPY --chown=node:node --from=builder /home/node/build/node_modules ./node_modules
COPY --chown=node:node --from=builder /home/node/build/.nuxt ./.nuxt
COPY --chown=node:node --from=builder /home/node/build/static/ ./static/

# The planning never falls, but you never know
HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD ["curl", "-H", "ignore-statistics: true", "http://localhost:3000"]

EXPOSE 3000
CMD ["dumb-init", "node", "--max-old-space-size=2048", "node_modules/nuxt-start/bin/nuxt-start.js", "--port", "3000"]
