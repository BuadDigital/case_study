# Multi-stage build for Next.js frontend shell in monorepo
FROM node:22-alpine AS base

# Install OS dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY tsconfig.base.json tsconfig.json ./

# Copy all packages and apps package.json files to allow npm ci to bootstrap workspaces
COPY apps/shell/package.json ./apps/shell/
COPY apps/mfe-case-study/package.json ./apps/mfe-case-study/
COPY apps/mfe-dashboard/package.json ./apps/mfe-dashboard/
COPY apps/mfe-engineering-office/package.json ./apps/mfe-engineering-office/
COPY apps/mfe-evaluator/package.json ./apps/mfe-evaluator/
COPY apps/mfe-failures/package.json ./apps/mfe-failures/
COPY apps/mfe-financial/package.json ./apps/mfe-financial/
COPY apps/mfe-keys/package.json ./apps/mfe-keys/
COPY apps/mfe-kpi/package.json ./apps/mfe-kpi/
COPY apps/mfe-settings/package.json ./apps/mfe-settings/
COPY apps/mfe-survey/package.json ./apps/mfe-survey/
COPY apps/mfe-valuation/package.json ./apps/mfe-valuation/
COPY packages/app-shared/package.json ./packages/app-shared/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/auth-client/package.json ./packages/auth-client/
COPY packages/design-system/package.json ./packages/design-system/
COPY packages/types/package.json ./packages/types/

# Clean install dependencies
RUN npm ci

# Build the source code
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for production build
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the next.js project using npm workspace
RUN npm run build -w @platform/shell

# Production runner image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

# Copy necessary runtime files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/shell/package.json ./apps/shell/package.json
COPY --from=builder /app/apps/shell/.next ./apps/shell/.next
COPY --from=builder /app/apps/shell/public ./apps/shell/public
COPY --from=builder /app/apps/shell/next.config.ts ./apps/shell/next.config.ts

# Run the app
CMD ["npm", "run", "start", "-w", "@platform/shell"]
