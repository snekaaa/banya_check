const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const https = require('https');

const TABSCANNER_API_KEY = process.env.TABSCANNER_API_KEY;
const TABSCANNER_BASE_URL = 'https://api.tabscanner.com';

/**
 * Загружает фото чека в TabScanner для обработки
 * @param {string} filePath - путь к файлу
 * @returns {Promise<{token: string, duplicate: boolean}>}
 */
async function uploadReceiptToTabScanner(filePath) {
  if (!TABSCANNER_API_KEY) {
    throw new Error('TABSCANNER_API_KEY is not set in environment variables');
  }

  // Проверяем, что файл существует
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Получаем информацию о файле
  const fileStats = fs.statSync(filePath);
  const fileName = path.basename(filePath);

  console.log(`📤 Uploading file to TabScanner: ${fileName} (${fileStats.size} bytes)`);

  return new Promise((resolve, reject) => {
    const formData = new FormData();

    // Добавляем файл в form-data
    formData.append('file', fs.createReadStream(filePath));

    // Опциональные параметры для лучшего распознавания
    formData.append('documentType', 'receipt');

    // Отправляем запрос используя встроенный метод form.submit()
    formData.submit({
      host: 'api.tabscanner.com',
      path: '/api/2/process',
      protocol: 'https:',
      headers: {
        'apikey': TABSCANNER_API_KEY
      }
    }, (err, res) => {
      if (err) {
        console.error('❌ Error uploading to TabScanner:', err.message);
        reject(err);
        return;
      }

      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log('📥 TabScanner response status:', res.statusCode);
        console.log('📥 TabScanner response:', body);

        try {
          const data = JSON.parse(body);

          if (res.statusCode !== 200) {
            reject(new Error(`TabScanner API error (${res.statusCode}): ${data.message || body}`));
            return;
          }

          if (data.status !== 'success') {
            reject(new Error(`TabScanner processing failed: ${data.message || data.status || 'Unknown error'}`));
            return;
          }

          console.log('✅ TabScanner upload successful, token:', data.token);

          resolve({
            token: data.token,
            duplicate: data.duplicate || false,
          });
        } catch (error) {
          reject(new Error(`Failed to parse TabScanner response: ${body}`));
        }
      });

      res.on('error', (error) => {
        console.error('❌ Response error:', error.message);
        reject(error);
      });
    });
  });
}

/**
 * Получает результаты распознавания чека по токену
 * @param {string} token - токен от TabScanner
 * @returns {Promise<Object>} - результат распознавания
 */
async function getReceiptResult(token) {
  if (!TABSCANNER_API_KEY) {
    throw new Error('TABSCANNER_API_KEY is not set in environment variables');
  }

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.tabscanner.com',
      path: `/api/result/${token}`,
      method: 'GET',
      headers: {
        'apikey': TABSCANNER_API_KEY,
      }
    };

    const req = https.request(options, (res) => {
      let body = '';

      res.on('data', chunk => body += chunk);

      res.on('end', () => {
        try {
          const data = JSON.parse(body);

          if (res.statusCode !== 200) {
            reject(new Error(`TabScanner API error (${res.statusCode}): ${data.message || body}`));
            return;
          }

          // Если еще обрабатывается
          if (data.status === 'processing') {
            resolve({ status: 'processing' });
            return;
          }

          // Если успешно завершено - возвращаем результат
          // API может вернуть status: 'success' или просто иметь поле result
          if (data.status === 'success' || data.result) {
            resolve(data.result || data);
            return;
          }

          // Если статус не success и нет result - это ошибка
          reject(new Error(`TabScanner result failed: ${data.message || data.status || 'Unknown error'}`));
        } catch (error) {
          reject(new Error(`Failed to parse TabScanner response: ${body}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('Error fetching TabScanner result:', error);
      reject(error);
    });

    req.end();
  });
}

/**
 * Преобразует lineItems из TabScanner в формат CheckItem
 * @param {Array} lineItems - массив позиций из TabScanner
 * @returns {Array} - массив в формате CheckItem
 */
function parseLineItemsToCheckItems(lineItems) {
  if (!lineItems || !Array.isArray(lineItems)) {
    return [];
  }

  return lineItems
    .filter(item => {
      // Фильтруем итоговые строки (Total, SubTotal, Tax и т.д.)
      return !item.lineType || item.lineType === 'Product';
    })
    .map(item => {
      const name = item.descClean || item.desc || 'Неизвестная позиция';
      const quantity = item.qty || 1;
      const lineTotal = item.lineTotal || 0;
      const price = item.price || (lineTotal / quantity);

      return {
        name: name.trim(),
        price: Math.max(0, price), // не может быть отрицательной
        quantity: Math.max(1, quantity), // минимум 1
        isCommon: false, // по умолчанию не общая позиция
      };
    })
    .filter(item => item.price > 0); // убираем позиции с нулевой ценой
}

/**
 * Проверяет оставшиеся кредиты на аккаунте TabScanner
 * @returns {Promise<number>} - количество кредитов
 */
async function getCredits() {
  if (!TABSCANNER_API_KEY) {
    throw new Error('TABSCANNER_API_KEY is not set in environment variables');
  }

  try {
    const response = await fetch(`${TABSCANNER_BASE_URL}/credit`, {
      method: 'GET',
      headers: {
        'apikey': TABSCANNER_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch credits');
    }

    const credits = await response.json();
    return credits;
  } catch (error) {
    console.error('Error fetching TabScanner credits:', error);
    throw error;
  }
}

module.exports = {
  uploadReceiptToTabScanner,
  getReceiptResult,
  parseLineItemsToCheckItems,
  getCredits,
};
