# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
RUN apk add --no-cache openssl libc6-compat
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# Dev stage — used by docker-compose with `target: dev`.
# Self-contained so the container boots without a follow-up install step;
# docker-compose volumes overlay server/ for hot reload in development.
FROM base AS dev
COPY package.json pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY server/package.json ./server/
COPY server/prisma ./server/prisma
RUN pnpm install --filter server
COPY server ./server
EXPOSE 3000
CMD ["pnpm", "--filter", "server", "dev"]

# Prod build chain — used by `flyctl deploy` via fly.toml `build-target = "runtime"`.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/
COPY server/prisma ./server/prisma
RUN pnpm install --frozen-lockfile --filter server

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY server ./server
COPY tsconfig.base.json ./
RUN pnpm --filter server build
RUN pnpm --filter server deploy --prod /app/prod-server

FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY --from=build /app/prod-server/node_modules ./node_modules
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/server/prisma ./prisma
COPY --from=build /app/server/scripts ./scripts
USER node
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]
