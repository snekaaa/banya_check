# TabScanner API Integration - Инструкция

## Обзор

Интеграция TabScanner API для автоматического распознавания чеков добавлена в проект. Система обрабатывает фотографии чеков, распознает позиции с помощью OCR и позволяет редактировать результаты перед сохранением.

## Что было добавлено

### Backend (telegram-bot/)

1. **Новые зависимости**
   - `express` - HTTP сервер вместо нативного http
   - `cors` - поддержка CORS
   - `multer` - загрузка файлов
   - `form-data` - отправка файлов в TabScanner

2. **Новые файлы**
   - `tabscanner-service.js` - логика работы с TabScanner API
   - `uploads/` - папка для хранения загруженных фото чеков

3. **Обновленные файлы**
   - `api-server.js` - переписан на Express, добавлены новые эндпоинты
   - `prisma/schema.prisma` - добавлены модели Receipt и CheckItem
   - `.env.example` - добавлена переменная TABSCANNER_API_KEY

4. **Новые API эндпоинты**
   - `POST /api/receipts/upload` - загрузка фото чека
   - `GET /api/receipts/status/:token` - проверка статуса обработки
   - `POST /api/receipts/confirm` - подтверждение и сохранение позиций
   - `GET /api/sessions/:sessionId/items` - получение позиций сессии
   - `DELETE /api/items/:itemId` - удаление позиции

### Frontend (banya-check-app/)

1. **Обновленные страницы**
   - `app/upload-check/page.tsx` - новый флоу загрузки с polling

2. **Новые страницы**
   - `app/confirm-receipt/page.tsx` - страница подтверждения распознанных позиций

### Docker

1. **docker-compose.yml**
   - Добавлена переменная окружения `TABSCANNER_API_KEY`
   - Добавлен volume `receipt_uploads` для хранения фото
   - Открыт порт 3002 для API сервера

## База данных

### Новые таблицы

**Receipt** - информация о загруженных чеках
```
id          - UUID чека
sessionId   - ID сессии
filePath    - путь к сохраненному фото
status      - статус обработки (processing, completed, failed)
token       - токен TabScanner
rawData     - полный ответ от TabScanner (JSON)
createdAt   - дата создания
```

**CheckItem** - позиции чека
```
id          - UUID позиции
sessionId   - ID сессии
receiptId   - ID чека (может быть null для ручных позиций)
name        - название позиции
price       - цена
quantity    - количество
isCommon    - общая позиция (делится на всех)
createdAt   - дата создания
```

## Флоу работы

1. Пользователь загружает фото чека на странице `/upload-check`
2. Фото отправляется на backend `/api/receipts/upload`
3. Backend сохраняет файл и отправляет в TabScanner
4. Frontend начинает polling статуса каждую секунду
5. Когда распознавание завершено (5-15 секунд), пользователь переходит на `/confirm-receipt`
6. На странице подтверждения можно:
   - Редактировать название, цену, количество каждой позиции
   - Удалять позиции
   - Добавлять новые позиции вручную
   - Отмечать позиции как "общие"
7. После подтверждения позиции сохраняются в базу данных

## Запуск

### Локальная разработка

1. **Создайте .env файл в telegram-bot/**
```bash
cd telegram-bot
cat > .env << EOF
DATABASE_URL=postgresql://banya_user:banya_password@localhost:5432/banya_db
BOT_TOKEN=ваш_токен_бота
TABSCANNER_API_KEY=ваш_ключ_tabscanner
PORT=3001
EOF
```

2. **Запустите миграцию базы данных**
```bash
cd telegram-bot
npx prisma migrate dev --name add_receipts_and_items
```

3. **Запустите сервисы**

Терминал 1 - API сервер:
```bash
cd telegram-bot
node api-server.js
```

Терминал 2 - Bot:
```bash
cd telegram-bot
node index.js
```

Терминал 3 - Frontend:
```bash
cd banya-check-app
npm run dev
```

### Docker

1. **Добавьте TABSCANNER_API_KEY в корневой .env**
```bash
TABSCANNER_API_KEY=ваш_ключ_здесь
```

2. **Пересоберите образы**
```bash
docker-compose build
```

3. **Запустите**
```bash
docker-compose up -d
```

4. **Примените миграции**
```bash
docker-compose exec bot npx prisma migrate deploy
```

## Настройки TabScanner

### Получение API ключа

1. Зарегистрируйтесь на https://tabscanner.com/
2. Получите API ключ в личном кабинете
3. Добавьте ключ в .env файл

### Проверка кредитов

Для проверки оставшихся кредитов:
```bash
curl -H "apikey: ваш_ключ" https://api.tabscanner.com/credit
```

### Ограничения

- Максимальный размер файла: 10MB
- Поддерживаемые форматы: JPG, PNG
- Время обработки: ~5 секунд
- Результаты хранятся 90 дней

## Маппинг данных

TabScanner возвращает `lineItems` со следующими полями:
- `descClean` - очищенное название продукта
- `price` - цена за единицу
- `qty` - количество
- `lineTotal` - итоговая сумма строки

Мы преобразуем это в CheckItem:
- `name` = descClean || desc
- `price` = price || (lineTotal / qty)
- `quantity` = qty || 1
- `isCommon` = false (по умолчанию)

## Обработка ошибок

### Ошибки API

- Неверный API ключ: проверьте TABSCANNER_API_KEY в .env
- Недостаточно кредитов: пополните баланс на tabscanner.com
- Ошибка загрузки: проверьте формат файла (только JPG/PNG)

### Таймауты

- Если распознавание длится более 15 секунд, показывается ошибка
- Пользователь может повторить попытку или добавить позиции вручную

### Низкое качество распознавания

- TabScanner возвращает confidence scores (0-1)
- При низком качестве можно добавить логику предупреждения пользователя

## Дальнейшие улучшения

- [ ] Добавить индикатор confidence для каждой позиции
- [ ] Кэширование результатов на клиенте
- [ ] Очистка старых файлов (>7 дней)
- [ ] Batch обработка нескольких чеков
- [ ] История загруженных чеков
- [ ] Повторное распознавание с другими параметрами

## API Документация TabScanner

Полная документация: https://docs.tabscanner.com/

Основные эндпоинты:
- POST /api/2/process - загрузка чека
- GET /api/result/{token} - получение результатов
- GET /credit - проверка кредитов

## Troubleshooting

### Ошибка "TABSCANNER_API_KEY is not set"

Проверьте, что переменная добавлена в:
- Корневой .env для Docker
- telegram-bot/.env для локальной разработки

### Файлы не сохраняются

Проверьте права на папку uploads/:
```bash
ls -la telegram-bot/uploads/
```

### Миграции не применяются в Docker

Пересоберите контейнер:
```bash
docker-compose down
docker-compose build bot
docker-compose up -d
```

## Поддержка

Для вопросов по интеграции создавайте issues в репозитории проекта.

---

**Дата создания:** 2025-10-27
**Версия:** 1.0.0
