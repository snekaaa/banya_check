## Структура базы данных

### Participant
Пользователь Telegram

- `id` - UUID
- `telegramId` - BigInt (уникальный)
- `username` - String
- `firstName` - String
- `lastName` - String
- `avatar` - String (URL)
- `color` - String (HEX)

### Session
Поход в баню

- `id` - UUID
- `chatId` - BigInt
- `adminId` - BigInt
- `venueName` - String (название бани)
- `date` - String
- `time` - String
- `status` - String (draft/active/closed)

### SessionParticipant
Связь участников и сессий

- `sessionId` - UUID
- `participantId` - UUID
- `role` - String (admin/member)
- `hasPayment` - Boolean