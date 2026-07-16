# Multi-stage production build for the Next.js shell in a monorepo.
# All workspace packages export directly from TypeScript source — no pre-build needed.

# ── Stage 1: Install dependencies ──────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy root workspace manifests
COPY package.json package-lock.json ./
COPY tsconfig.base.json tsconfig.json ./

# Copy package.json files for all workspace members so npm ci can
# resolve the workspace graph without copying all source yet.
COPY apps/shell/package.json               ./apps/shell/
COPY apps/mfe-case-study/package.json      ./apps/mfe-case-study/
COPY apps/mfe-dashboard/package.json       ./apps/mfe-dashboard/
COPY apps/mfe-engineering-office/package.json ./apps/mfe-engineering-office/
COPY apps/mfe-evaluator/package.json       ./apps/mfe-evaluator/
COPY apps/mfe-failures/package.json        ./apps/mfe-failures/
COPY apps/mfe-financial/package.json       ./apps/mfe-financial/
COPY apps/mfe-keys/package.json            ./apps/mfe-keys/
COPY apps/mfe-kpi/package.json             ./apps/mfe-kpi/
COPY apps/mfe-settings/package.json        ./apps/mfe-settings/
COPY apps/mfe-survey/package.json          ./apps/mfe-survey/
COPY apps/mfe-valuation/package.json       ./apps/mfe-valuation/
COPY packages/api-client/package.json      ./packages/api-client/
COPY packages/app-shared/package.json      ./packages/app-shared/
COPY packages/auth-client/package.json     ./packages/auth-client/
COPY packages/design-system/package.json   ./packages/design-system/
COPY packages/types/package.json           ./packages/types/

RUN npm ci

# ── Stage 2: Build ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Reuse installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy workspace manifests + tsconfig
COPY package.json package-lock.json ./
COPY tsconfig.base.json tsconfig.json ./
COPY apps/tsconfig.mfe-paths.json ./apps/

# Copy full source of every workspace package.
# These packages export directly from ./src (TypeScript), so Next.js
# transpilePackages compiles them at build time — no separate build step needed.
COPY packages/api-client/    ./packages/api-client/
COPY packages/app-shared/    ./packages/app-shared/
COPY packages/auth-client/   ./packages/auth-client/
COPY packages/design-system/ ./packages/design-system/
COPY packages/types/         ./packages/types/

# Copy all MFE apps (the shell depends on them as workspace packages)
COPY apps/mfe-case-study/      ./apps/mfe-case-study/
COPY apps/mfe-dashboard/       ./apps/mfe-dashboard/
COPY apps/mfe-engineering-office/ ./apps/mfe-engineering-office/
COPY apps/mfe-evaluator/       ./apps/mfe-evaluator/
COPY apps/mfe-failures/        ./apps/mfe-failures/
COPY apps/mfe-financial/       ./apps/mfe-financial/
COPY apps/mfe-keys/            ./apps/mfe-keys/
COPY apps/mfe-kpi/             ./apps/mfe-kpi/
COPY apps/mfe-settings/        ./apps/mfe-settings/
COPY apps/mfe-survey/          ./apps/mfe-survey/
COPY apps/mfe-valuation/       ./apps/mfe-valuation/

# Copy the shell app itself
COPY apps/shell/ ./apps/shell/

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build -w @platform/shell

# ── Stage 3: Production runner ──────────────────────────────────────────────────
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

# Copy only the minimal files needed to run Next.js in production
COPY --from=builder /app/apps/shell/public             ./apps/shell/public
COPY --from=builder /app/apps/shell/.next/standalone   ./
COPY --from=builder /app/apps/shell/.next/static       ./apps/shell/.next/static

# The standalone output includes a minimal server.js at the repo root
CMD ["node", "apps/shell/server.js"]
