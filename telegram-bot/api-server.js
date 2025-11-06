const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  getSession,
  getSessionsForUser,
  getSessionWithItems,
  sessionToLegacyFormat,
  saveItemSelection,
  deleteItemSelection,
  confirmParticipantSelection,
  unconfirmParticipantSelection,
  createPayment,
  updatePayment,
  getParticipantPayments,
  getOrCreateParticipant,
  addParticipantToSession
} = require('./db-helpers');
const { uploadReceiptToTabScanner, getReceiptResult, parseLineItemsToCheckItems } = require('./tabscanner-service');
const { processReceiptWithRunPod } = require('./runpod-ocr-service');
const { processReceiptWithLocalVLLM } = require('./local-vllm-ocr-service');
const { processReceiptWithOllama } = require('./ollama-ocr-service');
const prisma = require('./prisma-client');

const PORT = 3002;
const APP_URL = process.env.APP_URL || 'http://app:3000';

// OCR Provider configuration: 'tabscanner', 'runpod', 'local-vllm', 'ollama'
const OCR_PROVIDER = process.env.OCR_PROVIDER || 'tabscanner';
console.log(`📋 OCR Provider: ${OCR_PROVIDER}`);

// Функция для отправки WebSocket broadcast через HTTP API
async function broadcastToSession(sessionId, message) {
  try {
    const response = await fetch(`${APP_URL}/api/ws-broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message })
    });

    if (!response.ok) {
      console.error('❌ Failed to broadcast message:', await response.text());
    }
  } catch (error) {
    console.error('❌ Error broadcasting to WebSocket:', error);
  }
}
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

    // Выбираем OCR провайдер
    let result;
    let token;
    let status = 'processing';
    let items = [];

    console.log(`🔄 Using OCR provider: ${OCR_PROVIDER}`);

    if (OCR_PROVIDER === 'ollama') {
      // Ollama (локальный M4 Pro)
      console.log('🚀 Processing with Ollama (Apple Silicon)...');
      const ocrResult = await processReceiptWithOllama(req.file.path);

      items = ocrResult.items;
      token = `ollama-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      status = 'completed';

      console.log(`✅ Ollama extracted ${items.length} items`);
    } else if (OCR_PROVIDER === 'local-vllm') {
      // Локальный vLLM с DeepSeek-OCR
      console.log('🚀 Processing with local vLLM (DeepSeek-OCR)...');
      const ocrResult = await processReceiptWithLocalVLLM(req.file.path);

      items = ocrResult.items;
      token = `local-vllm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      status = 'completed';

      console.log(`✅ Local vLLM extracted ${items.length} items`);
    } else if (OCR_PROVIDER === 'runpod') {
      // RunPod vLLM
      console.log('🚀 Processing with RunPod vLLM...');
      const ocrResult = await processReceiptWithRunPod(req.file.path);

      items = ocrResult.items;
      token = `runpod-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      status = 'completed';

      console.log(`✅ RunPod extracted ${items.length} items`);
    } else {
      // TabScanner (default)
      console.log('🚀 Processing with TabScanner...');
      const scannerResult = await uploadReceiptToTabScanner(req.file.path);
      token = scannerResult.token;
      status = 'processing'; // TabScanner требует polling
    }

    // Сохраняем информацию о чеке в БД
    const receipt = await prisma.receipt.create({
      data: {
        sessionId: sessionId,
        filePath: req.file.path,
        token: token,
        status: status,
      }
    });

    // Если уже есть items (local-vllm или runpod), сохраняем их сразу
    if (items.length > 0) {
      await prisma.checkItem.createMany({
        data: items.map(item => ({
          sessionId: sessionId,
          receiptId: receipt.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          isCommon: item.isCommon || false,
        }))
      });

      console.log(`✅ Saved ${items.length} items to database`);
    }

    res.json({
      success: true,
      receiptId: receipt.id,
      token: token,
      status: status,
      items: items.length > 0 ? items : undefined,
      provider: OCR_PROVIDER
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

// POST /api/receipts/upload-runpod - загрузка фото чека с использованием RunPod vLLM
app.post('/api/receipts/upload-runpod', upload.single('file'), async (req, res) => {
  console.log('📸 Receipt upload request received (RunPod)');
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

    // Обрабатываем чек через RunPod vLLM
    console.log('🚀 Processing receipt with RunPod vLLM...');
    const { items, rawData } = await processReceiptWithRunPod(req.file.path);

    console.log(`✅ RunPod extracted ${items.length} items`);

    // Генерируем уникальный токен для совместимости с существующей логикой
    const token = `runpod-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Сохраняем информацию о чеке в БД
    const receipt = await prisma.receipt.create({
      data: {
        sessionId: sessionId,
        filePath: req.file.path,
        token: token,
        status: 'completed',
        rawData: rawData,
      }
    });

    // Сохраняем извлеченные items в БД
    if (items.length > 0) {
      await prisma.checkItem.createMany({
        data: items.map(item => ({
          sessionId: sessionId,
          receiptId: receipt.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          isCommon: item.isCommon || false,
        }))
      });

      console.log(`✅ Saved ${items.length} items to database`);
    }

    res.json({
      success: true,
      receiptId: receipt.id,
      token: token,
      status: 'completed',
      items: items,
    });
  } catch (error) {
    console.error('❌ Error processing receipt with RunPod:', error);

    // Удаляем файл в случае ошибки
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: 'Failed to process receipt with RunPod',
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
    if (receipt.status === 'completed') {
      // Для Ollama/RunPod/local-vllm берём items из БД
      if (token.startsWith('ollama-') || token.startsWith('runpod-') || token.startsWith('local-vllm-')) {
        const items = await prisma.checkItem.findMany({
          where: { receiptId: receipt.id }
        });

        return res.json({
          status: 'completed',
          receiptId: receipt.id,
          items: items.map(item => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            isCommon: item.isCommon
          }))
        });
      }

      // Для TabScanner используем rawData
      if (receipt.rawData) {
        const items = parseLineItemsToCheckItems(receipt.rawData.lineItems || []);
        return res.json({
          status: 'completed',
          receiptId: receipt.id,
          items: items,
          rawData: receipt.rawData,
        });
      }
    }

    // Если ошибка, возвращаем статус
    if (receipt.status === 'failed') {
      return res.json({
        status: 'failed',
        error: 'Receipt processing failed',
      });
    }

    // Запрашиваем статус у TabScanner (только для TabScanner токенов)
    if (token.startsWith('ollama-') || token.startsWith('runpod-') || token.startsWith('local-vllm-')) {
      return res.json({ status: 'processing' });
    }

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
    const { name, price, quantity, isCommon } = req.body;

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
        quantity: quantity ? parseFloat(quantity) : 1,
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
    console.log('✅ [SELECT] Item selection saved:', {
      itemId,
      participantId: actualParticipantId,
      quantity: parseFloat(quantity),
      selectionId: selection.id
    });

    // Отправляем уведомление всем подключенным к сессии
    broadcastToSession(checkItem.sessionId, {
      type: 'item_selection_updated',
      sessionId: checkItem.sessionId,
      itemId: itemId,
      participantId: actualParticipantId,
      quantity: parseFloat(quantity)
    });
    console.log('📡 [SELECT] Broadcasting item_selection_updated to session:', {
      sessionId: checkItem.sessionId,
      itemId,
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
    console.log('✅ [UNSELECT] Item selection removed:', {
      itemId,
      participantId: actualParticipantId
    });

    // Отправляем уведомление всем подключенным к сессии
    broadcastToSession(checkItem.sessionId, {
      type: 'item_selection_updated',
      sessionId: checkItem.sessionId,
      itemId: itemId,
      participantId: actualParticipantId,
      quantity: 0
    });
    console.log('📡 [UNSELECT] Broadcasting item_selection_updated to session:', {
      sessionId: checkItem.sessionId,
      itemId,
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

// Подтвердить выбор позиций
app.post('/api/sessions/:sessionId/confirm-selection', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { participantId } = req.body;

    if (!participantId) {
      return res.status(400).json({ error: 'participantId is required' });
    }

    const result = await confirmParticipantSelection(sessionId, participantId);

    // Получаем обновленную сессию
    const session = await getSessionWithItems(sessionId);
    const legacySession = sessionToLegacyFormat(session);

    // Отправляем WebSocket уведомление
    broadcastToSession(sessionId, {
      type: 'selection_confirmed',
      data: {
        participantId,
        participants: legacySession.participants
      }
    });

    res.json({ success: true, result });
  } catch (error) {
    console.error('Error confirming selection:', error);
    res.status(500).json({ error: error.message });
  }
});

// Отменить подтверждение выбора (разрешить редактирование)
app.post('/api/sessions/:sessionId/unconfirm-selection', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { participantId } = req.body;

    if (!participantId) {
      return res.status(400).json({ error: 'participantId is required' });
    }

    const result = await unconfirmParticipantSelection(sessionId, participantId);

    // Получаем обновленную сессию
    const session = await getSessionWithItems(sessionId);
    const legacySession = sessionToLegacyFormat(session);

    // Отправляем WebSocket уведомление
    broadcastToSession(sessionId, {
      type: 'selection_confirmed',
      data: {
        participantId,
        participants: legacySession.participants
      }
    });

    res.json({ success: true, result });
  } catch (error) {
    console.error('Error unconfirming selection:', error);
    res.status(500).json({ error: error.message });
  }
});

// Создать платеж
app.post('/api/sessions/:sessionId/payments', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { participantId, amount, paymentProof } = req.body;

    if (!participantId || !amount) {
      return res.status(400).json({ error: 'participantId and amount are required' });
    }

    const payment = await createPayment(sessionId, participantId, parseFloat(amount), paymentProof);

    res.json({ success: true, payment });
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Обновить платеж (добавить скриншот)
app.patch('/api/payments/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { paymentProof } = req.body;

    if (!paymentProof) {
      return res.status(400).json({ error: 'paymentProof is required' });
    }

    const payment = await updatePayment(paymentId, paymentProof);

    res.json({ success: true, payment });
  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Получить платежи участника
app.get('/api/sessions/:sessionId/payments/:participantId', async (req, res) => {
  try {
    const { sessionId, participantId } = req.params;

    const payments = await getParticipantPayments(sessionId, participantId);

    res.json({ success: true, payments });
  } catch (error) {
    console.error('Error getting payments:', error);
    res.status(500).json({ error: error.message });
  }
});

// Загрузка скриншота платежа
app.post('/api/upload-payment-proof', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    res.json({
      success: true,
      url: fileUrl
    });
  } catch (error) {
    console.error('Error uploading payment proof:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/sessions/:sessionId/join - присоединиться к сессии по ссылке
app.post('/api/sessions/:sessionId/join', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { telegramUser } = req.body;

    if (!telegramUser || !telegramUser.id) {
      return res.status(400).json({ error: 'telegramUser with id is required' });
    }

    // Проверяем, что сессия существует
    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Создаем или получаем участника
    const participant = await getOrCreateParticipant(telegramUser);

    // Проверяем, не является ли пользователь уже участником
    const existingParticipant = await prisma.sessionParticipant.findUnique({
      where: {
        sessionId_participantId: {
          sessionId,
          participantId: participant.id
        }
      }
    });

    if (existingParticipant) {
      return res.json({
        success: true,
        message: 'Already a participant',
        participant: {
          id: participant.id,
          telegramId: Number(participant.telegramId),
          name: participant.firstName || participant.username || 'Аноним'
        }
      });
    }

    // Добавляем участника в сессию
    await addParticipantToSession(sessionId, participant.id);

    // Отправляем уведомление всем подключенным к сессии
    broadcastToSession(sessionId, {
      type: 'user_joined',
      sessionId: sessionId,
      userId: Number(participant.telegramId),
      userName: participant.firstName || participant.username || 'Аноним',
      userAvatar: participant.avatar,
      userColor: participant.color,
      participant: {
        id: Number(participant.telegramId),
        name: participant.firstName || participant.username || 'Аноним',
        username: participant.username,
        firstName: participant.firstName,
        lastName: participant.lastName,
        avatar: participant.avatar,
        color: participant.color,
        role: 'member',
        selectionConfirmed: false,
        hasPayment: false
      }
    });

    res.json({
      success: true,
      message: 'Successfully joined session',
      participant: {
        id: participant.id,
        telegramId: Number(participant.telegramId),
        name: participant.firstName || participant.username || 'Аноним'
      }
    });
  } catch (error) {
    console.error('Error joining session:', error);
    res.status(500).json({
      error: 'Failed to join session',
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
