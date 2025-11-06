const fs = require('fs');
const path = require('path');
const http = require('http');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2-vision:11b';

/**
 * Конвертирует изображение в base64
 * @param {string} filePath - путь к файлу
 * @returns {string} - base64 строка БЕЗ MIME префикса (Ollama не требует)
 */
function imageToBase64(filePath) {
  const imageBuffer = fs.readFileSync(filePath);
  return imageBuffer.toString('base64');
}

/**
 * Обрабатывает чек через Ollama с llama3.2-vision
 * @param {string} filePath - путь к файлу с чеком
 * @returns {Promise<{items: Array, rawData: Object}>}
 */
async function processReceiptWithOllama(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const fileStats = fs.statSync(filePath);
  const fileName = path.basename(filePath);

  console.log(`📤 Processing receipt with Ollama (${OLLAMA_MODEL}): ${fileName} (${fileStats.size} bytes)`);

  // Конвертируем изображение в base64 (без префикса data:image)
  const base64Image = imageToBase64(filePath);

  // Формируем запрос в Ollama API формате
  const requestBody = {
    model: OLLAMA_MODEL,
    messages: [
      {
        role: "system",
        content: "You are a JSON-only API. You must respond with valid JSON only, no explanations."
      },
      {
        role: "user",
        content: `Extract ONLY actual menu items/products from this receipt. Return JSON array starting with [

Format: [{"name":"Item Name","price":10.5,"quantity":1}]

IMPORTANT - How to read items:
Common formats on receipts:
- "Burger    1x290" means: quantity=1, price=290
- "Beer 0.5  2  580" means: quantity=2, price=290 (580/2)
- "Pizza     450" means: quantity=1, price=450

Extract for each item:
- name: product name only (no numbers)
- price: price per ONE unit (not total)
- quantity: how many units

SKIP these lines (NOT real products):
- "ИТОГО" / "TOTAL" / "Сумма" / "Всего"
- "ПОДЫТОГ" / "Subtotal"
- "В том числе" / "Including"
- "НДС" / "Tax" / "Налог"
- "Скидка" / "Discount" (unless part of item name)
- "К оплате" / "To pay"
- Any line that is just a category/section name

Start with [`,
        images: [base64Image]
      }
    ],
    stream: false,
    options: {
      temperature: 0.1,
      num_predict: 2000,
      top_p: 0.9
    }
  };

  const url = new URL(`${OLLAMA_URL}/api/chat`);

  return new Promise((resolve, reject) => {
    const requestData = JSON.stringify(requestBody);

    const options = {
      hostname: url.hostname,
      port: url.port || 11434,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData)
      },
      timeout: 120000 // 2 минуты timeout
    };

    console.log(`🔄 Sending request to Ollama: ${OLLAMA_URL}/api/chat`);

    const req = http.request(options, (res) => {
      let body = '';

      res.on('data', chunk => body += chunk);

      res.on('end', () => {
        console.log('📥 Ollama response status:', res.statusCode);

        try {
          const data = JSON.parse(body);

          if (res.statusCode !== 200) {
            console.error('❌ Ollama API error response:', body);
            reject(new Error(`Ollama API error (${res.statusCode}): ${data.error || body}`));
            return;
          }

          console.log('📥 Ollama response received');

          // Извлекаем результат из Ollama ответа
          if (!data.message || !data.message.content) {
            reject(new Error('No message content in Ollama response'));
            return;
          }

          const messageContent = data.message.content;
          console.log('📝 Model response:', messageContent);

          // Парсим JSON из ответа
          let items = [];

          try {
            // Очищаем контент от markdown code blocks
            let cleanContent = messageContent.trim();

            // Удаляем ```json, ``` или ```javascript если они есть
            cleanContent = cleanContent.replace(/^```(?:json|javascript)?\s*/i, '').replace(/\s*```$/, '');
            cleanContent = cleanContent.trim();

            // Пытаемся распарсить очищенный JSON
            items = JSON.parse(cleanContent);
          } catch (parseError) {
            console.error('❌ Failed to parse items from output:', parseError.message);
            console.error('Output length:', messageContent.length);

            // Fallback: ищем JSON массив в тексте
            try {
              // Удаляем markdown blocks
              let text = messageContent.trim()
                .replace(/^```(?:json|javascript)?\s*/i, '')
                .replace(/\s*```$/, '')
                .trim();

              // Ищем JSON массив: находим первый [ и последний ]
              const startIdx = text.indexOf('[');
              const endIdx = text.lastIndexOf(']');

              if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                const jsonStr = text.substring(startIdx, endIdx + 1);
                console.log('⚠️ Extracting JSON array from text...');
                items = JSON.parse(jsonStr);
                console.log(`✅ Extracted ${items.length} items from response with explanations`);
              } else {
                // Если не нашли массив, пытаемся найти частичный
                const partialMatch = text.match(/(\[[\s\S]*\})\s*,?\s*\{[^}]*$/);
                if (partialMatch) {
                  const partialArray = partialMatch[1] + ']';
                  console.log('⚠️ Attempting to parse partial array...');
                  items = JSON.parse(partialArray);
                  console.log(`✅ Recovered ${items.length} items from partial response`);
                } else {
                  throw parseError;
                }
              }
            } catch (fallbackError) {
              console.error('❌ Fallback parsing also failed');
              reject(new Error(`Failed to parse items from model output: ${parseError.message}`));
              return;
            }
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
          console.error('❌ Error parsing Ollama response:', error.message);
          reject(new Error(`Failed to parse Ollama response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request error:', error.message);
      if (error.code === 'ECONNREFUSED') {
        reject(new Error(`Cannot connect to Ollama at ${OLLAMA_URL}. Is Ollama running? (brew services start ollama)`));
      } else {
        reject(error);
      }
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Ollama request timeout (120s)'));
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

  // Список служебных слов для фильтрации
  const serviceWordsRegex = /^(итого|total|сумма|всего|подытог|subtotal|в том числе|including|ндс|tax|налог|скидка общая|discount total|к оплате|to pay|оплата|payment|сдача|change|наличные|cash|карта|card|чек|receipt|спасибо|thank|пожалуйста|please)$/i;

  const uniqueItems = new Map();

  items
    .filter(item => {
      // Проверяем обязательные поля
      if (!item || typeof item !== 'object') return false;
      if (!item.name || typeof item.name !== 'string') return false;
      if (item.price === undefined || item.price === null) return false;

      // Фильтруем служебные строки
      const itemName = String(item.name).trim();
      if (serviceWordsRegex.test(itemName)) {
        console.log(`⚠️ Filtered service line: "${itemName}"`);
        return false;
      }

      // Фильтруем строки с подозрительно большими ценами (скорее всего это итоги)
      const price = parseFloat(item.price);
      if (price > 50000) {
        console.log(`⚠️ Filtered suspicious high price item: "${itemName}" - ${price}`);
        return false;
      }

      return true;
    })
    .map(item => ({
      name: String(item.name).trim(),
      price: Math.max(0, parseFloat(item.price) || 0),
      quantity: Math.max(1, parseFloat(item.quantity) || 1),
      isCommon: false
    }))
    .filter(item => item.price > 0 && item.name.length > 0)
    .forEach(item => {
      // Удаляем дубликаты по имени
      const key = item.name.toLowerCase();
      if (!uniqueItems.has(key)) {
        uniqueItems.set(key, item);
      } else {
        // Если дубликат, увеличиваем количество
        const existing = uniqueItems.get(key);
        existing.quantity += item.quantity;
      }
    });

  const result = Array.from(uniqueItems.values());

  // Ограничиваем до 30 товаров (защита от галлюцинаций)
  if (result.length > 30) {
    console.warn(`⚠️ Too many items detected (${result.length}), limiting to 30`);
    return result.slice(0, 30);
  }

  return result;
}

/**
 * Проверяет доступность Ollama сервиса
 * @returns {Promise<Object>} - информация о статусе сервиса
 */
async function checkOllamaHealth() {
  const url = new URL(`${OLLAMA_URL}/api/tags`);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: url.port || 11434,
      path: url.pathname,
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let body = '';

      res.on('data', chunk => body += chunk);

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const data = JSON.parse(body);
            const modelExists = data.models && data.models.some(m => m.name === OLLAMA_MODEL);

            resolve({
              status: 'healthy',
              url: OLLAMA_URL,
              modelLoaded: modelExists,
              availableModels: data.models ? data.models.map(m => m.name) : []
            });
          } catch (e) {
            resolve({
              status: 'healthy',
              url: OLLAMA_URL,
              modelLoaded: false
            });
          }
        } else {
          reject(new Error(`Ollama health check failed: ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      if (error.code === 'ECONNREFUSED') {
        reject(new Error(`Cannot connect to Ollama at ${OLLAMA_URL}. Make sure Ollama is running: brew services start ollama`));
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
  processReceiptWithOllama,
  checkOllamaHealth,
  imageToBase64
};
