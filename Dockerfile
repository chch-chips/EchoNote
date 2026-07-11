# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS deps
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM deps AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://echo_note_ci_user:ci-placeholder@127.0.0.1:5432/echo_note_ci?schema=public"
ENV APP_PASSWORD="ci-placeholder"
ENV SESSION_SECRET="ci-placeholder-session-secret"
ENV CAPTURE_TOKEN="ci-placeholder-capture-token"
ENV DEEPSEEK_API_KEY=""

COPY . .

RUN npm run db:generate \
  && npm run build:worker \
  && npm run build

# This target is used only as a short-lived Prisma migration job. Keeping it
# separate prevents build tools and the Prisma CLI from entering the app image.
FROM deps AS migrate
WORKDIR /app

ENV NODE_ENV=production

# Prisma's migration engine requires OpenSSL at runtime on Debian slim images.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts

CMD ["npm", "run", "db:deploy"]

FROM node:20-bookworm-slim AS runtime
WORKDIR /app

ARG VCS_REF="unknown"

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

LABEL org.opencontainers.image.revision="$VCS_REF"

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/dist/worker/process-ai.mjs ./worker/process-ai.mjs

USER node

EXPOSE 3000

CMD ["node", "server.js"]
