const fs = require('fs');
const path = require('path');
const https = require('https');

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const RUNPOD_ENDPOINT_URL = process.env.RUNPOD_ENDPOINT_URL || 'https://api.runpod.ai/v2/7by67cgqfd6wyb/run';

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
 * Опрашивает RunPod API для получения результатов задания
 * @param {string} jobId - ID задания в RunPod
 * @returns {Promise<Object>} - результат выполнения
 */
async function pollJobStatus(jobId) {
  const maxAttempts = 120; // максимум 120 попыток (4 минуты при интервале в 2 секунды)
  const pollInterval = 2000; // 2 секунды между попытками

  const statusUrl = RUNPOD_ENDPOINT_URL.replace('/run', `/status/${jobId}`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    console.log(`🔄 Polling attempt ${attempt}/${maxAttempts}...`);

    const result = await new Promise((resolve, reject) => {
      const url = new URL(statusUrl);

      const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${RUNPOD_API_KEY}`,
        }
      };

      const req = https.request(options, (res) => {
        let body = '';

        res.on('data', chunk => body += chunk);

        res.on('end', () => {
          try {
            const data = JSON.parse(body);

            if (res.statusCode !== 200) {
              reject(new Error(`Status check failed (${res.statusCode}): ${body}`));
              return;
            }

            resolve(data);
          } catch (error) {
            reject(new Error(`Failed to parse status response: ${body}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });

    console.log(`📊 Job status: ${result.status}`);

    // Если задание завершено (успешно или с ошибкой)
    if (result.status === 'COMPLETED' || result.status === 'FAILED') {
      return result;
    }

    // Продолжаем опрос если статус IN_QUEUE или IN_PROGRESS
  }

  throw new Error(`Job polling timeout after ${maxAttempts} attempts`);
}

/**
 * Обрабатывает чек через RunPod vLLM endpoint (Qwen3-VL-8B-Instruct)
 * @param {string} filePath - путь к файлу с чеком
 * @returns {Promise<{items: Array, rawData: Object}>}
 */
async function processReceiptWithRunPod(filePath) {
  if (!RUNPOD_API_KEY) {
    throw new Error('RUNPOD_API_KEY is not set in environment variables');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const fileStats = fs.statSync(filePath);
  const fileName = path.basename(filePath);

  console.log(`📤 Processing receipt with RunPod vLLM: ${fileName} (${fileStats.size} bytes)`);

  // Конвертируем изображение в base64
  const base64Image = imageToBase64(filePath);

  // Формируем запрос в OpenAI-compatible формате для vision модели Qwen3-VL-8B-Instruct
  // vLLM поддерживает OpenAI Chat Completions API формат
  const requestBody = {
    input: {
      model: "Qwen/Qwen3-VL-8B-Instruct",
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
              text: "Extract all items from this receipt. Return a JSON array with this exact format: [{\"name\":\"Product Name\",\"price\":10.5,\"quantity\":1}]. Rules: 1) Extract EVERY product/item from the receipt, 2) Skip total/subtotal/tax lines, 3) Return ONLY valid JSON array, no markdown code blocks or explanations."
            }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.1
    }
  };

  // Используем асинхронный /run endpoint
  const endpointUrl = RUNPOD_ENDPOINT_URL;

  return new Promise((resolve, reject) => {
    const url = new URL(endpointUrl);
    const requestData = JSON.stringify(requestBody);

    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RUNPOD_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData)
      },
      timeout: 120000 // 2 минуты timeout
    };

    console.log(`🔄 Sending async request to RunPod: ${endpointUrl}`);

    const req = https.request(options, (res) => {
      let body = '';

      res.on('data', chunk => body += chunk);

      res.on('end', async () => {
        console.log('📥 RunPod response status:', res.statusCode);

        try {
          const data = JSON.parse(body);

          if (res.statusCode !== 200) {
            console.error('❌ RunPod API error response:', body);
            reject(new Error(`RunPod API error (${res.statusCode}): ${data.error || data.message || body}`));
            return;
          }

          console.log('📥 RunPod response:', JSON.stringify(data, null, 2));

          // Для асинхронного endpoint получаем job ID
          const jobId = data.id;

          if (!jobId) {
            reject(new Error('No job ID returned from RunPod'));
            return;
          }

          console.log(`⏳ Job submitted, ID: ${jobId}. Polling for results...`);

          // Poll для результатов
          try {
            const result = await pollJobStatus(jobId);

            // Проверяем статус выполнения
            if (result.status === 'FAILED') {
              reject(new Error(`RunPod job failed: ${result.error || 'Unknown error'}`));
              return;
            }

            if (result.status !== 'COMPLETED') {
              reject(new Error(`RunPod job not completed: ${result.status}`));
              return;
            }

            // Извлекаем результат из output
            const output = result.output;

          if (!output) {
            reject(new Error('No output from RunPod'));
            return;
          }

          // Парсим результат (output может быть строкой или объектом)
          let items = [];

          try {
            // Если output это объект с choices (OpenAI формат)
            if (output.choices && Array.isArray(output.choices) && output.choices.length > 0) {
              const messageContent = output.choices[0].message?.content || '';
              console.log('📝 Model response:', messageContent);

              // Извлекаем JSON из текста (может быть в markdown блоке)
              const jsonMatch = messageContent.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                items = JSON.parse(jsonMatch[0]);
              } else {
                items = JSON.parse(messageContent);
              }
            }
            // Если output это строка с JSON
            else if (typeof output === 'string') {
              const jsonMatch = output.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                items = JSON.parse(jsonMatch[0]);
              } else {
                items = JSON.parse(output);
              }
            }
            // Если output уже массив
            else if (Array.isArray(output)) {
              items = output;
            }
          } catch (parseError) {
            console.error('❌ Failed to parse items from output:', parseError.message);
            console.error('Output was:', output);
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
              rawData: result
            });

          } catch (pollError) {
            reject(pollError);
          }

        } catch (error) {
          console.error('❌ Error parsing RunPod response:', error.message);
          reject(new Error(`Failed to parse RunPod response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request error:', error.message);
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('RunPod request timeout'));
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
 * Тестовая функция для проверки работы RunPod endpoint
 * @returns {Promise<Object>} - информация о статусе сервиса
 */
async function testRunPodConnection() {
  if (!RUNPOD_API_KEY) {
    return {
      status: 'error',
      message: 'RUNPOD_API_KEY is not set'
    };
  }

  return {
    status: 'ready',
    endpoint: RUNPOD_ENDPOINT_URL,
    apiKeySet: true
  };
}

module.exports = {
  processReceiptWithRunPod,
  testRunPodConnection,
  imageToBase64
};
