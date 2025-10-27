# Banya Check - Telegram Mini App

Приложение для организации походов в баню с разделением расходов.

## Быстрый старт с Docker

### Требования
- Docker и Docker Compose установлены
- Токен Telegram бота (получить у [@BotFather](https://t.me/BotFather))

### Запуск за 3 шага

1. **Настройте переменные окружения:**
```bash
make setup
# Откроется .env файл - добавьте ваш BOT_TOKEN
```

2. **Запустите все сервисы:**
```bash
make up
```

3. **Готово!** Приложение доступно:
   - 🌐 Next.js App: http://localhost:3000
   - 🤖 Telegram Bot: запущен и работает
   - 🗄️ PostgreSQL: localhost:5432

## Структура проекта

```
banya_check/
├── banya-check-app/     # Next.js приложение (Telegram Mini App)
├── telegram-bot/        # Telegram бот (Node.js + Telegraf)
├── docker-compose.yml   # Конфигурация Docker
└── docs/               # Документация
```

## Доступные команды (Makefile)

```bash
make help          # Показать все команды
make up            # Запустить все сервисы
make down          # Остановить все сервисы
make restart       # Перезапустить сервисы
make logs          # Показать все логи
make logs-bot      # Логи бота
make logs-app      # Логи приложения
make build         # Пересобрать образы
make clean         # Удалить все контейнеры и volumes
make dev           # Запустить только PostgreSQL для локальной разработки
```

## Разработка

### Локальный запуск (без Docker)

Запустить только PostgreSQL:
```bash
make dev
```

В отдельных терминалах:
```bash
# Telegram Bot
cd telegram-bot
npm install
npm run dev

# Next.js App
cd banya-check-app
npm install
npm run dev
```

### Работа с базой данных

```bash
# Применить миграции
make prisma-migrate

# Открыть Prisma Studio
make prisma-studio

# Подключиться к PostgreSQL
make db-shell
```

## Переменные окружения

### Корневой .env
```env
POSTGRES_USER=banya_user
POSTGRES_PASSWORD=banya_password
POSTGRES_DB=banya_db
BOT_TOKEN=your_bot_token_here
BOT_PORT=3001
NEXT_PUBLIC_BOT_USERNAME=your_bot_username
```

### telegram-bot/.env
```env
DATABASE_URL=postgresql://banya_user:banya_password@localhost:5432/banya_db
BOT_TOKEN=your_bot_token_here
PORT=3001
```

### banya-check-app/.env.local
```env
NEXT_PUBLIC_BOT_USERNAME=your_bot_username
```

## CI/CD

Документация по настройке автоматического деплоя будет добавлена позже.

## Архитектура

- **Frontend**: Next.js 15 + React 19 + Tailwind CSS
- **Backend**: Telegram Bot API + Node.js + Telegraf
- **Database**: PostgreSQL 16
- **ORM**: Prisma
- **Real-time**: WebSocket для синхронизации между пользователями

## Особенности

- ✅ Полная Docker-изация для быстрого развертывания
- ✅ Автоматические миграции БД при запуске
- ✅ Hot-reload для разработки
- ✅ Real-time синхронизация через WebSocket
- ✅ Telegram Mini App интеграция

## Troubleshooting

Если возникли проблемы, см. [DOCKER_README.md](./DOCKER_README.md)

## Лицензия

MIT
