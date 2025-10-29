const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getSession, getSessionsForUser, getSessionWithItems, sessionToLegacyFormat, saveItemSelection, deleteItemSelection } = require('./db-helpers');
const { uploadReceiptToTabScanner, getReceiptResult, parseLineItemsToCheckItems } = require('./tabscanner-service');
const prisma = require('./prisma-client');
const { broadcastToSession } = require('./websocket-server');

const PORT = 3002;
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Создаем папку для загрузок если её нет
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB максимум
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG and PNG images are allowed'));
    }
  }
});

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// GET /api/session/:id or /api/sessions/:id
app.get(['/api/session/:id', '/api/sessions/:id'], async (req, res) => {
  try {
    const { id } = req.params;
    const session = await getSessionWithItems(id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const sessionData = sessionToLegacyFormat(session);
    res.json(sessionData);
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/sessions/user/:userId
app.get('/api/sessions/user/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const sessions = await getSessionsForUser(userId);
    const sessionsData = sessions.map(session => sessionToLegacyFormat(session));
    res.json(sessionsData);
  } catch (error) {
    console.error('Error fetching user sessions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/receipts/upload - загрузка фото чека
app.post('/api/receipts/upload', upload.single('file'), async (req, res) => {
  console.log('📸 Receipt upload request received');
  try {
    const { sessionId } = req.body;
    console.log('SessionId:', sessionId);

    if (!sessionId) {
      console.log('❌ No sessionId provided');
      return res.status(400).json({ error: 'sessionId is required' });
    }

    if (!req.file) {
      console.log('❌ No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('✅ File received:', req.file.filename, 'Size:', req.file.size);

    // Проверяем, что сессия существует
    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      console.log('❌ Session not found:', sessionId);
      // Удаляем загруженный файл
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Session not found' });
    }

    console.log('✅ Session found:', sessionId);

    // Загружаем чек в TabScanner
    const { token } = await uploadReceiptToTabScanner(req.file.path);

    // Сохраняем информацию о чеке в БД
    const receipt = await prisma.receipt.create({
      data: {
        sessionId: sessionId,
        filePath: req.file.path,
        token: token,
        status: 'processing',
      }
    });

    res.json({
      success: true,
      receiptId: receipt.id,
      token: token,
      status: 'processing',
    });
  } catch (error) {
    console.error('Error uploading receipt:', error);

    // Удаляем файл в случае ошибки
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: 'Failed to upload receipt',
      message: error.message
    });
  }
});

// GET /api/receipts/status/:token - проверка статуса обработки
app.get('/api/receipts/status/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Находим чек по токену
    const receipt = await prisma.receipt.findFirst({
      where: { token: token }
    });

    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    // Если уже обработан, возвращаем сохраненные данные
    if (receipt.status === 'completed' && receipt.rawData) {
      const items = parseLineItemsToCheckItems(receipt.rawData.lineItems || []);
      return res.json({
        status: 'completed',
        receiptId: receipt.id,
        items: items,
        rawData: receipt.rawData,
      });
    }

    // Если ошибка, возвращаем статус
    if (receipt.status === 'failed') {
      return res.json({
        status: 'failed',
        error: 'Receipt processing failed',
      });
    }

    // Запрашиваем статус у TabScanner
    const result = await getReceiptResult(token);

    if (result.status === 'processing') {
      return res.json({ status: 'processing' });
    }

    // Обработка завершена, сохраняем результаты
    const updatedReceipt = await prisma.receipt.update({
      where: { id: receipt.id },
      data: {
        status: 'completed',
        rawData: result,
      }
    });

    const items = parseLineItemsToCheckItems(result.lineItems || []);

    res.json({
      status: 'completed',
      receiptId: receipt.id,
      items: items,
      rawData: result,
    });
  } catch (error) {
    console.error('Error checking receipt status:', error);

    // Пытаемся пометить чек как failed
    try {
      await prisma.receipt.updateMany({
        where: { token: req.params.token },
        data: { status: 'failed' }
      });
    } catch (dbError) {
      console.error('Error updating receipt status:', dbError);
    }

    res.status(500).json({
      error: 'Failed to check receipt status',
      message: error.message
    });
  }
});

// POST /api/receipts/confirm - подтверждение и сохранение позиций
app.post('/api/receipts/confirm', async (req, res) => {
  try {
    const { receiptId, items, sessionId } = req.body;

    if (!receiptId || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'receiptId and items array are required' });
    }

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }


    // Проверяем, что чек существует
    const receipt = await prisma.receipt.findUnique({
      where: { id: receiptId }
    });

    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    // Создаем позиции чека
    const createdItems = await Promise.all(
      items.map(item =>
        prisma.checkItem.create({
          data: {
            sessionId: sessionId,
            receiptId: receiptId,
            name: item.name,
            price: parseFloat(item.price),
            quantity: parseFloat(item.quantity),
            isCommon: Boolean(item.isCommon),
          }
        })
      )
    );

    res.json({
      success: true,
      message: 'Items saved successfully',
      items: createdItems,
    });
  } catch (error) {
    console.error('Error confirming receipt:', error);
    res.status(500).json({
      error: 'Failed to save items',
      message: error.message
    });
  }
});

// GET /api/sessions/:sessionId/items - получить все позиции для сессии
app.get('/api/sessions/:sessionId/items', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const items = await prisma.checkItem.findMany({
      where: { sessionId: sessionId },
      orderBy: { createdAt: 'asc' }
    });

    res.json(items);
  } catch (error) {
    console.error('Error fetching session items:', error);
    res.status(500).json({
      error: 'Failed to fetch items',
      message: error.message
    });
  }
});

// DELETE /api/items/:itemId - удалить позицию
app.delete('/api/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;

    await prisma.checkItem.delete({
      where: { id: itemId }
    });

    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({
      error: 'Failed to delete item',
      message: error.message
    });
  }
});

// POST /api/sessions/:sessionId/expenses - добавить расход вручную
app.post('/api/sessions/:sessionId/expenses', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { name, price, isCommon } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: 'name and price are required' });
    }

    // Проверяем, что сессия существует
    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Создаем расход
    const expense = await prisma.checkItem.create({
      data: {
        sessionId: sessionId,
        name: name.trim(),
        price: parseFloat(price),
        quantity: 1,
        isCommon: Boolean(isCommon),
      }
    });

    // Отправляем уведомление всем подключенным к сессии
    broadcastToSession(sessionId, {
      type: 'expenses_updated',
      sessionId: sessionId,
    });

    res.json({
      success: true,
      message: 'Expense added successfully',
      expense: expense,
    });
  } catch (error) {
    console.error('Error adding expense:', error);
    res.status(500).json({
      error: 'Failed to add expense',
      message: error.message
    });
  }
});

// POST /api/items/:itemId/select - выбрать позицию
app.post('/api/items/:itemId/select', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { participantId, telegramId, quantity } = req.body;

    if (!participantId && !telegramId) {
      return res.status(400).json({ error: 'participantId or telegramId is required' });
    }

    if (quantity === undefined || quantity === null) {
      return res.status(400).json({ error: 'quantity is required' });
    }

    // Проверяем, что позиция существует
    const checkItem = await prisma.checkItem.findUnique({
      where: { id: itemId }
    });

    if (!checkItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Если передан telegramId, находим участника
    let actualParticipantId = participantId;
    if (telegramId && !participantId) {
      const participant = await prisma.participant.findUnique({
        where: { telegramId: BigInt(telegramId) }
      });

      if (!participant) {
        return res.status(404).json({ error: 'Participant not found' });
      }

      actualParticipantId = participant.id;
    }

    // Сохраняем или обновляем выбор
    const selection = await saveItemSelection(itemId, actualParticipantId, parseFloat(quantity));

    // Отправляем уведомление всем подключенным к сессии
    broadcastToSession(checkItem.sessionId, {
      type: 'item_selection_updated',
      sessionId: checkItem.sessionId,
      itemId: itemId,
      participantId: actualParticipantId,
      quantity: parseFloat(quantity)
    });

    res.json({
      success: true,
      message: 'Selection saved successfully',
      selection: {
        id: selection.id,
        checkItemId: selection.checkItemId,
        participantId: selection.participantId,
        quantity: selection.quantity,
      }
    });
  } catch (error) {
    console.error('Error saving item selection:', error);
    res.status(500).json({
      error: 'Failed to save selection',
      message: error.message
    });
  }
});

// DELETE /api/items/:itemId/unselect - убрать выбор позиции
app.delete('/api/items/:itemId/unselect', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { participantId, telegramId } = req.body;

    if (!participantId && !telegramId) {
      return res.status(400).json({ error: 'participantId or telegramId is required' });
    }

    // Проверяем, что позиция существует
    const checkItem = await prisma.checkItem.findUnique({
      where: { id: itemId }
    });

    if (!checkItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Если передан telegramId, находим участника
    let actualParticipantId = participantId;
    if (telegramId && !participantId) {
      const participant = await prisma.participant.findUnique({
        where: { telegramId: BigInt(telegramId) }
      });

      if (!participant) {
        return res.status(404).json({ error: 'Participant not found' });
      }

      actualParticipantId = participant.id;
    }

    // Удаляем выбор
    await deleteItemSelection(itemId, actualParticipantId);

    // Отправляем уведомление всем подключенным к сессии
    broadcastToSession(checkItem.sessionId, {
      type: 'item_selection_updated',
      sessionId: checkItem.sessionId,
      itemId: itemId,
      participantId: actualParticipantId,
      quantity: 0
    });

    res.json({
      success: true,
      message: 'Selection removed successfully'
    });
  } catch (error) {
    console.error('Error removing item selection:', error);
    res.status(500).json({
      error: 'Failed to remove selection',
      message: error.message
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

const server = app.listen(PORT, () => {
  console.log(`📡 API server running on http://localhost:${PORT}`);
});

module.exports = server;
