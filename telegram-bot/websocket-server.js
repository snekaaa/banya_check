const WebSocket = require('ws');

const WS_PORT = 3003;

// Хранилище подключений: sessionId -> Set of WebSocket clients
const sessionRooms = new Map();

// Хранилище информации о пользователях: client -> {userId, sessionId}
const clientInfo = new WeakMap();

const wss = new WebSocket.Server({ port: WS_PORT });

wss.on('connection', (ws) => {
  console.log('🔌 Новое WebSocket подключение');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // Обработка события "join" - пользователь присоединяется к сессии
      if (data.type === 'join' && data.sessionId && data.userId) {
        const { sessionId, userId, userName, userAvatar, userColor } = data;

        // Сохраняем информацию о клиенте
        clientInfo.set(ws, { sessionId, userId, userName, userAvatar, userColor });

        // Добавляем клиента в комнату сессии
        if (!sessionRooms.has(sessionId)) {
          sessionRooms.set(sessionId, new Set());
        }
        sessionRooms.get(sessionId).add(ws);

        console.log(`👤 Пользователь ${userId} (${userName}) присоединился к сессии ${sessionId}`);

        // Отправляем всем в комнате событие о новом пользователе
        broadcastToSession(sessionId, {
          type: 'user_joined',
          userId,
          userName,
          userAvatar,
          userColor,
        }, ws); // Исключаем самого отправителя

        // Отправляем текущему пользователю список всех онлайн пользователей
        const onlineUsers = getOnlineUsersInSession(sessionId);
        ws.send(JSON.stringify({
          type: 'online_users',
          users: onlineUsers,
        }));
      }

      // Обработка события "ping" для поддержания соединения
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (error) {
      console.error('❌ Ошибка обработки сообщения:', error);
    }
  });

  ws.on('close', () => {
    const info = clientInfo.get(ws);
    if (info) {
      const { sessionId, userId, userName } = info;
      console.log(`👋 Пользователь ${userId} (${userName}) отключился от сессии ${sessionId}`);

      // Удаляем клиента из комнаты
      if (sessionRooms.has(sessionId)) {
        sessionRooms.get(sessionId).delete(ws);

        // Если в комнате никого не осталось, удаляем комнату
        if (sessionRooms.get(sessionId).size === 0) {
          sessionRooms.delete(sessionId);
        }
      }

      // Уведомляем всех в комнате
      broadcastToSession(sessionId, {
        type: 'user_left',
        userId,
        userName,
      });
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket ошибка:', error);
  });
});

/**
 * Отправить сообщение всем клиентам в сессии
 */
function broadcastToSession(sessionId, message, excludeClient = null) {
  if (!sessionRooms.has(sessionId)) return;

  const clients = sessionRooms.get(sessionId);
  const messageStr = JSON.stringify(message);

  clients.forEach((client) => {
    if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

/**
 * Получить список онлайн пользователей в сессии
 */
function getOnlineUsersInSession(sessionId) {
  if (!sessionRooms.has(sessionId)) return [];

  const clients = sessionRooms.get(sessionId);
  const users = [];

  clients.forEach((client) => {
    const info = clientInfo.get(client);
    if (info) {
      users.push({
        userId: info.userId,
        userName: info.userName,
        userAvatar: info.userAvatar,
        userColor: info.userColor,
      });
    }
  });

  return users;
}

console.log(`🚀 WebSocket сервер запущен на порту ${WS_PORT}`);

module.exports = wss;
