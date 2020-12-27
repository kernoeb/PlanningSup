FROM node:14.15.3

# Create app directory
WORKDIR /app
ADD . /app/

RUN yarn
RUN yarn build

# Add environment variables
ENV HOST 0.0.0.0
ENV NODE_ENV production
ENV NPM_CONFIG_PRODUCTION false

EXPOSE 3000

# Start command
CMD [ "yarn", "start" ]
