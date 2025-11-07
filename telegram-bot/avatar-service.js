const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const AVATARS_DIR = path.join(__dirname, 'avatars');

// Создаем директорию для аватаров если её нет
if (!fs.existsSync(AVATARS_DIR)) {
  fs.mkdirSync(AVATARS_DIR, { recursive: true });
  console.log('📁 Created avatars directory:', AVATARS_DIR);
}

/**
 * Скачать и сохранить аватар из Telegram
 * @param {Object} bot - Telegraf bot instance or telegram API
 * @param {number} telegramId - Telegram ID пользователя
 * @returns {Promise<string|null>} - Путь к файлу (/avatars/{telegramId}.jpg) или null
 */
async function downloadAndSaveAvatar(bot, telegramId) {
  try {
    console.log(`📸 Downloading avatar for user ${telegramId}...`);

    // Поддерживаем оба варианта: bot instance или telegram API напрямую
    const telegram = bot.telegram || bot;
    const botToken = bot.token || process.env.BOT_TOKEN;

    // Получаем фотографии профиля пользователя
    const photos = await telegram.getUserProfilePhotos(telegramId, 0, 1);

    if (!photos || !photos.photos || photos.photos.length === 0) {
      console.log(`⚠️ No avatar found for user ${telegramId}`);
      return null;
    }

    // Берем первое фото (самое актуальное) и самое большое разрешение
    const photo = photos.photos[0];
    const fileId = photo[photo.length - 1].file_id;
    console.log(`📄 File ID: ${fileId}`);

    // Получаем информацию о файле
    const file = await telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
    console.log(`🔗 Download URL: ${fileUrl.substring(0, 60)}...`);

    // Скачиваем и сохраняем локально
    const localPath = path.join(AVATARS_DIR, `${telegramId}.jpg`);
    await downloadFile(fileUrl, localPath);

    console.log(`✅ Avatar saved for user ${telegramId} at ${localPath}`);
    return `/avatars/${telegramId}.jpg`;

  } catch (error) {
    console.error(`❌ Failed to download avatar for user ${telegramId}:`, error.message);
    return null;
  }
}

/**
 * Скачать файл по URL
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const file = fs.createWriteStream(destPath);

    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(destPath, () => {});
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });

      file.on('error', (err) => {
        file.close();
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      file.close();
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

/**
 * Проверить существует ли аватар локально
 */
function avatarExists(telegramId) {
  const avatarPath = path.join(AVATARS_DIR, `${telegramId}.jpg`);
  return fs.existsSync(avatarPath);
}

/**
 * Удалить файл аватара
 */
function deleteAvatar(telegramId) {
  const avatarPath = path.join(AVATARS_DIR, `${telegramId}.jpg`);

  if (fs.existsSync(avatarPath)) {
    fs.unlinkSync(avatarPath);
    console.log(`🗑️ Deleted avatar for user ${telegramId}`);
    return true;
  }

  return false;
}

/**
 * Очистить неиспользуемые аватары
 * Удаляет аватары пользователей которые не участвуют в активных сессиях
 */
async function cleanupUnusedAvatars(prisma) {
  try {
    console.log('🧹 Starting avatar cleanup...');

    // Получаем всех участников которые есть в активных сессиях
    const activeParticipants = await prisma.sessionParticipant.findMany({
      where: {
        session: {
          status: {
            in: ['draft', 'active']
          }
        }
      },
      select: {
        participant: {
          select: {
            telegramId: true
          }
        }
      },
      distinct: ['participantId']
    });

    const activeTelegramIds = new Set(
      activeParticipants.map(sp => sp.participant.telegramId.toString())
    );

    console.log(`📊 Found ${activeTelegramIds.size} active participants`);

    // Читаем все файлы аватаров
    const avatarFiles = fs.readdirSync(AVATARS_DIR);

    let deletedCount = 0;
    for (const file of avatarFiles) {
      const telegramId = file.replace('.jpg', '');

      if (!activeTelegramIds.has(telegramId)) {
        const filePath = path.join(AVATARS_DIR, file);
        fs.unlinkSync(filePath);
        deletedCount++;
        console.log(`🗑️ Deleted unused avatar: ${file}`);
      }
    }

    console.log(`✅ Cleanup complete: removed ${deletedCount} unused avatars`);
    return deletedCount;

  } catch (error) {
    console.error('❌ Error cleaning up avatars:', error);
    return 0;
  }
}

module.exports = {
  downloadAndSaveAvatar,
  avatarExists,
  deleteAvatar,
  cleanupUnusedAvatars,
  AVATARS_DIR
};
