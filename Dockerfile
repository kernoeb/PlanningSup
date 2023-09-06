FROM node:16.20.2-alpine3.18 as build-tools
LABEL maintainer="kernoeb <kernoeb@protonmail.com>"

RUN apk add --no-cache curl bash

# For ARM / Macbook M1 Pro
RUN apk add --no-cache python3 python3-dev py3-pip libcurl build-base curl-dev

RUN npm install -g pnpm@7 clean-modules@2.0.6

FROM build-tools as builder
LABEL maintainer="kernoeb <kernoeb@protonmail.com>"

# https://github.com/hadolint/hadolint/wiki/DL4006
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

WORKDIR /home/node/build
RUN chown -R node:node /home/node/build

USER node

# Only copy the files we need for the moment
COPY --chown=node:node pnpm-lock.yaml .npmrc ./
RUN pnpm fetch

# Copy all files
COPY --chown=node:node . ./

# Check JSON is valid
RUN node ./resources/check-plannings-json && rm -rf ./resources

# Install dependencies
RUN pnpm install --offline

# Nuxt.js build
RUN pnpm build --standalone

# Now we remove the node_modules, as we only need production dependencies in the docker image
RUN rm -rf ./node_modules/

# Only production dependencies
RUN pnpm fetch --prod
RUN pnpm install --prod --offline

# This ensure the file exists, ls will exit with an error if it doesn't
RUN ls node_modules/node-libcurl/lib/binding/

# Clean node_modules, one of the heaviest object in the universe
RUN clean-modules --yes --exclude "**/*.mustache"

FROM node:16.20.2-alpine3.18 as app

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
