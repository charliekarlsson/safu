# Railway-friendly Dockerfile for backend service
FROM node:20-alpine

# Enable pnpm via corepack
RUN corepack enable

WORKDIR /app

# Layer dependencies for all workspaces
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/backend/package.json packages/backend/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/frontend/package.json packages/frontend/package.json

RUN pnpm install

# Copy the full workspace
COPY . .

# Build shared + backend (frontend optional for this image)
RUN pnpm -r build

EXPOSE 8787

CMD ["pnpm", "--filter", "backend", "start"]
