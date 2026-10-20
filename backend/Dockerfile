# syntax=docker/dockerfile:1
# HospiLink backend image (multi-stage).

# ---- build: all dependencies, prisma generate, tsc
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Dummy URL: prisma.config.ts only needs DATABASE_URL to be set at generate time.
# It is used at build time only and is never used to connect.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate \
 && npm run build

# ---- tools: build stage as the unprivileged user, for one-off `prisma migrate deploy` and seeding
# (needs the prisma CLI and tsx, which are devDependencies). Used by docker-compose `tools` service.
FROM build AS tools
ENV NODE_ENV=production
RUN chown -R node:node /app
USER node

# ---- prod-deps: production dependencies only
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- runtime
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
# Generated Prisma client (prisma-client-js writes into node_modules/.prisma)
COPY --from=build --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./
USER node
EXPOSE 5000
# Migrations are NOT run automatically; see docs/DOCKER.md.
CMD ["node", "dist/server.js"]
