FROM node:16.13.2-alpine
MAINTAINER "kernoeb@protonmail.com"

# Add environment variables
ENV HOST 0.0.0.0
ENV NODE_ENV production
ENV NPM_CONFIG_PRODUCTION false

# Create app directory
WORKDIR /app

ADD LICENSE .
ADD .yarnrc.yml .
ADD package.json .
ADD yarn.lock .
ADD .yarn .yarn

# UI files
ADD nuxt.config.js .
ADD pages pages
ADD assets assets
ADD components components
ADD config config
ADD layouts layouts
ADD middleware middleware
ADD plugins plugins
ADD static static

# Server files
ADD server server

RUN yarn && yarn build && \
    apk --no-cache add curl && \
    curl -sf https://gobinaries.com/tj/node-prune | sh && node-prune

EXPOSE 3000

# Start command
CMD ["node", "--max-old-space-size=2048", "node_modules/nuxt/bin/nuxt.js", "start"]
