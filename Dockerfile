FROM node:16.14.0-alpine3.15
MAINTAINER "kernoeb@protonmail.com"

RUN apk add --no-cache curl bash
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
  && :

ENV NODE_ENV production

RUN curl -sf https://gobinaries.com/tj/node-prune | PREFIX=/tmp sh && /tmp/node-prune && rm /tmp/node-prune

EXPOSE 3000
ENTRYPOINT ["npx", "nuxt-start", "-p", "3000"]
