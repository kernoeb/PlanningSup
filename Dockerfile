FROM oven/bun:1 as base
WORKDIR /usr/src/app

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lockb /temp/dev/

RUN cd /temp/dev && bun install --frozen-lockfile

# install with --production (exclude devDependencies)
RUN mkdir -p /temp/prod
COPY package.json bun.lockb /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# [optional] tests & build
ENV NODE_ENV=production

# in node_modules/decache/decache.js, replace "module.constructor._pathCache" with "module.constructor._pathCache || {}"
RUN sed -i 's/module\.constructor\._pathCache/module\.constructor\._pathCache \|\| {}/g' node_modules/decache/decache.js

RUN bun run ./resources/check-plannings-json.mjs && rm -rf ./resources

RUN bun run --bun node_modules/nuxt/bin/nuxt.js build

# copy production dependencies and source code into final image
FROM base AS release

RUN apt-get update && apt-get install -y curl

COPY --chown=node:node . ./
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app/.nuxt .nuxt
COPY --from=prerelease /usr/src/app/static static
COPY --from=prerelease /usr/src/app/package.json .

# The planning never falls, but you never know
HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD ["curl", "-H", "ignore-statistics: true", "http://localhost:3000"]

# run the app
USER bun
ENV NODE_ENV=production
ENV HOST 0.0.0.0
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "run", "--bun", "node_modules/nuxt-start/bin/nuxt-start.js", "--port", "3000"]
