# Инструкция по тестированию после распространения DNS

## Текущее состояние

Все настроено и готово к тестированию. Ожидаем распространения DNS для домена `z0y.ru`.

### Что уже сделано:

1. ✅ Создан Named Cloudflare Tunnel: `banya-tunnel` (ID: `6b7e99de-62d4-4067-bf1d-6cdb6b6b4a7c`)
2. ✅ Настроены ingress правила:
   - WebSocket: `wss://z0y.ru/ws` → `ws://localhost:3003`
   - Next.js: `https://z0y.ru` → `http://localhost:3001`
3. ✅ Обновлены все environment variables
4. ✅ Обновлена кнопка меню в Telegram боте
5. ✅ WebSocket сервер запущен на порту 3003
6. ✅ Cloudflare tunnel запущен и ожидает подключения

### Запущенные процессы:

1. **WebSocket сервер**: `npm run ws` (порт 3003)
2. **Cloudflare Tunnel**: `cloudflared tunnel --config cloudflared-config.yml --protocol http2 run`
3. **Next.js**: `npm run dev` (порт 3001)
4. **Prisma Dev**: `npx prisma dev`

## Что нужно сделать завтра, когда DNS распространится:

### 1. Проверить доступность домена

```bash
curl -I https://z0y.ru
```

Ожидаемый результат: HTTP 200 OK

### 2. Обновить Telegram webhook

```bash
curl -X POST "https://api.telegram.org/bot8338608819:AAH7OMSHIxEoXWrWOY5u6fQIYOKJQgWy9Qk/setWebhook" \
  -d "url=https://z0y.ru/telegram-webhook"
```

Ожидаемый результат: `{"ok":true,"result":true}`

### 3. Проверить Telegram webhook

```bash
curl "https://api.telegram.org/bot8338608819:AAH7OMSHIxEoXWrWOY5u6fQIYOKJQgWy9Qk/getWebhookInfo"
```

Должно показать:
- url: `https://z0y.ru/telegram-webhook`
- has_custom_certificate: false
- pending_update_count: 0

### 4. Протестировать приложение

1. Открыть Telegram бота
2. Нажать кнопку меню "Открыть БаняСчет"
3. Проверить, что приложение загружается
4. Проверить в консоли браузера (DevTools):
   - `🔌 Подключение к WebSocket: wss://z0y.ru/ws`
   - `✅ WebSocket подключен`
   - Должны появиться аватарки всех участников сессии

### 5. Проверить логи WebSocket сервера

В терминале где запущен `npm run ws` должны появиться сообщения:
```
🔌 Новое WebSocket подключение
👤 Пользователь [ID] ([NAME]) присоединился к сессии [SESSION_ID]
```

### 6. Протестировать real-time функциональность

1. Открыть приложение с двух устройств/аккаунтов
2. Проверить, что аватарки обоих пользователей появляются в режиме реального времени
3. Закрыть приложение на одном устройстве
4. Проверить, что аватарка исчезла на втором устройстве

## Файлы конфигурации

### Cloudflare Tunnel Config
`/Users/andreynosov/Documents/Projects/banya_check/telegram-bot/cloudflared-config.yml`

### Environment Variables
- Next.js: `/Users/andreynosov/Documents/Projects/banya_check/banya-check-app/.env.local`
- Telegram Bot: `/Users/andreynosov/Documents/Projects/banya_check/telegram-bot/.env`

## Команды для запуска (если процессы остановлены)

```bash
# 1. WebSocket сервер
cd /Users/andreynosov/Documents/Projects/banya_check/telegram-bot
npm run ws

# 2. Cloudflare Tunnel
cd /Users/andreynosov/Documents/Projects/banya_check/telegram-bot
cloudflared tunnel --config cloudflared-config.yml --protocol http2 run

# 3. Next.js
cd /Users/andreynosov/Documents/Projects/banya_check/banya-check-app
npm run dev

# 4. Prisma (если нужно)
cd /Users/andreynosov/Documents/Projects/banya_check/telegram-bot
npx prisma dev
```

## Возможные проблемы и решения

### Проблема: WebSocket не подключается
**Решение**: Проверить, что:
1. WebSocket сервер запущен на порту 3003
2. Cloudflare tunnel запущен и работает
3. В консоли браузера нет ошибок CORS
4. URL в `.env.local` правильный: `wss://z0y.ru/ws`

### Проблема: Tunnel не подключается к Cloudflare
**Решение**: Перезапустить tunnel:
```bash
# Найти процесс
ps aux | grep cloudflared

# Убить процесс
kill [PID]

# Запустить снова
cloudflared tunnel --config cloudflared-config.yml --protocol http2 run
```

### Проблема: Аватарки не появляются
**Решение**:
1. Проверить логи WebSocket сервера
2. Проверить консоль браузера на наличие ошибок WebSocket
3. Убедиться, что в сессии есть participants с данными
4. Проверить, что код в `app/page.tsx` использует `onlineUsers` (не `displayUsers`)

## Архитектура

```
Telegram Bot (Client)
    ↓ HTTPS
z0y.ru (Cloudflare Tunnel)
    ↓
    ├─ / → localhost:3001 (Next.js)
    │   ├─ HTTP Routes
    │   └─ Static Files
    │
    └─ /ws → localhost:3003 (WebSocket Server)
        └─ Real-time Presence
```

## Полезные команды для отладки

```bash
# Проверить DNS
nslookup z0y.ru

# Проверить WebSocket сервер локально
wscat -c ws://localhost:3003

# Проверить список tunnel
cloudflared tunnel list

# Проверить info о tunnel
cloudflared tunnel info banya-tunnel

# Посмотреть логи tunnel в реальном времени
# (он уже запущен в background, смотрите вывод в терминале)
```
