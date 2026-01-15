# ---------- deps ----------
FROM node:20-alpine AS deps
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm i --frozen-lockfile

# ---------- build ----------
FROM node:20-alpine AS build
WORKDIR /app

RUN apk add --no-cache python3 make g++
RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ---------- runner ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN apk add --no-cache libc6-compat

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm i --frozen-lockfile

# Copiamos sólo el build final
COPY --from=build /app/dist ./dist

EXPOSE 3000

# Ejecuta migraciones usando el data-source compilado y luego arranca la app
CMD ["sh", "-c", "pnpm migration:run && pnpm seed:run && node dist/main.js"]