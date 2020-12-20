FROM node:14

# Create app directory
WORKDIR /app
ADD . /app/

RUN yarn
RUN yarn build

ENV HOST 0.0.0.0
ENV NODE_ENV production
ENV NPM_CONFIG_PRODUCTION false

EXPOSE 3000

# start command
CMD [ "yarn", "start" ]
