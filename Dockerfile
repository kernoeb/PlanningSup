##################################################
FROM node:22.18.0-alpine3.22 AS node-base
LABEL maintainer="kernoeb <kernoeb@protonmail.com>"

##################################################
FROM node-base AS build-tools

RUN apk add --no-cache curl bash
RUN npm install -g clean-modules@3

##################################################
FROM build-tools AS builder

# https://github.com/hadolint/hadolint/wiki/DL4006
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

WORKDIR /home/node/build
RUN chown -R node:node /home/node/build

USER node

# Only copy the files we need for the moment
COPY --chown=node:node package.json package.json
COPY --chown=node:node package-lock.json package-lock.json
COPY --chown=node:node apps/web-app/package.json apps/web-app/package.json
RUN npm ci

# Copy all files
COPY --chown=node:node apps/web-app apps/web-app

# Check JSON is valid
COPY ./scripts ./scripts
COPY resources/plannings ./resources/plannings
RUN node ./scripts/check-plannings-json.js

# Nuxt.js build
RUN npm run build -w apps/web-app

# Ensure apps/web-app/.nuxt exists
RUN test -d apps/web-app/.nuxt

# Now we remove the node_modules, as we only need production dependencies in the docker image
RUN rm -r ./node_modules/ apps/web-app/node_modules/

# Only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Remove caches
RUN rm -rf node_modules/.cache apps/web-app/node_modules/.cache

# Clean node_modules, one of the heaviest object in the universe
RUN for dir in node_modules apps/web-app/node_modules; do \
  echo "Cleaning modules in $dir..."; \
  clean-modules --directory "$dir" --yes \
  "**/*.d.ts" \
  "**/@types/**" \
  "prettier/esm/*" \
  "rxjs/src/**" \
  "rxjs/bundles/**" \
  "rxjs/_esm5/**" \
  "rxjs/_esm2015/**" \
  "!**/*.mustache"; \
  done

##################################################
FROM node-base AS app
RUN apk --no-cache add dumb-init curl bash

# Remove some useless stuff
RUN rm -rf /opt/yarn-*

# No evil root access
USER node
WORKDIR /app

COPY --chown=node:node package.json package.json
COPY --chown=node:node package-lock.json package-lock.json
COPY --chown=node:node apps/web-app apps/web-app
COPY --chown=node:node --from=builder /home/node/build/node_modules ./node_modules
COPY --chown=node:node --from=builder /home/node/build/apps/web-app/node_modules ./apps/web-app/node_modules
COPY --chown=node:node --from=builder /home/node/build/apps/web-app/.nuxt ./apps/web-app/.nuxt
COPY --chown=node:node --from=builder /home/node/build/apps/web-app/static ./apps/web-app/static

# The planning never falls, but you never know
HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD ["curl", "-H", "ignore-statistics: true", "http://localhost:3000"]

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV HOST=0.0.0.0
EXPOSE 3000

ENV PLANNINGS_DIR="/app/resources/plannings"
COPY --chown=node:node resources/plannings ./resources/plannings

CMD ["dumb-init", "npm", "run", "-w", "apps/web-app", "start", "--", "--port", "3000"]
