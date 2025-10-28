const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const WebSocket = require('ws');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// WebSocket configuration
const WS_PATH = '/ws';
const PING_TIMEOUT = 10000; // 10 секунд
const PING_CHECK_INTERVAL = 5000; // Проверяем каждые 5 секунд

// Хранилище подключений: sessionId -> Set of WebSocket clients
const sessionRooms = new Map();

// Хранилище информации о пользователях: client -> {userId, sessionId}
const clientInfo = new WeakMap();

// Хранилище времени последнего ping: client -> timestamp
const lastPingTime = new Map();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // WebSocket Server
  const wss = new WebSocket.Server({
    server,
    path: WS_PATH,
  });

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

          // Инициализируем время последнего ping
          lastPingTime.set(ws, Date.now());

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
          // Обновляем время последнего ping
          lastPingTime.set(ws, Date.now());

          // Отправляем pong с текущим timestamp
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: Date.now()
          }));
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

        // Очищаем время последнего ping
        lastPingTime.delete(ws);

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

  // Интервал проверки timeout для неактивных клиентов
  setInterval(() => {
    const now = Date.now();

    // Проходимся по всем подключенным клиентам
    lastPingTime.forEach((lastPing, ws) => {
      const timeSinceLastPing = now - lastPing;

      // Если прошло больше PING_TIMEOUT с последнего ping
      if (timeSinceLastPing > PING_TIMEOUT) {
        const info = clientInfo.get(ws);
        if (info) {
          const { sessionId, userId, userName } = info;
          console.log(`⏰ Пользователь ${userId} (${userName}) отключён по таймауту (${timeSinceLastPing}ms)`);

          // Удаляем из комнаты
          if (sessionRooms.has(sessionId)) {
            sessionRooms.get(sessionId).delete(ws);

            if (sessionRooms.get(sessionId).size === 0) {
              sessionRooms.delete(sessionId);
            }
          }

          // Очищаем время последнего ping
          lastPingTime.delete(ws);

          // Уведомляем всех в комнате
          broadcastToSession(sessionId, {
            type: 'user_left',
            userId,
            userName,
          });
        }

        // Закрываем соединение
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'Ping timeout');
        }
      }
    });
  }, PING_CHECK_INTERVAL);

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`🚀 Next.js готов на http://${hostname}:${port}`);
    console.log(`🔌 WebSocket сервер готов на ws://${hostname}:${port}${WS_PATH}`);
    console.log(`⏱️  Timeout для неактивных клиентов: ${PING_TIMEOUT}ms`);
    console.log(`🔍 Проверка неактивных клиентов каждые ${PING_CHECK_INTERVAL}ms`);
  });
});
