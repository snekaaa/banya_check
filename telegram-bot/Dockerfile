FROM node:20-alpine

WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY package*.json ./
RUN npm ci --only=production

# Копируем Prisma схему и генерируем клиент
COPY prisma ./prisma
RUN npx prisma generate

# Копируем остальные файлы приложения
COPY . .

# Экспонируем порт для WebSocket сервера (если используется)
EXPOSE 8080

# Команда запуска с миграциями
CMD ["sh", "-c", "npx prisma migrate deploy && node index.js"]
