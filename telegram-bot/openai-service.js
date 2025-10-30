const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Парсит сообщение о создании похода в баню с помощью OpenAI Structured Outputs
 * @param {string} text - Текст сообщения от пользователя
 * @returns {Promise<{success: boolean, data?: Object, error?: string, missingFields?: string[]}>}
 */
async function parseSessionMessage(text) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Ты помощник для парсинга сообщений о походах в баню. Извлекай информацию о названии бани, дате, времени и общих расходах.

Правила:
- Дату конвертируй в формат DD.MM.YYYY (например, "4 ноября" → "04.11.2025")
- Время в формат HH:MM (например, "в 19-00" → "19:00")
- Если год не указан, используй текущий или следующий (если месяц уже прошел)
- Общие расходы должны включать название и цену в рублях
- Если информация не найдена или неоднозначна, оставь поле пустым или null
- Обращай внимание на контекст: "стол на X человек стоимостью Y" → общий расход "Бронь стола"`
        },
        {
          role: 'user',
          content: text
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'session_info',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              venueName: {
                type: ['string', 'null'],
                description: 'Название бани или места проведения'
              },
              date: {
                type: ['string', 'null'],
                description: 'Дата в формате DD.MM.YYYY'
              },
              time: {
                type: ['string', 'null'],
                description: 'Время в формате HH:MM'
              },
              commonExpenses: {
                type: 'array',
                description: 'Список общих расходов',
                items: {
                  type: 'object',
                  properties: {
                    name: {
                      type: 'string',
                      description: 'Название расхода'
                    },
                    price: {
                      type: 'number',
                      description: 'Цена в рублях'
                    }
                  },
                  required: ['name', 'price'],
                  additionalProperties: false
                }
              },
              confidence: {
                type: 'string',
                enum: ['high', 'medium', 'low'],
                description: 'Уровень уверенности в распознавании'
              }
            },
            required: ['venueName', 'date', 'time', 'commonExpenses', 'confidence'],
            additionalProperties: false
          }
        }
      },
      temperature: 0.3,
    });

    const result = JSON.parse(completion.choices[0].message.content);

    // Проверяем обязательные поля
    const missingFields = [];
    if (!result.venueName) missingFields.push('название бани');
    if (!result.date) missingFields.push('дата');
    if (!result.time) missingFields.push('время');

    return {
      success: true,
      data: result,
      missingFields: missingFields.length > 0 ? missingFields : null
    };

  } catch (error) {
    console.error('OpenAI parsing error:', error);
    return {
      success: false,
      error: error.message || 'Не удалось распознать информацию'
    };
  }
}

/**
 * Форматирует распознанную информацию для отображения пользователю
 */
function formatParsedSession(data) {
  let message = '🤖 Вот что я понял:\n\n';

  message += `🏛 Баня: ${data.venueName || '❓ не указано'}\n`;
  message += `📅 Дата: ${data.date || '❓ не указано'}\n`;
  message += `🕐 Время: ${data.time || '❓ не указано'}\n`;

  if (data.commonExpenses && data.commonExpenses.length > 0) {
    message += '\n💰 Общие расходы:\n';
    data.commonExpenses.forEach((expense, index) => {
      message += `  ${index + 1}. ${expense.name} — ${expense.price.toLocaleString('ru-RU')} ₽\n`;
    });
  } else {
    message += '\n💰 Общие расходы: нет\n';
  }

  return message;
}

module.exports = {
  parseSessionMessage,
  formatParsedSession
};
