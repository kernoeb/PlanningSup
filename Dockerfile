FROM node:16.14.0-alpine3.15
LABEL maintainer="kernoeb <kernoeb@protonmail.com>"

RUN apk add --no-cache curl bash

# https://github.com/hadolint/hadolint/wiki/DL4006
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN curl -f https://get.pnpm.io/v6.16.js | node - add --global pnpm

ENV HOST 0.0.0.0

USER node:node
WORKDIR /home/node

ENV NUXT_VERSION=2.15.8

COPY --chown=node:node . ./
RUN chown -R node:node /home/node

RUN : \
  && pnpm install --frozen-lockfile \
  && pnpm build -- --standalone \
  && rm -rf node_modules \
  && pnpm install --frozen-lockfile --prod \
  && pnpm i "nuxt-start@${NUXT_VERSION}" \
  && pnpm i clean-modules@2.0.4 \
  && node_modules/clean-modules/bin/cli.js --yes \
  && pnpm remove clean-modules \
  && :

ENV NODE_ENV production

EXPOSE 3000
ENTRYPOINT ["npx", "nuxt-start", "-p", "3000"]
