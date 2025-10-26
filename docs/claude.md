# БаняСчет - Документация проекта

## Обзор

Telegram Mini App для автоматизации расчета общих счетов при походах в баню с группой друзей. Приложение позволяет справедливо делить расходы, отслеживать оплаты и управлять позициями чека.

## Технологический стек

- **Frontend**: Next.js 15.5.4 (App Router)
- **Backend**: Node.js + Telegraf (Telegram Bot)
- **Database**: PostgreSQL + Prisma ORM
- **TypeScript**: Строгая типизация
- **Styling**: Tailwind CSS с Telegram CSS переменными
- **Images**: Next.js Image optimization
- **Deployment**: Vercel (frontend), Railway/Render (backend + DB)

## Структура проекта

```
banya_check/
├── docs/
│   ├── prd banya.md          # Полное техническое задание
│   ├── claude.md             # Этот файл (документация для разработки)
│   └── setup.md              # Инструкция по запуску проекта
├── telegram-bot/
│   ├── index.js              # Telegram бот
│   ├── api-server.js         # HTTP API сервер (порт 3002)
│   ├── db-helpers.js         # Функции для работы с БД
│   ├── prisma-client.js      # Prisma singleton
│   ├── shared-data.js        # Временное хранилище (legacy)
│   ├── .env                  # Переменные окружения
│   └── prisma/
│       ├── schema.prisma     # Схема базы данных
│       └── migrations/       # История миграций
└── banya-check-app/
    └── app/
        ├── page.tsx          # Главный экран участника (выбор позиций)
        ├── landing/          # Разводящая страница (участник/админ)
        ├── payment/          # Страница оплаты
        ├── review/           # Отзыв о посещении (5 вопросов)
        ├── add-expense/      # Форма добавления общего расхода
        ├── upload-check/     # Загрузка фото чека
        └── admin/
            ├── page.tsx           # Админ-панель (дашборд)
            ├── items/             # Управление позициями
            │   └── [id]/edit/     # Редактирование позиции
            ├── payments/          # Контроль оплат
            ├── participants/      # Управление участниками
            └── close/             # Закрытие счёта
```

## Основные функции

### Для участников

1. **Главный экран чека** (`/`)
   - Список позиций с ценами, количеством
   - Выбор позиций галочками
   - Отображение аватарок кто что выбрал
   - Возможность указать долю (0.5, 1, 2 и т.д.)
   - Общие позиции делятся автоматически на всех
   - Подсчёт "вашей суммы" и "общего счёта"
   - Кнопки добавления расходов и загрузки чека

2. **Страница оплаты** (`/payment`)
   - Отображение итоговой суммы
   - Реквизиты казначея (ФИО, телефон)
   - Информация о доступных банках
   - Кнопка "Я оплатил"

3. **Отзыв** (`/review`)
   - 5 вопросов (Еда, Парная, Комфорт, Цена/качество, Общее впечатление)
   - Рейтинг 1-5 звёзд для каждого
   - Возможность пропустить
   - Минималистичный дизайн

4. **Добавление расхода** (`/add-expense`)
   - Название расхода
   - Сумма
   - Тип: общий/частичный
   - Примеры расходов

5. **Загрузка чека** (`/upload-check`)
   - Выбор фото из галереи или камера
   - Анимация загрузки и обработки
   - Автоматическое добавление позиций (OCR - TODO)

### Для администраторов

1. **Админ-панель** (`/admin`)
   - Статистика: общий счёт, собрано, ожидается, кто оплатил
   - Быстрые действия (4 кнопки)

2. **Управление позициями** (`/admin/items`)
   - Список всех позиций чека
   - Редактирование (название, цена, количество, тип)
   - Удаление позиций
   - Просмотр кто выбрал

3. **Редактирование позиции** (`/admin/items/[id]/edit`)
   - Изменение параметров позиции
   - Управление распределением между участниками
   - Установка долей для каждого

4. **Контроль оплат** (`/admin/payments`)
   - Список оплативших (зелёные карточки)
   - Список ожидающих оплату
   - Ручное подтверждение оплат
   - Статистика собрано/ожидается

5. **Управление участниками** (`/admin/participants`)
   - Список с аватарками и суммами
   - Назначение/снятие роли админа
   - Удаление участников (кроме админов)
   - Добавление новых участников

6. **Закрытие счёта** (`/admin/close`)
   - Финальная сводка
   - Предупреждения о неоплативших
   - Предупреждения о нераспределённых позициях
   - Подтверждение закрытия

## Типы данных

### Participant
```typescript
type Participant = {
  id: number;
  name: string;
  avatar: string;  // URL фото
  color: string;   // Hex цвет для обводки
};
```

### CheckItem
```typescript
type CheckItem = {
  id: number;
  name: string;
  price: number;
  quantity: number;
  selectedBy: ItemShare[];
  isCommon?: boolean;  // true = делится на всех автоматически
};
```

### ItemShare
```typescript
type ItemShare = {
  participantId: number;
  share: number;  // 0.5, 1, 2 и т.д.
};
```

## Дизайн система

### Цвета (Telegram CSS Variables)
- `--tg-theme-bg-color` - Основной фон
- `--tg-theme-text-color` - Основной текст
- `--tg-theme-hint-color` - Второстепенный текст
- `--tg-theme-button-color` - Синие кнопки (#3390ec fallback)
- `--tg-theme-button-text-color` - Текст на кнопках
- `--tg-theme-secondary-bg-color` - Серый фон карточек (#f5f5f5 fallback)

### Компоненты
- Rounded corners: `rounded-xl` (12px) или `rounded-2xl` (16px)
- Кнопки: `py-4` высота, `active:scale-95` анимация
- Карточки: серый фон `#f5f5f5`, padding `p-4`
- Аватарки: круглые с цветной обводкой `border-2`
- Выбранные позиции: синий фон с белым текстом

### Адаптация
- Max width: 420px
- Mobile-first
- Sticky header с кнопкой "←" назад
- Fixed footer для главных действий

## Флоу пользователя

### Участник
1. Landing → Выбор "Я участник"
2. Главный экран → Выбор позиций галочками
3. Изменение количества через кнопку "изменить" (если нужно)
4. "Подтвердить выбор" → Страница оплаты
5. "Я оплатил" → Отзыв (5 вопросов)
6. "Отправить" → Возврат на главную с зелёной галочкой на аватарке

### Администратор
1. Landing → Выбор "Я администратор"
2. Админ-панель → Выбор действия:
   - **Управление позициями**: редактировать/удалить
   - **Контроль оплат**: подтвердить оплаты
   - **Участники**: управление ролями
   - **Закрыть счёт**: финальное закрытие

## Mock данные

- 8 участников с фото с pravatar.cc
- 9 позиций чека (аренда парной, еда, напитки)
- Первая позиция - "Аренда парной" помечена как `isCommon: true`

## База данных (Prisma Schema)

### Таблицы

**Participant** - Участники (пользователи Telegram)
```prisma
model Participant {
  id           String   @id @default(cuid())
  telegramId   BigInt   @unique
  username     String?
  firstName    String?
  lastName     String?
  avatar       String?  // URL аватара (pravatar.cc)
  color        String?  // Hex цвет для обводки
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  sessions     SessionParticipant[]
}
```

**Session** - Походы в баню
```prisma
model Session {
  id           String   @id @default(cuid())
  chatId       BigInt   // ID Telegram чата
  adminId      BigInt   // ID администратора
  venueName    String?  // Название бани
  date         String?  // Дата похода
  time         String?  // Время похода
  status       String   @default("draft") // draft, active, closed
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  participants SessionParticipant[]
}
```

**SessionParticipant** - Связь участников и походов (многие-ко-многим)
```prisma
model SessionParticipant {
  id            String   @id @default(cuid())
  sessionId     String
  participantId String
  role          String   @default("member") // admin, member
  hasPayment    Boolean  @default(false)
  createdAt     DateTime @default(now())
  session       Session     @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  participant   Participant @relation(fields: [participantId], references: [id], onDelete: Cascade)
  @@unique([sessionId, participantId])
}
```

### API Endpoints

**GET /api/session/:id** - Получить поход по ID
- Возвращает: Session с участниками
- Формат: `{ id, chatId, adminId, venueName, date, time, status, participants: [] }`

**GET /api/sessions/user/:userId** - Получить походы пользователя (TODO)

## TODO / Будущие улучшения

### Backend интеграция
- [x] ~~API для получения сессий~~
- [x] ~~Сохранение походов в БД~~
- [x] ~~Сохранение участников в БД~~
- [ ] API для CRUD операций с позициями чека
- [ ] Сохранение состояния оплат
- [ ] Real-time синхронизация между участниками
- [ ] История посещений

### OCR
- [ ] Интеграция OCR для распознавания чеков
- [ ] Ручная корректировка распознанных позиций

### Функции
- [ ] Экспорт истории в PDF/Excel
- [ ] Статистика посещений
- [ ] Push-уведомления об оплатах
- [ ] Множественные роли админов

### UX
- [ ] Анимации переходов между страницами
- [ ] Скелетоны при загрузке
- [ ] Offline-режим с синхронизацией

## Запуск проекта

Подробная инструкция в [setup.md](./setup.md).

**Быстрый старт** (требует 3 терминала):

**Терминал 1** - База данных:
```bash
cd telegram-bot
npx prisma dev --name default
```

**Терминал 2** - Telegram бот + API:
```bash
cd telegram-bot
npm run dev
```

**Терминал 3** - Next.js приложение:
```bash
cd banya-check-app
npm run dev
```

Откроется:
- Frontend: http://localhost:3000
- API: http://localhost:3002
- Prisma Postgres: localhost:51213-51215

## Команды

### Frontend (banya-check-app)
- `npm run dev` - Запуск dev сервера
- `npm run build` - Production build
- `npm run start` - Запуск production сервера
- `npm run lint` - ESLint проверка

### Backend (telegram-bot)
- `npm run dev` - Запуск бота и API
- `npx prisma studio` - Открыть GUI для БД
- `npx prisma migrate dev` - Создать миграцию
- `npx prisma generate` - Сгенерировать Prisma Client

## Конфигурация

### next.config.ts
```typescript
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: 'i.pravatar.cc',
      pathname: '/**',
    },
  ],
}
```

Разрешены изображения с pravatar.cc для аватарок.

## Заметки

- Все суммы округляются до целых рублей при отображении
- Доли могут быть от 0.1 до 10
- Общие позиции автоматически делятся на количество участников
- После оплаты на аватарке появляется зелёная галочка
- Админов нельзя удалить из участников
- Нераспределённые позиции делятся поровну при закрытии счёта

## Поддержка

Для вопросов и багов: создавайте issues в репозитории проекта.

## Файлы проекта

### Backend (telegram-bot/)

**index.js** - Главный файл бота
- Обработка команд (`/start`, `/help`, `/newbanya`)
- FSM для создания походов (ввод названия, даты, времени)
- Выбор участников из чата
- Интеграция с Prisma для сохранения в БД

**api-server.js** - HTTP API сервер
- Порт 3002
- Эндпоинты для получения сессий
- CORS для взаимодействия с Next.js

**db-helpers.js** - Функции для работы с БД
- `createSession()` - создать поход
- `getSession()` - получить поход по ID
- `updateSession()` - обновить поход
- `addParticipantToSession()` - добавить участника
- `getOrCreateParticipant()` - создать/получить участника
- `sessionToLegacyFormat()` - преобразовать для совместимости

**prisma-client.js** - Singleton Prisma Client

**shared-data.js** - Legacy (Map для хранения chatMembers)

### Frontend (banya-check-app/)

**app/page.tsx** - Главная страница (выбор позиций чека)
- Mock данные: 8 участников, 9 позиций
- Выбор позиций галочками
- Изменение долей (0.5, 1, 2...)
- Подсчет сумм в реальном времени

**app/landing/page.tsx** - Разводящая страница
**app/payment/page.tsx** - Страница оплаты
**app/review/page.tsx** - Отзыв (5 вопросов)
**app/admin/** - Админ-панель (управление походом)

---

**Последнее обновление:** 2025-10-13
