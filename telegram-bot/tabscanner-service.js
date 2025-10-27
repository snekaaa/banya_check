const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

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

  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));

  // Опциональные параметры для лучшего распознавания
  formData.append('documentType', 'receipt');
  formData.append('region', 'ru'); // русский регион

  try {
    const response = await fetch(`${TABSCANNER_BASE_URL}/api/2/process`, {
      method: 'POST',
      headers: {
        'apikey': TABSCANNER_API_KEY,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`TabScanner API error: ${errorData.message || response.statusText}`);
    }

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error(`TabScanner processing failed: ${data.message || 'Unknown error'}`);
    }

    return {
      token: data.result.token,
      duplicate: data.result.duplicate || false,
    };
  } catch (error) {
    console.error('Error uploading to TabScanner:', error);
    throw error;
  }
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

  try {
    const response = await fetch(`${TABSCANNER_BASE_URL}/api/result/${token}`, {
      method: 'GET',
      headers: {
        'apikey': TABSCANNER_API_KEY,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`TabScanner API error: ${errorData.message || response.statusText}`);
    }

    const data = await response.json();

    if (data.status === 'processing') {
      return { status: 'processing' };
    }

    if (data.status !== 'success') {
      throw new Error(`TabScanner result failed: ${data.message || 'Unknown error'}`);
    }

    return data.result;
  } catch (error) {
    console.error('Error fetching TabScanner result:', error);
    throw error;
  }
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
