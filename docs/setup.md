# БаняСчет - Setup Guide

## Архитектура проекта

Проект состоит из трех основных компонентов:

1. **Telegram Bot** - Бот для создания сессий и управления участниками
2. **Next.js Web App** - Mini App для разделения счета
3. **PostgreSQL** - База данных

## Порты и сервисы

- **3000** - Next.js Web App
- **3002** - API сервер (HTTP REST)
- **3003** - WebSocket сервер (real-time присутствие)
- **5432** - PostgreSQL

## Установка

### 1. Telegram Bot

```bash
cd telegram-bot
npm install
```

#### Настройка окружения (.env)

```env
BOT_TOKEN=your_telegram_bot_token
DATABASE_URL=postgresql://user:password@localhost:5432/banya_check
WEB_APP_URL=https://your-ngrok-url.ngrok-free.app
```

#### Инициализация базы данных

```bash
npx prisma generate
npx prisma db push
```

#### Запуск

```bash
npm run dev
```

Бот запустит три сервиса:
- Telegram Bot (webhooks/polling)
- API сервер (порт 3002)
- WebSocket сервер (порт 3003)

### 2. Next.js Web App

```bash
cd banya-check-app
npm install
```

#### Настройка окружения (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:3002
NEXT_PUBLIC_WS_URL=ws://localhost:3003
API_URL=http://localhost:3002
```

#### Запуск

```bash
npm run dev
```

Приложение будет доступно на http://localhost:3000

### 3. Настройка Ngrok (для разработки)

```bash
ngrok http 3000
```

Скопируйте URL (например, https://abc123.ngrok-free.app) и обновите:
1. `telegram-bot/.env` → `WEB_APP_URL`
2. Настройки бота в BotFather → Menu Button





## Работа с Telegram Bot

### Команды бота

- `/start` - Приветствие и справка
- `/help` - Помощь по использованию
- `/newbanya` - Создать новый поход в баню

### Процесс создания сессии

1. Админ чата вызывает `/newbanya`
2. Бот запрашивает название бани
3. Бот запрашивает дату
4. Бот запрашивает время
5. Бот предлагает выбрать участников из чата
6. Сессия становится активной
7. Участники могут открыть Mini App через кнопку меню (≡)

## Real-time присутствие

Когда пользователь открывает Mini App:

1. **Подключение**: Клиент подключается к WebSocket серверу (ws://localhost:3003)
2. **Join**: Отправляет событие `join` с userId и sessionId
3. **Broadcast**: Сервер уведомляет всех участников сессии
4. **UI Update**: У всех участников появляется аватарка нового пользователя
5. **Disconnect**: При закрытии приложения аватарка исчезает

## Типичные проблемы

### WebSocket не подключается

Проверьте:
1. Запущен ли WebSocket сервер (порт 3003)
2. Правильный ли URL в `.env.local` (NEXT_PUBLIC_WS_URL)
3. Не блокирует ли firewall порт 3003

### Telegram Bot не видит участников

Участники должны написать хотя бы одно сообщение в групповой чат после добавления бота, чтобы бот их "запомнил".

### Mini App не загружается

Проверьте:
1. Запущен ли ngrok
2. Обновлен ли WEB_APP_URL в настройках бота
3. Правильно ли настроена кнопка меню в BotFather

## Development Workflow

1. Запустите PostgreSQL
2. Запустите telegram-bot: `npm run dev`
3. Запустите banya-check-app: `npm run dev`
4. Запустите ngrok: `ngrok http 3000`
5. Обновите WEB_APP_URL в telegram-bot/.env
6. Перезапустите telegram-bot

## Production Deployment

TODO: Добавить инструкции для production deployment
