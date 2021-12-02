FROM node:16.13.1
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
# faster builds
ADD .yarn .yarn
RUN yarn

# UI files
ADD assets assets
ADD components components
ADD config config
ADD layouts layouts
ADD middleware middleware
ADD plugins plugins
ADD static static

# Server files
ADD server server

RUN yarn build

EXPOSE 3000

# Start command
CMD ["node", "--max-old-space-size", "4096", "node_modules/nuxt/bin/nuxt.js", "start"]
