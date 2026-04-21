FROM node:22-alpine

WORKDIR /app

RUN corepack enable

# Root manifests for pnpm workspaces
COPY package.json pnpm-workspace.yaml ./
COPY tsconfig.base.json ./

# Server workspace manifest
COPY server/package.json ./server/

# Install deps for the server workspace only
RUN pnpm install --filter server

# Copy server sources and prisma schema
COPY server ./server

# Generate Prisma client against the schema
RUN pnpm --filter server exec prisma generate

EXPOSE 3000

CMD ["pnpm", "--filter", "server", "dev"]
