# syntax=docker/dockerfile:1.7
#
# RAG Notebook — Next.js client image.
#
# Next 16 embeds `NEXT_PUBLIC_*` values into the JS bundle at build time,
# so those must arrive as build args, not runtime env. Server-only vars
# (CLERK_SECRET_KEY) are read at runtime — pass them via compose env.

# --- Base ---------------------------------------------------------------
FROM node:22.13-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
# Refresh corepack — bundled versions fail on the pnpm 11 shim or on
# stale signing keys; see the note in server/Dockerfile for the details.
RUN npm install -g corepack@latest && corepack enable
WORKDIR /app

# --- Dependencies (dev + prod, needed for `next build`) -----------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-client,target=/pnpm/store \
    pnpm install --frozen-lockfile

# --- Build --------------------------------------------------------------
FROM base AS builder
# Build-time public env — must be present before `next build` so the
# values are inlined into the client bundle. Placeholders fail closed at
# runtime rather than baking a wrong URL into production.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_CONTRACT_VERSION
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
# `CLERK_SECRET_KEY` is server-only at runtime but the app's env schema
# is parsed eagerly, so `next build` reads it during page prerender.
# The build never calls Clerk, so a dummy satisfies the schema here and the
# real key is supplied to the runner at run time.
ARG CLERK_SECRET_KEY=sk_test_build_time_placeholder
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_CONTRACT_VERSION=${NEXT_PUBLIC_CONTRACT_VERSION} \
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY} \
    CLERK_SECRET_KEY=${CLERK_SECRET_KEY}

# `NEXT_PUBLIC_*` values are inlined into the client bundle, so a missing one
# would bake a broken image instead of failing. Check before spending a build.
RUN for v in NEXT_PUBLIC_API_URL NEXT_PUBLIC_APP_URL \
             NEXT_PUBLIC_CONTRACT_VERSION NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY; do \
      if [ -z "$(eval echo \$$v)" ]; then \
        echo "Missing build arg: $v — pass it with --build-arg $v=..."; exit 1; \
      fi; \
    done

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# --- Production dependencies only ---------------------------------------
FROM base AS prod-deps
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-client,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod

# --- Runner -------------------------------------------------------------
FROM node:22.13-bookworm-slim AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder  --chown=node:node /app/.next         ./.next
COPY --from=builder  --chown=node:node /app/package.json  ./package.json
COPY --from=builder  --chown=node:node /app/next.config.mjs ./next.config.mjs
# `public/` is optional in Next 16; the repo has no static assets today.
# Add this back if a `client/public/` directory appears later:
#   COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
