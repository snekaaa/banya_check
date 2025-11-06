const fs = require('fs');
const path = require('path');
const http = require('http');

const LOCAL_VLLM_URL = process.env.LOCAL_VLLM_URL || 'http://localhost:8000';

/**
 * Конвертирует изображение в base64
 * @param {string} filePath - путь к файлу
 * @returns {string} - base64 строка с MIME префиксом
 */
function imageToBase64(filePath) {
  const imageBuffer = fs.readFileSync(filePath);
  const base64Image = imageBuffer.toString('base64');

  // Определяем MIME тип по расширению
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

  return `data:${mimeType};base64,${base64Image}`;
}

/**
 * Обрабатывает чек через локальный vLLM с DeepSeek-OCR
 * @param {string} filePath - путь к файлу с чеком
 * @returns {Promise<{items: Array, rawData: Object}>}
 */
async function processReceiptWithLocalVLLM(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const fileStats = fs.statSync(filePath);
  const fileName = path.basename(filePath);

  console.log(`📤 Processing receipt with local vLLM (DeepSeek-OCR): ${fileName} (${fileStats.size} bytes)`);

  // Конвертируем изображение в base64
  const base64Image = imageToBase64(filePath);

  // Формируем запрос в OpenAI-compatible формате
  // DeepSeek-OCR использует специальный prompt для OCR
  const requestBody = {
    model: "deepseek-ai/DeepSeek-OCR",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: base64Image
            }
          },
          {
            type: "text",
            text: `<|grounding|>Extract all items from this receipt and convert to structured JSON.

Return ONLY a valid JSON array with this exact format:
[{"name":"Product Name","price":10.5,"quantity":1}]

Rules:
- Extract EVERY product/item line from the receipt
- "name" must be the product name (in original language)
- "price" must be a number (price per unit, not total)
- "quantity" must be a number (default 1 if not specified)
- Skip total/subtotal/tax/payment method lines
- Return ONLY the JSON array, no explanations or markdown code blocks`
          }
        ]
      }
    ],
    max_tokens: 2000,
    temperature: 0.1
  };

  const url = new URL(`${LOCAL_VLLM_URL}/v1/chat/completions`);

  return new Promise((resolve, reject) => {
    const requestData = JSON.stringify(requestBody);

    const options = {
      hostname: url.hostname,
      port: url.port || 8000,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData)
      },
      timeout: 60000 // 60 секунд timeout
    };

    console.log(`🔄 Sending request to local vLLM: ${LOCAL_VLLM_URL}/v1/chat/completions`);

    const req = http.request(options, (res) => {
      let body = '';

      res.on('data', chunk => body += chunk);

      res.on('end', () => {
        console.log('📥 vLLM response status:', res.statusCode);

        try {
          const data = JSON.parse(body);

          if (res.statusCode !== 200) {
            console.error('❌ vLLM API error response:', body);
            reject(new Error(`vLLM API error (${res.statusCode}): ${data.error || data.message || body}`));
            return;
          }

          console.log('📥 vLLM response:', JSON.stringify(data, null, 2));

          // Извлекаем результат из OpenAI-compatible ответа
          if (!data.choices || data.choices.length === 0) {
            reject(new Error('No choices in vLLM response'));
            return;
          }

          const messageContent = data.choices[0].message?.content || '';
          console.log('📝 Model response:', messageContent);

          // Парсим JSON из ответа
          let items = [];

          try {
            // Извлекаем JSON из текста (может быть в markdown блоке или с пояснениями)
            const jsonMatch = messageContent.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              items = JSON.parse(jsonMatch[0]);
            } else {
              // Пытаемся распарсить весь контент
              items = JSON.parse(messageContent);
            }
          } catch (parseError) {
            console.error('❌ Failed to parse items from output:', parseError.message);
            console.error('Output was:', messageContent);
            reject(new Error(`Failed to parse items from model output: ${parseError.message}`));
            return;
          }

          // Валидация и форматирование items
          const validatedItems = validateAndFormatItems(items);

          if (validatedItems.length === 0) {
            console.warn('⚠️ No valid items extracted from receipt');
          }

          console.log(`✅ Successfully extracted ${validatedItems.length} items from receipt`);

          resolve({
            items: validatedItems,
            rawData: data
          });

        } catch (error) {
          console.error('❌ Error parsing vLLM response:', error.message);
          reject(new Error(`Failed to parse vLLM response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request error:', error.message);
      if (error.code === 'ECONNREFUSED') {
        reject(new Error(`Cannot connect to local vLLM at ${LOCAL_VLLM_URL}. Is the vLLM Docker container running?`));
      } else {
        reject(error);
      }
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('vLLM request timeout (60s)'));
    });

    req.write(requestData);
    req.end();
  });
}

/**
 * Валидирует и форматирует извлеченные items
 * @param {Array} items - массив items от модели
 * @returns {Array} - отформатированный массив
 */
function validateAndFormatItems(items) {
  if (!Array.isArray(items)) {
    console.error('❌ Items is not an array:', items);
    return [];
  }

  return items
    .filter(item => {
      // Проверяем обязательные поля
      if (!item || typeof item !== 'object') return false;
      if (!item.name || typeof item.name !== 'string') return false;
      if (item.price === undefined || item.price === null) return false;

      return true;
    })
    .map(item => ({
      name: String(item.name).trim(),
      price: Math.max(0, parseFloat(item.price) || 0),
      quantity: Math.max(1, parseFloat(item.quantity) || 1),
      isCommon: false
    }))
    .filter(item => item.price > 0 && item.name.length > 0);
}

/**
 * Проверяет доступность локального vLLM сервиса
 * @returns {Promise<Object>} - информация о статусе сервиса
 */
async function checkLocalVLLMHealth() {
  const url = new URL(`${LOCAL_VLLM_URL}/health`);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: url.port || 8000,
      path: url.pathname,
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let body = '';

      res.on('data', chunk => body += chunk);

      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({
            status: 'healthy',
            url: LOCAL_VLLM_URL
          });
        } else {
          reject(new Error(`vLLM health check failed: ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      if (error.code === 'ECONNREFUSED') {
        reject(new Error(`Cannot connect to local vLLM at ${LOCAL_VLLM_URL}. Make sure Docker container is running.`));
      } else {
        reject(error);
      }
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Health check timeout'));
    });

    req.end();
  });
}

module.exports = {
  processReceiptWithLocalVLLM,
  checkLocalVLLMHealth,
  imageToBase64
};
