## API Endpoints

### GET /api/session/:id
Получить сессию по ID

Response:
```json
{
  "id": "uuid",
  "venueName": "Баня Изба",
  "date": "8 марта 2025",
  "time": "18:00",
  "participants": [...]
}
```

### GET /api/sessions/user/:userId
Получить все сессии пользователя

Response:
```json
[
  {
    "id": "uuid",
    "venueName": "Баня Изба",
    "participants": [...]
  }
]
```



## WebSocket Events

### Client → Server

#### join
Присоединиться к сессии
```json
{
  "type": "join",
  "sessionId": "uuid",
  "userId": 123456789,
  "userName": "Андрей",
  "userAvatar": "https://...",
  "userColor": "#FF6B6B"
}
```

#### ping
Поддержание соединения
```json
{
  "type": "ping"
}
```

### Server → Client

#### online_users
Список всех онлайн пользователей
```json
{
  "type": "online_users",
  "users": [
    {
      "userId": 123456789,
      "userName": "Андрей",
      "userAvatar": "https://...",
      "userColor": "#FF6B6B"
    }
  ]
}
```

#### user_joined
Новый пользователь присоединился
```json
{
  "type": "user_joined",
  "userId": 123456789,
  "userName": "Андрей",
  "userAvatar": "https://...",
  "userColor": "#FF6B6B"
}
```

#### user_left
Пользователь отключился
```json
{
  "type": "user_left",
  "userId": 123456789,
  "userName": "Андрей"
}
```