# Stage 1: build + prune deps
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --include=dev --no-audit --no-fund

COPY . .

RUN npm run build
RUN npm prune --omit=dev

# Stage 2: production
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Default; can be overridden by Coolify env vars
ENV PORT=3008
EXPOSE 3008

CMD ["node", "dist/main.js"]
