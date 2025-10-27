const prisma = require('./prisma-client');

// Цвета для аватарок участников
const COLORS = [
  '#FF6B6B', '#4ECDC4', '#FFD93D', '#95E1D3',
  '#A8E6CF', '#FFB6C1', '#B4A7D6', '#FFE5B4',
  '#FF8C94', '#A8DADC', '#F1C0E8', '#CFBAF0'
];

/**
 * Получить URL аватарки пользователя из Telegram
 */
async function getTelegramUserAvatar(bot, telegramId) {
  try {
    // Получаем фотографии профиля пользователя
    const photos = await bot.telegram.getUserProfilePhotos(telegramId, 0, 1);

    if (photos && photos.photos && photos.photos.length > 0) {
      // Берем первое фото (самое актуальное)
      const photo = photos.photos[0];
      // Берем самое большое разрешение (последний элемент в массиве)
      const fileId = photo[photo.length - 1].file_id;

      // Получаем ссылку на файл через Telegram CDN
      const fileLink = await bot.telegram.getFileLink(fileId);
      return fileLink.href;
    }
  } catch (error) {
    console.log(`⚠️ Не удалось получить аватар для пользователя ${telegramId}:`, error.message);
  }

  // Возвращаем null если не удалось получить аватар
  return null;
}

/**
 * Получить или создать участника
 */
async function getOrCreateParticipant(telegramUser, bot = null) {
  const { id: telegramId, username, first_name, last_name } = telegramUser;

  let participant = await prisma.participant.findUnique({
    where: { telegramId: BigInt(telegramId) }
  });

  if (!participant) {
    // Пытаемся получить реальный аватар из Telegram
    let avatar = null;
    if (bot) {
      avatar = await getTelegramUserAvatar(bot, telegramId);
    }

    // Если не удалось получить реальный аватар, используем заглушку
    if (!avatar) {
      avatar = `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`;
    }

    const color = COLORS[Math.floor(Math.random() * COLORS.length)];

    participant = await prisma.participant.create({
      data: {
        telegramId: BigInt(telegramId),
        username: username || null,
        firstName: first_name || null,
        lastName: last_name || null,
        avatar,
        color
      }
    });

    console.log(`✅ Создан новый участник ${telegramId} с аватаром: ${avatar}`);
  } else if (bot && participant.avatar && participant.avatar.includes('pravatar.cc')) {
    // Если у существующего участника заглушка, пытаемся обновить на реальный аватар
    const realAvatar = await getTelegramUserAvatar(bot, telegramId);
    if (realAvatar) {
      participant = await prisma.participant.update({
        where: { telegramId: BigInt(telegramId) },
        data: { avatar: realAvatar }
      });
      console.log(`✅ Обновлен аватар для участника ${telegramId}: ${realAvatar}`);
    }
  }

  return participant;
}

/**
 * Создать новую сессию (поход в баню)
 */
async function createSession(chatId, adminId) {
  const session = await prisma.session.create({
    data: {
      chatId: BigInt(chatId),
      adminId: BigInt(adminId),
      status: 'draft'
    },
    include: {
      participants: {
        include: {
          participant: true
        }
      }
    }
  });

  return session;
}

/**
 * Получить сессию по ID
 */
async function getSession(sessionId) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      participants: {
        include: {
          participant: true
        }
      }
    }
  });

  return session;
}

/**
 * Обновить информацию о сессии
 */
async function updateSession(sessionId, data) {
  const session = await prisma.session.update({
    where: { id: sessionId },
    data,
    include: {
      participants: {
        include: {
          participant: true
        }
      }
    }
  });

  return session;
}

/**
 * Добавить участника в сессию
 */
async function addParticipantToSession(sessionId, participantId, role = 'member') {
  const sessionParticipant = await prisma.sessionParticipant.upsert({
    where: {
      sessionId_participantId: {
        sessionId,
        participantId
      }
    },
    create: {
      sessionId,
      participantId,
      role
    },
    update: {
      role
    }
  });

  return sessionParticipant;
}

/**
 * Удалить участника из сессии
 */
async function removeParticipantFromSession(sessionId, participantId) {
  await prisma.sessionParticipant.deleteMany({
    where: {
      sessionId,
      participantId
    }
  });
}

/**
 * Получить активные сессии для чата
 */
async function getActiveSessionsForChat(chatId) {
  const sessions = await prisma.session.findMany({
    where: {
      chatId: BigInt(chatId),
      status: 'active'
    },
    include: {
      participants: {
        include: {
          participant: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  return sessions;
}

/**
 * Получить сессии пользователя по его Telegram ID
 */
async function getSessionsForUser(userId) {
  // Сначала находим участника по telegramId
  const participant = await prisma.participant.findUnique({
    where: { telegramId: BigInt(userId) }
  });

  if (!participant) {
    return [];
  }

  // Находим все сессии где участник присутствует
  const sessions = await prisma.session.findMany({
    where: {
      participants: {
        some: {
          participantId: participant.id
        }
      },
      status: {
        in: ['draft', 'active']
      }
    },
    include: {
      participants: {
        include: {
          participant: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  return sessions;
}

/**
 * Преобразовать сессию из БД в формат для бота (совместимость со старым кодом)
 */
function sessionToLegacyFormat(session) {
  if (!session) return null;

  return {
    id: session.id,
    chatId: Number(session.chatId),
    adminId: Number(session.adminId),
    venueName: session.venueName,
    date: session.date,
    time: session.time,
    status: session.status,
    createdAt: session.createdAt,
    participants: session.participants.map(sp => ({
      id: Number(sp.participant.telegramId),
      username: sp.participant.username,
      firstName: sp.participant.firstName,
      lastName: sp.participant.lastName,
      avatar: sp.participant.avatar,
      color: sp.participant.color,
      role: sp.role
    }))
  };
}

module.exports = {
  getOrCreateParticipant,
  createSession,
  getSession,
  updateSession,
  addParticipantToSession,
  removeParticipantFromSession,
  getActiveSessionsForChat,
  getSessionsForUser,
  sessionToLegacyFormat
};
