'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Session = {
  id: string;
  venueName?: string;
  date?: string;
  time?: string;
  participants: Array<{ id: number; firstName?: string; username?: string }>;
  status: string;
  createdAt?: string;
};

export default function Landing() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_userId, setUserId] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // Динамический импорт SDK
    import('@twa-dev/sdk').then((WebAppModule) => {
      const WebApp = WebAppModule.default;

      WebApp.ready();
      WebApp.expand();

      // Получаем user ID из Telegram
      const telegramUser = WebApp.initDataUnsafe?.user;
      console.log('Telegram WebApp initDataUnsafe:', WebApp.initDataUnsafe);
      console.log('Telegram user:', telegramUser);

      if (telegramUser?.id) {
        setUserId(telegramUser.id);
        loadUserSessions(telegramUser.id);
      } else {
        // Для тестирования используем ID из URL или тестовый
        const urlParams = new URLSearchParams(window.location.search);
        const testUserId = urlParams.get('userId');

        if (testUserId) {
          setUserId(parseInt(testUserId));
          loadUserSessions(parseInt(testUserId));
        } else {
          setLoading(false);
        }
      }
    }).catch((err) => {
      console.error('Failed to load Telegram WebApp SDK:', err);
      setLoading(false);
    });
  }, [mounted]);

  const loadUserSessions = async (userId: number) => {
    console.log('[Landing] Loading sessions for user:', userId);
    const response = await fetch(`/api/sessions/user/${userId}`);
    console.log('[Landing] Response status:', response.status);

    const data = await response.json();
    console.log('[Landing] Received data:', data);
    setSessions(data);

    // Если поход один - автоматически выбираем его
    if (data.length === 1) {
      setSelectedSession(data[0]);
    }

    console.log('[Landing] Setting loading to false');
    setLoading(false);
  };

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--tg-theme-bg-color,#ffffff)]">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <div className="text-[var(--tg-theme-text-color,#000000)]">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--tg-theme-bg-color,#ffffff)]">
        <div className="text-center">
          <div className="text-6xl mb-4">🧖</div>
          <div className="text-xl font-semibold text-[var(--tg-theme-text-color,#000000)] mb-2">
            Нет активных походов
          </div>
          <div className="text-sm text-[var(--tg-theme-hint-color,#999999)]">
            Создайте новый поход через бота в групповом чате
          </div>
        </div>
      </div>
    );
  }

  // Если несколько походов - показываем список для выбора
  if (sessions.length > 1 && !selectedSession) {
    return (
      <div className="min-h-screen bg-[var(--tg-theme-bg-color,#ffffff)] p-4">
        <div className="max-w-[420px] mx-auto">
          <h1 className="text-2xl font-bold text-[var(--tg-theme-text-color,#000000)] mb-6">
            Выберите поход
          </h1>
          <div className="space-y-3">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setSelectedSession(session)}
                className="w-full bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] p-4 rounded-2xl text-left transition-all active:scale-95"
              >
                <div className="text-lg font-semibold text-[var(--tg-theme-text-color,#000000)]">
                  🏛 {session.venueName || 'Без названия'}
                </div>
                <div className="text-sm text-[var(--tg-theme-hint-color,#999999)] mt-1">
                  📅 {session.date || 'Дата не указана'} • 🕐 {session.time || '--:--'}
                </div>
                <div className="text-sm text-[var(--tg-theme-hint-color,#999999)] mt-1">
                  👥 {session.participants.length} участников
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Показываем выбранный поход с кнопками выбора роли
  const session = selectedSession || sessions[0];

  return (
    <div className="min-h-screen bg-[var(--tg-theme-bg-color,#ffffff)] flex justify-center">
      <div className="w-full max-w-[420px] flex flex-col h-screen">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--tg-theme-bg-color,#ffffff)] border-b border-[var(--tg-theme-hint-color,#e0e0e0)] z-10">
          <div className="p-4">
            <h1 className="text-lg font-semibold text-[var(--tg-theme-text-color,#000000)]">
              {session.venueName || 'Баня'} • {session.date || 'Дата не указана'}
            </h1>
            <div className="text-sm text-[var(--tg-theme-hint-color,#999999)] mt-1">
              🕐 {session.time || '--:--'}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
          <div className="text-6xl mb-4">🧖</div>
          <div className="text-xl font-semibold text-[var(--tg-theme-text-color,#000000)] text-center mb-2">
            Выберите роль
          </div>
          <div className="text-sm text-[var(--tg-theme-hint-color,#999999)] text-center mb-6">
            Выберите, как вы хотите использовать приложение
          </div>

          <div className="w-full space-y-3">
            {/* User flow button */}
            <button
              onClick={() => router.push(`/?sessionId=${session.id}`)}
              className="w-full bg-[var(--tg-theme-button-color,#3390ec)] text-white
                         font-semibold py-6 rounded-2xl transition-all active:scale-95
                         flex flex-col items-center gap-2"
            >
              <div className="text-3xl">👤</div>
              <div>Я участник</div>
              <div className="text-xs opacity-70">Выбрать позиции и оплатить</div>
            </button>

            {/* Admin flow button */}
            <button
              onClick={() => router.push(`/admin?sessionId=${session.id}`)}
              className="w-full bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)]
                         text-[var(--tg-theme-text-color,#000000)]
                         font-semibold py-6 rounded-2xl transition-all active:scale-95
                         flex flex-col items-center gap-2"
            >
              <div className="text-3xl">⚙️</div>
              <div>Я администратор</div>
              <div className="text-xs text-[var(--tg-theme-hint-color,#999999)]">
                Управление посещением
              </div>
            </button>
          </div>

          {/* Если несколько походов - показать кнопку "Назад" */}
          {sessions.length > 1 && (
            <button
              onClick={() => setSelectedSession(null)}
              className="mt-4 text-[var(--tg-theme-link-color,#3390ec)] text-sm"
            >
              ← Выбрать другой поход
            </button>
          )}
        </div>

        {/* Info block */}
        <div className="p-4 pb-8">
          <div className="bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] rounded-xl p-4 text-center">
            <div className="text-sm text-[var(--tg-theme-hint-color,#999999)]">
              Посещение создано {session.createdAt ? new Date(session.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : 'неизвестно'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
