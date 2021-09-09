FROM node:16.9.0

# Create app directory
WORKDIR /app
ADD . /app/

# Use yarn berry v3 because we're in the future
RUN yarn set version berry && yarn set version berry

# Build the project
RUN yarn
RUN yarn build

# Add environment variables
ENV HOST 0.0.0.0
ENV NODE_ENV production
ENV NPM_CONFIG_PRODUCTION false

EXPOSE 3000

# Start command
CMD [ "yarn", "start" ]
