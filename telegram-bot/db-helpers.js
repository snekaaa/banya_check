const prisma = require('./prisma-client');
const { downloadAndSaveAvatar } = require('./avatar-service');

// Цвета для аватарок участников
const COLORS = [
  '#FF6B6B', '#4ECDC4', '#FFD93D', '#95E1D3',
  '#A8E6CF', '#FFB6C1', '#B4A7D6', '#FFE5B4',
  '#FF8C94', '#A8DADC', '#F1C0E8', '#CFBAF0'
];

/**
 * Обновить аватар участника (вызывается при добавлении в новую сессию)
 */
async function updateParticipantAvatar(telegramId, bot) {
  if (!bot) return;

  try {
    const participant = await prisma.participant.findUnique({
      where: { telegramId: BigInt(telegramId) }
    });

    if (!participant) return;

    // Всегда скачиваем свежий аватар при добавлении в сессию
    const localAvatarPath = await downloadAndSaveAvatar(bot, telegramId);

    if (localAvatarPath) {
      await prisma.participant.update({
        where: { telegramId: BigInt(telegramId) },
        data: { avatar: localAvatarPath }
      });
      console.log(`✅ Updated avatar for participant ${telegramId}: ${localAvatarPath}`);
    }
  } catch (error) {
    console.error(`❌ Error updating avatar for ${telegramId}:`, error.message);
  }
}

/**
 * Получить или создать участника
 */
async function getOrCreateParticipant(telegramUser, bot = null) {
  const { id: telegramId, username, first_name, last_name, photo_url } = telegramUser;

  let participant = await prisma.participant.findUnique({
    where: { telegramId: BigInt(telegramId) }
  });

  if (!participant) {
    // Для новых участников: скачиваем аватар локально
    let avatar = null;

    if (bot) {
      // Скачиваем и сохраняем аватар локально
      avatar = await downloadAndSaveAvatar(bot, telegramId);
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
  }

  return participant;
}

/**
 * Создать новую сессию (поход в баню)
 */
async function createSession(chatId, adminId, adminParticipantId, bot = null) {
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

  // Automatically add admin as a participant with 'going' status
  if (adminParticipantId) {
    console.log('🎯 Adding admin as participant:', { sessionId: session.id, adminParticipantId });
    await addParticipantToSession(session.id, adminParticipantId, 'admin', 'going', bot);
    console.log('✅ Admin added as participant');
  } else {
    console.log('⚠️ No adminParticipantId provided to createSession');
  }

  // Fetch updated session with participants
  const updatedSession = await getSession(session.id);
  console.log('📊 Session participants count:', updatedSession?.participants?.length || 0);
  return updatedSession;
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
      },
      items: true
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
async function addParticipantToSession(sessionId, participantId, role = 'member', attendanceStatus = 'going', bot = null) {
  // Обновляем аватар если передан bot instance
  if (bot) {
    const participant = await prisma.participant.findUnique({
      where: { id: participantId }
    });

    if (participant) {
      await updateParticipantAvatar(Number(participant.telegramId), bot);
    }
  }

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
      role,
      attendanceStatus
    },
    update: {
      role,
      attendanceStatus
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
 * Создать или обновить выбор позиции участником
 */
async function saveItemSelection(checkItemId, participantId, quantity) {
  const selection = await prisma.itemSelection.upsert({
    where: {
      checkItemId_participantId: {
        checkItemId,
        participantId
      }
    },
    create: {
      checkItemId,
      participantId,
      quantity
    },
    update: {
      quantity
    },
    include: {
      participant: true,
      checkItem: true
    }
  });

  return selection;
}

/**
 * Удалить выбор позиции участником
 */
async function deleteItemSelection(checkItemId, participantId) {
  await prisma.itemSelection.deleteMany({
    where: {
      checkItemId,
      participantId
    }
  });
}

/**
 * Получить все выборы для сессии
 */
async function getItemSelections(sessionId) {
  const selections = await prisma.itemSelection.findMany({
    where: {
      checkItem: {
        sessionId
      }
    },
    include: {
      participant: true,
      checkItem: true
    }
  });

  return selections;
}

/**
 * Получить сессию с позициями и выборами участников
 */
async function getSessionWithItems(sessionId) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      participants: {
        include: {
          participant: true
        }
      },
      items: {
        include: {
          selections: {
            include: {
              participant: true
            }
          }
        }
      }
    }
  });

  return session;
}

/**
 * Преобразовать относительный путь аватара в полный URL
 */
function getFullAvatarUrl(avatar) {
  if (!avatar) return avatar;

  // Если уже полный URL (http/https или pravatar.cc), возвращаем как есть
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
    return avatar;
  }

  // Если относительный путь, добавляем базовый URL
  const baseUrl = process.env.WEB_APP_URL || 'http://bot:3002';
  return `${baseUrl}${avatar}`;
}

/**
 * Преобразовать сессию из БД в формат для бота (совместимость со старым кодом)
 * Включает только участников со статусом 'going' (точно идут)
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
    // Фильтруем только участников со статусом 'going'
    participants: session.participants
      .filter(sp => sp.attendanceStatus === 'going')
      .map(sp => ({
        id: Number(sp.participant.telegramId),
        name: sp.participant.firstName || sp.participant.username || 'Аноним',
        username: sp.participant.username,
        firstName: sp.participant.firstName,
        lastName: sp.participant.lastName,
        avatar: getFullAvatarUrl(sp.participant.avatar),
        color: sp.participant.color,
        role: sp.role,
        attendanceStatus: sp.attendanceStatus,
        selectionConfirmed: sp.selectionConfirmed,
        hasPayment: sp.hasPayment
      })),
    items: (session.items || []).map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      isCommon: item.isCommon,
      selectedBy: (item.selections || []).map(sel => ({
        userId: Number(sel.participant.telegramId),
        userName: sel.participant.firstName || sel.participant.username || 'Аноним',
        userAvatar: getFullAvatarUrl(sel.participant.avatar),
        userColor: sel.participant.color,
        quantity: sel.quantity
      }))
    }))
  };
}

/**
 * Подтвердить выбор позиций участником
 * @param {string} sessionId - ID сессии
 * @param {string|number} telegramId - Telegram ID пользователя
 */
async function confirmParticipantSelection(sessionId, telegramId) {
  // Находим участника по telegramId
  const participant = await prisma.participant.findUnique({
    where: { telegramId: BigInt(telegramId) }
  });

  if (!participant) {
    throw new Error('Participant not found');
  }

  // Находим связь участника с сессией
  const sessionParticipant = await prisma.sessionParticipant.findUnique({
    where: {
      sessionId_participantId: {
        sessionId,
        participantId: participant.id
      }
    }
  });

  if (!sessionParticipant) {
    throw new Error('Participant not found in session');
  }

  return await prisma.sessionParticipant.update({
    where: { id: sessionParticipant.id },
    data: { selectionConfirmed: true }
  });
}

/**
 * Отменить подтверждение выбора (разрешить редактирование)
 * @param {string} sessionId - ID сессии
 * @param {string|number} telegramId - Telegram ID пользователя
 */
async function unconfirmParticipantSelection(sessionId, telegramId) {
  // Находим участника по telegramId
  const participant = await prisma.participant.findUnique({
    where: { telegramId: BigInt(telegramId) }
  });

  if (!participant) {
    throw new Error('Participant not found');
  }

  // Находим связь участника с сессией
  const sessionParticipant = await prisma.sessionParticipant.findUnique({
    where: {
      sessionId_participantId: {
        sessionId,
        participantId: participant.id
      }
    }
  });

  if (!sessionParticipant) {
    throw new Error('Participant not found in session');
  }

  return await prisma.sessionParticipant.update({
    where: { id: sessionParticipant.id },
    data: { selectionConfirmed: false }
  });
}

/**
 * Создать платеж
 * @param {string} sessionId - ID сессии
 * @param {string|number} telegramId - Telegram ID пользователя
 * @param {number} amount - Сумма платежа
 * @param {string|null} paymentProof - URL скриншота
 */
async function createPayment(sessionId, telegramId, amount, paymentProof = null) {
  // Находим участника по telegramId
  const participant = await prisma.participant.findUnique({
    where: { telegramId: BigInt(telegramId) }
  });

  if (!participant) {
    throw new Error('Participant not found');
  }

  // Находим связь участника с сессией
  const sessionParticipant = await prisma.sessionParticipant.findUnique({
    where: {
      sessionId_participantId: {
        sessionId,
        participantId: participant.id
      }
    }
  });

  if (!sessionParticipant) {
    throw new Error('Participant not found in session');
  }

  const payment = await prisma.payment.create({
    data: {
      sessionParticipantId: sessionParticipant.id,
      amount,
      paymentProof,
      confirmedAt: new Date() // Подтверждаем сразу при нажатии "Я оплатил"
    }
  });

  // Обновляем флаг hasPayment у участника
  await prisma.sessionParticipant.update({
    where: { id: sessionParticipant.id },
    data: { hasPayment: true }
  });

  return payment;
}

/**
 * Обновить платеж (добавить скриншот)
 */
async function updatePayment(paymentId, paymentProof) {
  return await prisma.payment.update({
    where: { id: paymentId },
    data: {
      paymentProof,
      confirmedAt: new Date()
    }
  });
}

/**
 * Получить платежи участника в сессии
 * @param {string} sessionId - ID сессии
 * @param {string|number} telegramId - Telegram ID пользователя
 */
async function getParticipantPayments(sessionId, telegramId) {
  // Находим участника по telegramId
  const participant = await prisma.participant.findUnique({
    where: { telegramId: BigInt(telegramId) }
  });

  if (!participant) {
    return [];
  }

  const sessionParticipant = await prisma.sessionParticipant.findUnique({
    where: {
      sessionId_participantId: {
        sessionId,
        participantId: participant.id
      }
    },
    include: {
      payments: true
    }
  });

  return sessionParticipant?.payments || [];
}

/**
 * Обновить статус участия пользователя в сессии
 * @param {string} sessionId - ID сессии
 * @param {string|number} telegramId - Telegram ID пользователя
 * @param {string} attendanceStatus - Статус: 'going', 'maybe', 'not_going'
 */
async function updateAttendanceStatus(sessionId, telegramId, attendanceStatus) {
  // Находим участника по telegramId
  const participant = await prisma.participant.findUnique({
    where: { telegramId: BigInt(telegramId) }
  });

  if (!participant) {
    throw new Error('Participant not found');
  }

  // Обновляем или создаем запись
  const sessionParticipant = await prisma.sessionParticipant.upsert({
    where: {
      sessionId_participantId: {
        sessionId,
        participantId: participant.id
      }
    },
    create: {
      sessionId,
      participantId: participant.id,
      attendanceStatus,
      role: 'member'
    },
    update: {
      attendanceStatus
    },
    include: {
      participant: true
    }
  });

  return sessionParticipant;
}

/**
 * Получить участников сессии по статусу
 * @param {string} sessionId - ID сессии
 */
async function getParticipantsByStatus(sessionId) {
  const participants = await prisma.sessionParticipant.findMany({
    where: { sessionId },
    include: {
      participant: true
    }
  });

  return {
    going: participants.filter(p => p.attendanceStatus === 'going'),
    maybe: participants.filter(p => p.attendanceStatus === 'maybe'),
    notGoing: participants.filter(p => p.attendanceStatus === 'not_going')
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
  saveItemSelection,
  deleteItemSelection,
  getItemSelections,
  getSessionWithItems,
  sessionToLegacyFormat,
  confirmParticipantSelection,
  unconfirmParticipantSelection,
  createPayment,
  updatePayment,
  getParticipantPayments,
  updateAttendanceStatus,
  getParticipantsByStatus
};
