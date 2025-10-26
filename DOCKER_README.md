# Запуск проекта через Docker

## Быстрый старт

### 1. Настройка переменных окружения

Скопируйте файл с примером переменных окружения:

```bash
cp .env.example .env
```

Отредактируйте `.env` и заполните необходимые значения:
- `BOT_TOKEN` - токен вашего Telegram бота (получите у [@BotFather](https://t.me/BotFather))
- `NEXT_PUBLIC_BOT_USERNAME` - username вашего бота (без @)
- При необходимости измените пароли базы данных

### 2. Запуск всех сервисов

```bash
docker-compose up
```

Или в фоновом режиме:

```bash
docker-compose up -d
```

### 3. Проверка статуса

```bash
docker-compose ps
```

## Доступные сервисы

После запуска будут доступны:

- **Next.js приложение**: http://localhost:3000
- **Telegram бот**: запущен и слушает обновления
- **PostgreSQL**: localhost:5432

## Полезные команды

### Просмотр логов

```bash
# Все сервисы
docker-compose logs -f

# Конкретный сервис
docker-compose logs -f bot
docker-compose logs -f app
docker-compose logs -f postgres
```

### Остановка сервисов

```bash
docker-compose stop
```

### Перезапуск

```bash
docker-compose restart
```

### Остановка и удаление контейнеров

```bash
docker-compose down
```

### Остановка с удалением volumes (БД будет очищена!)

```bash
docker-compose down -v
```

### Пересборка образов

```bash
docker-compose build
```

### Пересборка с запуском

```bash
docker-compose up --build
```

## Работа с базой данных

### Выполнение Prisma миграций

Миграции применяются автоматически при запуске бота. Если нужно выполнить вручную:

```bash
docker-compose exec bot npx prisma migrate deploy
```

### Создание новой миграции

```bash
cd telegram-bot
npx prisma migrate dev --name your_migration_name
```

### Просмотр базы данных через Prisma Studio

```bash
docker-compose exec bot npx prisma studio
```

### Подключение к PostgreSQL

```bash
docker-compose exec postgres psql -U banya_user -d banya_db
```

## Разработка

### Режим разработки с hot-reload

Для разработки рекомендуется использовать локальный запуск без Docker:

```bash
# Запустить только PostgreSQL
docker-compose up postgres -d

# В отдельных терминалах запустить сервисы локально
cd telegram-bot && npm run dev
cd banya-check-app && npm run dev
```

### Обновление зависимостей

После изменения `package.json` нужно пересобрать образы:

```bash
docker-compose build
```

## Troubleshooting

### Проблемы с портами

Если порты заняты, измените их в `.env`:

```env
BOT_PORT=3002  # вместо 3001
```

### Проблемы с базой данных

Если база не запускается, проверьте логи:

```bash
docker-compose logs postgres
```

Попробуйте пересоздать volume:

```bash
docker-compose down -v
docker-compose up
```

### Проблемы с Prisma

Если возникают проблемы с Prisma Client:

```bash
docker-compose exec bot npx prisma generate
docker-compose restart bot
```

## Production

Для production использования:

1. Установите надежные пароли в `.env`
2. Настройте webhook для бота (вместо polling)
3. Используйте reverse proxy (nginx) перед приложениями
4. Настройте регулярные бэкапы PostgreSQL

### Пример с webhook

В `.env`:

```env
WEBHOOK_URL=https://your-domain.com
WEBHOOK_PATH=/webhook
```
