FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY client/package.json ./client/

RUN pnpm install --filter client

COPY client ./client

EXPOSE 5173

CMD ["pnpm", "--filter", "client", "dev", "--", "--host"]
