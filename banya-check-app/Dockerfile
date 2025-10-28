# Stage 1: Установка зависимостей
FROM node:20-alpine AS deps
WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY package*.json ./
RUN npm ci

# Stage 2: Сборка приложения
FROM node:20-alpine AS builder
WORKDIR /app

# Принимаем build аргументы
ARG NEXT_PUBLIC_BOT_USERNAME
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL

# Устанавливаем их как переменные окружения для build
ENV NEXT_PUBLIC_BOT_USERNAME=$NEXT_PUBLIC_BOT_USERNAME
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

# Копируем зависимости из предыдущего stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Сборка Next.js приложения
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Production образ
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Создаем пользователя для безопасности
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Копируем необходимые файлы
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/server.js ./server.js

# Устанавливаем ws для WebSocket
RUN npm install ws@^8.18.0

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
