const http = require('http');
const url = require('url');
const { getSession, getActiveSessionsForChat, getSessionsForUser, sessionToLegacyFormat } = require('./db-helpers');

const PORT = 3002;

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // GET /api/session/:id or /api/sessions/:id
  if (req.method === 'GET' && (pathname.startsWith('/api/session/') || pathname.startsWith('/api/sessions/'))) {
    const pathParts = pathname.split('/');
    const sessionId = pathParts[3];

    // Проверяем, что это не /api/sessions/user/...
    if (pathParts.length === 4) {
      getSession(sessionId).then(session => {
        if (!session) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Session not found' }));
          return;
        }

        const sessionData = sessionToLegacyFormat(session);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(sessionData));
      }).catch(error => {
        console.error('Error fetching session:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      });
      return;
    }
  }

  // GET /api/sessions/user/:userId
  if (req.method === 'GET' && pathname.startsWith('/api/sessions/user/')) {
    const userId = parseInt(pathname.split('/')[4]);

    getSessionsForUser(userId).then(sessions => {
      // Преобразуем все сессии в legacy формат
      const sessionsData = sessions.map(session => sessionToLegacyFormat(session));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(sessionsData));
    }).catch(error => {
      console.error('Error fetching user sessions:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    });
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`📡 API server running on http://localhost:${PORT}`);
});

module.exports = server;
