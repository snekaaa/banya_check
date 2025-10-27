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
  sessionToLegacyFormat
} = require('./db-helpers');
require('./api-server'); // Запускаем API сервер
require('./websocket-server'); // Запускаем WebSocket сервер

const bot = new Telegraf(process.env.BOT_TOKEN);

// Состояния для FSM
const userStates = new Map();

// Временное хранилище для участников чата (пока оставим для совместимости)
const chatMembers = new Map();

// Web App URL (из .env)
const WEB_APP_URL = process.env.WEB_APP_URL;

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
    const session = await getSession(userState.sessionId);

    if (!session) {
      userStates.delete(ctx.from.id);
      return next();
    }

    // Обработка названия бани
    if (userState.action === 'waiting_venue_name') {
      await updateSession(session.id, { venueName: ctx.message.text });
      userStates.set(ctx.from.id, {
        action: 'waiting_date',
        sessionId: userState.sessionId
      });

      return await ctx.reply(
        `✅ Название: ${ctx.message.text}\n\n📅 Введите дату (например: "16 октября" или "16.10.2025"):`,
        Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', 'cancel')]])
      );
    }

    // Обработка даты
    if (userState.action === 'waiting_date') {
      await updateSession(session.id, { date: ctx.message.text });
      userStates.set(ctx.from.id, {
        action: 'waiting_time',
        sessionId: userState.sessionId
      });

      return await ctx.reply(
        `✅ Дата: ${ctx.message.text}\n\n🕐 Введите время (например: "18:00"):`,
        Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', 'cancel')]])
      );
    }

    // Обработка времени
    if (userState.action === 'waiting_time') {
      await updateSession(session.id, { time: ctx.message.text });
      userStates.delete(ctx.from.id);

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('👥 Выбрать участников', `select_participants_${session.id}`)],
        [Markup.button.callback('❌ Отмена', 'cancel')]
      ]);

      const updatedSession = await getSession(session.id);
      const sessionData = sessionToLegacyFormat(updatedSession);

      return await ctx.reply(
        `✅ Информация о походе:\n\n🏛 ${sessionData.venueName}\n📅 ${sessionData.date}\n🕐 ${sessionData.time}\n\nТеперь выберите участников:`,
        keyboard
      );
    }
  }

  return next();
});

// Команда /newbanya - создание нового похода
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
    const session = sessionToLegacyFormat(activeSessions[0]);
    const participantNames = session.participants.map(p => p.firstName || p.username).join(', ');

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('➕ Создать новый поход', 'create_new_session')]
    ]);

    return await ctx.reply(
      `ℹ️ Есть активный поход:\n\n🏛 ${session.venueName || 'Без названия'}\n📅 ${session.date || 'Дата не указана'} в ${session.time || '--:--'}\n👥 Участники: ${participantNames || 'не выбраны'}\n\n💡 Откройте меню (≡) чтобы запустить БаняСчет`,
      keyboard
    );
  }

  // Создаём новую сессию в БД
  const session = await createSession(ctx.chat.id, ctx.from.id);

  // Устанавливаем состояние для ввода названия бани
  userStates.set(ctx.from.id, {
    action: 'waiting_venue_name',
    sessionId: session.id
  });

  await ctx.reply(
    `🏛 Создание нового похода в баню\n\n📝 Введите название бани (например: "Жар птица"):`,
    Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', 'cancel')]])
  );
});

// Обработка кнопки выбора участников
bot.action(/select_participants_(.+)/, async (ctx) => {
  const sessionId = ctx.match[1];
  const session = await getSession(sessionId);

  if (!session) {
    return await ctx.answerCbQuery('❌ Сессия не найдена');
  }

  try {
    const chatId = Number(session.chatId);
    const members = chatMembers.get(chatId) || new Map();

    // Создаем кнопки с чекбоксами для каждого участника
    const memberButtons = [];
    const membersArray = Array.from(members.values());

    if (membersArray.length === 0) {
      await ctx.answerCbQuery('❌ Нет сохранённых участников. Напишите что-нибудь в чат, чтобы бот запомнил вас!');
      return;
    }

    const sessionData = sessionToLegacyFormat(session);

    // По 2 кнопки в ряд
    for (let i = 0; i < membersArray.length; i += 2) {
      const row = [];

      for (let j = 0; j < 2 && i + j < membersArray.length; j++) {
        const member = membersArray[i + j];
        const isSelected = sessionData.participants.some(p => p.id === member.id);
        const checkbox = isSelected ? '✅' : '☐';
        const name = member.firstName || member.username || 'User';

        row.push({
          text: `${checkbox} ${name}`,
          callback_data: `toggle_participant_${sessionId}_${member.id}`
        });
      }

      memberButtons.push(row);
    }

    // Добавляем кнопку "Готово"
    memberButtons.push([
      { text: '✅ Готово', callback_data: `finish_selection_${sessionId}` }
    ]);

    await ctx.editMessageText(
      `👥 Выберите участников:\n\nВыбрано: ${sessionData.participants.length}`,
      {
        reply_markup: {
          inline_keyboard: memberButtons
        }
      }
    );

    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error:', error);
    await ctx.answerCbQuery('❌ Произошла ошибка');
  }
});

// Обработка toggle участника
bot.action(/toggle_participant_(.+)_(.+)/, async (ctx) => {
  const sessionId = ctx.match[1];
  const memberId = parseInt(ctx.match[2]);
  const session = await getSession(sessionId);

  if (!session) {
    return await ctx.answerCbQuery('❌ Сессия не найдена');
  }

  try {
    const chatId = Number(session.chatId);
    const members = chatMembers.get(chatId) || new Map();
    const member = members.get(memberId);

    if (!member) {
      return await ctx.answerCbQuery('❌ Участник не найден');
    }

    // Создаем или получаем участника в БД
    const participant = await getOrCreateParticipant({
      id: member.id,
      username: member.username,
      first_name: member.firstName,
      last_name: member.lastName
    }, bot);

    const sessionData = sessionToLegacyFormat(session);
    const isSelected = sessionData.participants.some(p => p.id === memberId);

    if (isSelected) {
      // Убираем участника
      await removeParticipantFromSession(sessionId, participant.id);
    } else {
      // Добавляем участника
      await addParticipantToSession(sessionId, participant.id, 'member');
    }

    // Получаем обновленную сессию
    const updatedSession = await getSession(sessionId);
    const updatedSessionData = sessionToLegacyFormat(updatedSession);

    // Обновляем кнопки
    const memberButtons = [];
    const membersArray = Array.from(members.values());

    for (let i = 0; i < membersArray.length; i += 2) {
      const row = [];

      for (let j = 0; j < 2 && i + j < membersArray.length; j++) {
        const m = membersArray[i + j];
        const isSelectedNow = updatedSessionData.participants.some(p => p.id === m.id);
        const checkbox = isSelectedNow ? '✅' : '☐';
        const name = m.firstName || m.username || 'User';

        row.push({
          text: `${checkbox} ${name}`,
          callback_data: `toggle_participant_${sessionId}_${m.id}`
        });
      }

      memberButtons.push(row);
    }

    memberButtons.push([
      { text: '✅ Готово', callback_data: `finish_selection_${sessionId}` }
    ]);

    await ctx.editMessageText(
      `👥 Выберите участников:\n\nВыбрано: ${updatedSessionData.participants.length}`,
      {
        reply_markup: {
          inline_keyboard: memberButtons
        }
      }
    );

    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error:', error);
    await ctx.answerCbQuery('❌ Произошла ошибка');
  }
});

// Обработка кнопки "Готово" после выбора участников
bot.action(/finish_selection_(.+)/, async (ctx) => {
  const sessionId = ctx.match[1];
  const session = await getSession(sessionId);

  if (!session) {
    return await ctx.answerCbQuery('❌ Сессия не найдена');
  }

  const sessionData = sessionToLegacyFormat(session);

  if (sessionData.participants.length === 0) {
    return await ctx.answerCbQuery('❌ Выберите хотя бы одного участника!');
  }

  try {
    // Меняем статус на active
    await updateSession(sessionId, { status: 'active' });

    // Удаляем старое сообщение
    await ctx.deleteMessage();

    const participantNames = sessionData.participants.map(p => p.firstName || p.username).join(', ');

    // Создаём новое сообщение с инструкцией
    await ctx.reply(
      `✅ Поход создан!\n\n🏛 ${sessionData.venueName}\n📅 ${sessionData.date} в ${sessionData.time}\n👥 Участники (${sessionData.participants.length}): ${participantNames}\n\n💡 Откройте меню (≡) чтобы запустить БаняСчет`
    );

    await ctx.answerCbQuery('✅ Участники сохранены!');
  } catch (error) {
    console.error('Error:', error);
    await ctx.answerCbQuery('❌ Произошла ошибка');
  }
});

// Обработка кнопки "Создать новый поход"
bot.action('create_new_session', async (ctx) => {
  // Создаём новую сессию в БД
  const session = await createSession(ctx.chat.id, ctx.from.id);

  // Устанавливаем состояние для ввода названия бани
  userStates.set(ctx.from.id, {
    action: 'waiting_venue_name',
    sessionId: session.id
  });

  await ctx.editMessageText(
    `🏛 Создание нового похода в баню\n\n📝 Введите название бани (например: "Жар птица"):`,
    Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', 'cancel')]])
  );

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
bot.launch().then(async () => {
  console.log('🤖 Бот запущен!');
  console.log('Используйте Ctrl+C для остановки');

  // Устанавливаем кнопку меню с Web App
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
