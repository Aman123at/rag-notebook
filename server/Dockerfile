# syntax=docker/dockerfile:1.7
#
# RAG Notebook — server image.
#
# Multi-stage: a `builder` stage compiles TypeScript with dev deps, then a
# lean `runner` stage runs `node dist/index.js` on production deps only.
# Corepack pins pnpm to the version in package.json's `packageManager`
# field, so the container build matches local dev.

# --- Base ---------------------------------------------------------------
FROM node:22.13-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NODE_ENV=production
# Refresh corepack to the current release. Older bundled versions:
#   - Node 20's crashes on the pnpm 11 shim
#     (`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`);
#   - Node 22.11's ships stale signing keys and rejects the registry
#     download (`Cannot find matching keyid`).
# `npm i -g corepack@latest` fixes both.
RUN npm install -g corepack@latest && corepack enable
WORKDIR /app

# --- Dependencies (dev + prod) ------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# --- Build --------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# --- Production dependencies only ---------------------------------------
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod

# --- Runner -------------------------------------------------------------
FROM node:22.13-bookworm-slim AS runner
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app

# Run as a non-root user — the Debian slim base ships a `node` user.
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder  --chown=node:node /app/dist          ./dist
COPY --from=builder  --chown=node:node /app/drizzle       ./drizzle
COPY --from=builder  --chown=node:node /app/package.json  ./package.json

USER node
EXPOSE 8080
CMD ["node", "dist/index.js"]
