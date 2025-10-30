require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const {
  getOrCreateParticipant,
  createSession,
  getSession,
  updateSession,
  addParticipantToSession,
  removeParticipantFromSession,
  getActiveSessionsForChat,
  sessionToLegacyFormat,
  updateAttendanceStatus,
  getParticipantsByStatus
} = require('./db-helpers');
const { parseSessionMessage, formatParsedSession } = require('./openai-service');
const prisma = require('./prisma-client');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Запускаем API и WebSocket серверы ПОСЛЕ создания бота
setImmediate(() => {
  require('./api-server'); // Запускаем API сервер
  require('./websocket-server'); // Запускаем WebSocket сервер
});

// Состояния для FSM
const userStates = new Map();

// Временное хранилище для участников чата (пока оставим для совместимости)
const chatMembers = new Map();

// Web App URL (из .env)
const WEB_APP_URL = process.env.WEB_APP_URL;

/**
 * Форматировать сообщение регистрации участников
 */
async function formatRegistrationMessage(sessionId) {
  const session = await getSession(sessionId);
  if (!session) return null;

  const participants = await getParticipantsByStatus(sessionId);

  let message = `🏛 ${session.venueName || 'Поход в баню'}\n`;
  message += `📅 ${session.date || 'Дата не указана'} в ${session.time || '--:--'}\n\n`;

  // Точно идут
  if (participants.going.length > 0) {
    message += `🟢 Точно идут (${participants.going.length}):\n`;
    participants.going.forEach(p => {
      const name = p.participant.firstName || p.participant.username || 'Аноним';
      message += `  • ${name}\n`;
    });
    message += '\n';
  }

  // Еще думают
  if (participants.maybe.length > 0) {
    message += `🟡 Еще думают (${participants.maybe.length}):\n`;
    participants.maybe.forEach(p => {
      const name = p.participant.firstName || p.participant.username || 'Аноним';
      message += `  • ${name}\n`;
    });
    message += '\n';
  }

  // Не идут
  if (participants.notGoing.length > 0) {
    message += `🔴 Не идут (${participants.notGoing.length}):\n`;
    participants.notGoing.forEach(p => {
      const name = p.participant.firstName || p.participant.username || 'Аноним';
      message += `  • ${name}\n`;
    });
    message += '\n';
  }

  if (participants.going.length === 0 && participants.maybe.length === 0 && participants.notGoing.length === 0) {
    message += '👥 Пока никто не зарегистрировался\n\n';
  }

  message += '💬 Выберите свой статус:';

  return message;
}

// Команда /start
bot.command('start', async (ctx) => {
  const welcomeMessage = `👋 Привет! Я бот для учета походов в баню.

Доступные команды:
/newbanya - создать новый поход в баню
/help - помощь

💡 Откройте меню (≡) чтобы запустить приложение`;

  await ctx.reply(welcomeMessage);
});

// Команда /help
bot.command('help', async (ctx) => {
  await ctx.reply(`Как пользоваться ботом:

1. Добавьте меня в групповой чат
2. Дайте мне права администратора
3. Используйте /newbanya чтобы создать новый поход
4. Выберите участников из чата
5. Нажмите кнопку меню (≡) и откройте БаняСчет`);
});

// Обработка текстовых сообщений (для FSM)
bot.on('text', async (ctx, next) => {
  const userState = userStates.get(ctx.from.id);

  // Сохраняем участников чата
  if (ctx.chat.type !== 'private' && ctx.from) {
    const chatId = ctx.chat.id;
    if (!chatMembers.has(chatId)) {
      chatMembers.set(chatId, new Map());
    }

    const members = chatMembers.get(chatId);
    members.set(ctx.from.id, {
      id: ctx.from.id,
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name
    });
  }

  // Если есть активное состояние FSM
  if (userState) {
    // Обработка описания сессии через AI (сессия создается внутри)
    if (userState.action === 'waiting_session_description') {
      const messageText = ctx.message.text;
      const loadingMsg = await ctx.reply('🤖 Анализирую сообщение...');

      try {
        // Создаём новую сессию в БД
        const session = await createSession(userState.chatId, ctx.from.id);

        // Парсим сообщение с помощью AI
        const result = await parseSessionMessage(messageText);

        if (!result.success) {
          await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
          return await ctx.reply(
            `❌ Не удалось распознать информацию: ${result.error}\n\nПопробуйте описать поход подробнее.`
          );
        }

        // Удаляем сообщение о загрузке
        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);

        // Сохраняем распознанные данные во временное состояние
        userStates.set(ctx.from.id, {
          action: 'confirming_parsed_data',
          sessionId: session.id,
          parsedData: result.data
        });

        // Формируем сообщение с результатом
        const formattedMessage = formatParsedSession(result.data);

        // Если есть недостающие поля, предупреждаем
        let warningText = '';
        if (result.missingFields && result.missingFields.length > 0) {
          warningText = `\n⚠️ Не удалось распознать: ${result.missingFields.join(', ')}\n`;
        }

        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('✅ Подтвердить', `confirm_session_${session.id}`)],
          [Markup.button.callback('✏️ Редактировать', `edit_session_${session.id}`)],
          [Markup.button.callback('❌ Отмена', 'cancel')]
        ]);

        return await ctx.reply(
          formattedMessage + warningText + '\n❓ Всё верно?',
          keyboard
        );
      } catch (error) {
        console.error('Error parsing session:', error);
        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
        return await ctx.reply('❌ Произошла ошибка при обработке сообщения. Попробуйте ещё раз.');
      }
    }

    // Для остальных actions проверяем существование сессии
    if (userState.action.startsWith('editing_') || userState.action === 'confirming_parsed_data') {
      const session = await getSession(userState.sessionId);
      if (!session) {
        userStates.delete(ctx.from.id);
        return next();
      }
    }

    // Обработка редактирования отдельных полей
    if (userState.action === 'editing_venue_name') {
      userState.parsedData.venueName = ctx.message.text;
      userStates.set(ctx.from.id, {
        action: 'confirming_parsed_data',
        sessionId: userState.sessionId,
        parsedData: userState.parsedData
      });

      const formattedMessage = formatParsedSession(userState.parsedData);
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✅ Подтвердить', `confirm_session_${userState.sessionId}`)],
        [Markup.button.callback('✏️ Редактировать', `edit_session_${userState.sessionId}`)],
        [Markup.button.callback('❌ Отмена', 'cancel')]
      ]);

      return await ctx.reply(
        formattedMessage + '\n❓ Всё верно?',
        keyboard
      );
    }

    if (userState.action === 'editing_date') {
      userState.parsedData.date = ctx.message.text;
      userStates.set(ctx.from.id, {
        action: 'confirming_parsed_data',
        sessionId: userState.sessionId,
        parsedData: userState.parsedData
      });

      const formattedMessage = formatParsedSession(userState.parsedData);
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✅ Подтвердить', `confirm_session_${userState.sessionId}`)],
        [Markup.button.callback('✏️ Редактировать', `edit_session_${userState.sessionId}`)],
        [Markup.button.callback('❌ Отмена', 'cancel')]
      ]);

      return await ctx.reply(
        formattedMessage + '\n❓ Всё верно?',
        keyboard
      );
    }

    if (userState.action === 'editing_time') {
      userState.parsedData.time = ctx.message.text;
      userStates.set(ctx.from.id, {
        action: 'confirming_parsed_data',
        sessionId: userState.sessionId,
        parsedData: userState.parsedData
      });

      const formattedMessage = formatParsedSession(userState.parsedData);
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✅ Подтвердить', `confirm_session_${userState.sessionId}`)],
        [Markup.button.callback('✏️ Редактировать', `edit_session_${userState.sessionId}`)],
        [Markup.button.callback('❌ Отмена', 'cancel')]
      ]);

      return await ctx.reply(
        formattedMessage + '\n❓ Всё верно?',
        keyboard
      );
    }
  }

  return next();
});

// Команда /newbanya - создание нового похода с AI парсингом
bot.command('newbanya', async (ctx) => {
  // Проверяем, что команда вызвана в группе
  if (ctx.chat.type === 'private') {
    return await ctx.reply('❌ Эту команду можно использовать только в групповом чате!');
  }

  // Проверяем права администратора
  const member = await ctx.getChatMember(ctx.from.id);
  if (!['creator', 'administrator'].includes(member.status)) {
    return await ctx.reply('❌ Только администраторы могут создавать походы в баню!');
  }

  // Проверяем активные походы из БД
  const activeSessions = await getActiveSessionsForChat(ctx.chat.id);

  if (activeSessions.length > 0) {
    const sessionId = activeSessions[0].id;

    // Используем общую функцию форматирования
    const message = await formatRegistrationMessage(sessionId);

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('🟢 Точно иду', `status_going_${sessionId}`),
        Markup.button.callback('🟡 Думаю', `status_maybe_${sessionId}`)
      ],
      [
        Markup.button.callback('🔴 Не иду', `status_not_going_${sessionId}`)
      ],
      [
        Markup.button.url('🚀 Открыть БаняСчет', `https://t.me/banya_schet_bot/banya_check?startapp=${sessionId}`)
      ],
      [
        Markup.button.callback('➕ Создать новый поход', 'create_new_session')
      ]
    ]);

    return await ctx.reply(message, keyboard);
  }

  // Получаем текст после команды
  const messageText = ctx.message.text.replace('/newbanya', '').trim();

  if (!messageText) {
    return await ctx.reply(
      `🏛 Создание нового похода в баню\n\n💬 Опишите поход одним сообщением.\n\nНапример:\n"Собираемся 4 ноября в 19-00 в Варшавские бани. Забронирован стол на 12 человек. Стоимость стола 20 тыс руб."\n\n📝 Просто отправьте описание в ответ на это сообщение:`,
      Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', 'cancel')]])
    );
  }

  // Создаём новую сессию в БД (в статусе draft)
  const session = await createSession(ctx.chat.id, ctx.from.id);

  // Показываем индикатор загрузки
  const loadingMsg = await ctx.reply('🤖 Анализирую сообщение...');

  try {
    // Парсим сообщение с помощью AI
    const result = await parseSessionMessage(messageText);

    if (!result.success) {
      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
      return await ctx.reply(
        `❌ Не удалось распознать информацию: ${result.error}\n\nПопробуйте описать поход подробнее.`
      );
    }

    // Удаляем сообщение о загрузке
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);

    // Сохраняем распознанные данные во временное состояние
    userStates.set(ctx.from.id, {
      action: 'confirming_parsed_data',
      sessionId: session.id,
      parsedData: result.data
    });

    // Формируем сообщение с результатом
    const formattedMessage = formatParsedSession(result.data);

    // Если есть недостающие поля, предупреждаем
    let warningText = '';
    if (result.missingFields && result.missingFields.length > 0) {
      warningText = `\n⚠️ Не удалось распознать: ${result.missingFields.join(', ')}\n`;
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('✅ Подтвердить', `confirm_session_${session.id}`)],
      [Markup.button.callback('✏️ Редактировать', `edit_session_${session.id}`)],
      [Markup.button.callback('❌ Отмена', 'cancel')]
    ]);

    await ctx.reply(
      formattedMessage + warningText + '\n❓ Всё верно?',
      keyboard
    );

  } catch (error) {
    console.error('Error parsing session:', error);
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
    await ctx.reply('❌ Произошла ошибка при обработке сообщения. Попробуйте ещё раз.');
  }
});

// Обработка кнопок выбора статуса
bot.action(/status_(going|maybe|not_going)_(.+)/, async (ctx) => {
  const status = ctx.match[1];
  const sessionId = ctx.match[2];

  try {
    const session = await getSession(sessionId);
    if (!session) {
      return await ctx.answerCbQuery('❌ Сессия не найдена');
    }

    // Создаем или получаем участника
    const participant = await getOrCreateParticipant({
      id: ctx.from.id,
      username: ctx.from.username,
      first_name: ctx.from.first_name,
      last_name: ctx.from.last_name
    }, bot);

    // Обновляем статус участия
    await updateAttendanceStatus(sessionId, ctx.from.id, status);

    // Обновляем сообщение
    const updatedMessage = await formatRegistrationMessage(sessionId);

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('🟢 Точно иду', `status_going_${sessionId}`),
        Markup.button.callback('🟡 Думаю', `status_maybe_${sessionId}`)
      ],
      [
        Markup.button.callback('🔴 Не иду', `status_not_going_${sessionId}`)
      ],
      [
        Markup.button.url('🚀 Открыть БаняСчет', `https://t.me/banya_schet_bot/banya_check?startapp=${sessionId}`)
      ]
    ]);

    await ctx.editMessageText(updatedMessage, keyboard);

    const statusText = {
      'going': '✅ Вы в списке!',
      'maybe': '🟡 Вы в раздумьях',
      'not_going': '❌ Вы не идете'
    };

    await ctx.answerCbQuery(statusText[status] || '✅ Статус обновлен');
  } catch (error) {
    console.error('Error updating attendance status:', error);
    await ctx.answerCbQuery('❌ Произошла ошибка');
  }
});

// Обработка кнопки "Подтвердить" для созданной AI сессии
bot.action(/confirm_session_(.+)/, async (ctx) => {
  const sessionId = ctx.match[1];
  const userState = userStates.get(ctx.from.id);

  if (!userState || userState.action !== 'confirming_parsed_data' || userState.sessionId !== sessionId) {
    return await ctx.answerCbQuery('❌ Сессия не найдена или устарела');
  }

  try {
    const session = await getSession(sessionId);
    if (!session) {
      userStates.delete(ctx.from.id);
      return await ctx.answerCbQuery('❌ Сессия не найдена');
    }

    const parsedData = userState.parsedData;

    // Обновляем сессию данными
    await updateSession(sessionId, {
      venueName: parsedData.venueName || 'Название не указано',
      date: parsedData.date || null,
      time: parsedData.time || null,
      status: 'active' // Сразу делаем активной
    });

    // Добавляем общие расходы
    if (parsedData.commonExpenses && parsedData.commonExpenses.length > 0) {
      for (const expense of parsedData.commonExpenses) {
        await prisma.checkItem.create({
          data: {
            sessionId: sessionId,
            name: expense.name,
            price: expense.price,
            quantity: 1,
            isCommon: true,
          }
        });
      }
    }

    // Очищаем состояние
    userStates.delete(ctx.from.id);

    // Удаляем старое сообщение
    await ctx.deleteMessage();

    // Отправляем сообщение с регистрацией в группу
    const chatId = Number(session.chatId);
    const registrationMessage = await formatRegistrationMessage(sessionId);

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('🟢 Точно иду', `status_going_${sessionId}`),
        Markup.button.callback('🟡 Думаю', `status_maybe_${sessionId}`)
      ],
      [
        Markup.button.callback('🔴 Не иду', `status_not_going_${sessionId}`)
      ],
      [
        Markup.button.url('🚀 Открыть БаняСчет', `https://t.me/banya_schet_bot/banya_check?startapp=${sessionId}`)
      ]
    ]);

    const sentMessage = await bot.telegram.sendMessage(chatId, registrationMessage, keyboard);

    // Сохраняем ID сообщения для последующих обновлений
    await updateSession(sessionId, {
      registrationMessageId: sentMessage.message_id
    });

    await ctx.answerCbQuery('✅ Поход создан! Участники могут регистрироваться.');

  } catch (error) {
    console.error('Error confirming session:', error);
    await ctx.answerCbQuery('❌ Произошла ошибка при создании сессии');
  }
});

// Обработка кнопки "Редактировать"
bot.action(/edit_session_(.+)/, async (ctx) => {
  const sessionId = ctx.match[1];
  const userState = userStates.get(ctx.from.id);

  if (!userState || userState.action !== 'confirming_parsed_data' || userState.sessionId !== sessionId) {
    return await ctx.answerCbQuery('❌ Сессия не найдена или устарела');
  }

  const parsedData = userState.parsedData;

  // Формируем кнопки для редактирования
  const buttons = [];

  if (!parsedData.venueName) {
    buttons.push([Markup.button.callback('📝 Добавить название бани', `edit_venue_${sessionId}`)]);
  } else {
    buttons.push([Markup.button.callback(`✏️ Название: ${parsedData.venueName}`, `edit_venue_${sessionId}`)]);
  }

  if (!parsedData.date) {
    buttons.push([Markup.button.callback('📝 Добавить дату', `edit_date_${sessionId}`)]);
  } else {
    buttons.push([Markup.button.callback(`✏️ Дата: ${parsedData.date}`, `edit_date_${sessionId}`)]);
  }

  if (!parsedData.time) {
    buttons.push([Markup.button.callback('📝 Добавить время', `edit_time_${sessionId}`)]);
  } else {
    buttons.push([Markup.button.callback(`✏️ Время: ${parsedData.time}`, `edit_time_${sessionId}`)]);
  }

  buttons.push([Markup.button.callback('◀️ Назад', `back_to_confirm_${sessionId}`)]);

  const keyboard = Markup.inlineKeyboard(buttons);

  await ctx.editMessageText(
    '✏️ Выберите, что хотите изменить:',
    keyboard
  );
  await ctx.answerCbQuery();
});

// Обработчики кнопок редактирования отдельных полей
bot.action(/edit_venue_(.+)/, async (ctx) => {
  const sessionId = ctx.match[1];
  const userState = userStates.get(ctx.from.id);

  if (!userState || userState.sessionId !== sessionId) {
    return await ctx.answerCbQuery('❌ Сессия не найдена');
  }

  userStates.set(ctx.from.id, {
    action: 'editing_venue_name',
    sessionId: sessionId,
    parsedData: userState.parsedData
  });

  await ctx.editMessageText(
    '📝 Введите новое название бани:',
    Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', 'cancel')]])
  );
  await ctx.answerCbQuery();
});

bot.action(/edit_date_(.+)/, async (ctx) => {
  const sessionId = ctx.match[1];
  const userState = userStates.get(ctx.from.id);

  if (!userState || userState.sessionId !== sessionId) {
    return await ctx.answerCbQuery('❌ Сессия не найдена');
  }

  userStates.set(ctx.from.id, {
    action: 'editing_date',
    sessionId: sessionId,
    parsedData: userState.parsedData
  });

  await ctx.editMessageText(
    '📅 Введите новую дату (например: "04.11.2025" или "4 ноября"):',
    Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', 'cancel')]])
  );
  await ctx.answerCbQuery();
});

bot.action(/edit_time_(.+)/, async (ctx) => {
  const sessionId = ctx.match[1];
  const userState = userStates.get(ctx.from.id);

  if (!userState || userState.sessionId !== sessionId) {
    return await ctx.answerCbQuery('❌ Сессия не найдена');
  }

  userStates.set(ctx.from.id, {
    action: 'editing_time',
    sessionId: sessionId,
    parsedData: userState.parsedData
  });

  await ctx.editMessageText(
    '🕐 Введите новое время (например: "19:00"):',
    Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', 'cancel')]])
  );
  await ctx.answerCbQuery();
});

bot.action(/back_to_confirm_(.+)/, async (ctx) => {
  const sessionId = ctx.match[1];
  const userState = userStates.get(ctx.from.id);

  if (!userState || userState.sessionId !== sessionId) {
    return await ctx.answerCbQuery('❌ Сессия не найдена');
  }

  userStates.set(ctx.from.id, {
    action: 'confirming_parsed_data',
    sessionId: sessionId,
    parsedData: userState.parsedData
  });

  const formattedMessage = formatParsedSession(userState.parsedData);
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('✅ Подтвердить', `confirm_session_${sessionId}`)],
    [Markup.button.callback('✏️ Редактировать', `edit_session_${sessionId}`)],
    [Markup.button.callback('❌ Отмена', 'cancel')]
  ]);

  await ctx.editMessageText(
    formattedMessage + '\n❓ Всё верно?',
    keyboard
  );
  await ctx.answerCbQuery();
});


// Обработка кнопки "Создать новый поход"
bot.action('create_new_session', async (ctx) => {
  await ctx.editMessageText(
    `🏛 Создание нового похода в баню\n\n💬 Опишите поход одним сообщением.\n\nНапример:\n"Собираемся 4 ноября в 19-00 в Варшавские бани. Забронирован стол на 12 человек. Стоимость стола 20 тыс руб."\n\n📝 Просто отправьте описание следующим сообщением:`,
    Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', 'cancel')]])
  );

  // Устанавливаем состояние ожидания описания
  userStates.set(ctx.from.id, {
    action: 'waiting_session_description',
    chatId: ctx.chat.id
  });

  await ctx.answerCbQuery();
});

// Обработка кнопки отмены
bot.action('cancel', async (ctx) => {
  await ctx.deleteMessage();
  await ctx.answerCbQuery('Отменено');
});

// Обработка кнопки "Назад"
bot.action('back', async (ctx) => {
  await ctx.answerCbQuery('Назад');
  await ctx.editMessageText('Используйте /newbanya для создания нового похода');
});

// Обработка кнопки "Готово"
bot.action('finish', async (ctx) => {
  await ctx.answerCbQuery('✅ Сессия создана!');
  await ctx.editMessageText('✅ Сессия создана! Используйте /newbanya для создания нового похода');
});

// Обработка ошибок
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
});

// Запуск бота
console.log('🔄 Запускаем бота...');

// Устанавливаем кнопку меню и запускаем бота
(async () => {
  try {
    await bot.telegram.setChatMenuButton({
      menuButton: {
        type: 'web_app',
        text: 'БаняСчет',
        web_app: { url: WEB_APP_URL }
      }
    });
    console.log('✅ Кнопка меню установлена!');
    console.log(`📱 Web App URL: ${WEB_APP_URL}`);
  } catch (error) {
    console.error('❌ Ошибка установки кнопки меню:', error);
  }

  // Запускаем бота (не ждем завершения, т.к. это long polling)
  bot.launch();
  console.log('🤖 Бот запущен в режиме long polling!');
  console.log('Используйте Ctrl+C для остановки');
})().catch((error) => {
  console.error('❌ Ошибка:', error);
  process.exit(1);
});

// Graceful stop
process.once('SIGINT', () => {
  console.log('\n👋 Останавливаем бота...');
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  console.log('\n👋 Останавливаем бота...');
  bot.stop('SIGTERM');
});
