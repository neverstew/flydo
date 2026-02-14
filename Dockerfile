# syntax = docker/dockerfile:1

# Adjust BUN_VERSION as desired
ARG BUN_VERSION=1.3.9
FROM oven/bun:${BUN_VERSION}-alpine AS base

LABEL fly_launch_runtime="Bun"

# Bun app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"

# Throw-away install stage to reduce size of final image
FROM base AS install
COPY package.json bun.lock .
RUN bun install --frozen-lockfile --production

# copy node_modules and all project files into the image
FROM base AS release
COPY --from=install /app/node_modules node_modules
# makes use of liberal .dockerignore
COPY . .

ENV NODE_ENV=production

USER bun
CMD []
