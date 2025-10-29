'use client';

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTelegramWebApp } from '../hooks/useTelegramWebApp';
import { useSessionPresence } from '../hooks/useSessionPresence';

// Types
interface Participant {
  id: number;
  name: string;
  avatar: string;
  color: string;
  isOnline?: boolean;
  onlineColor?: string;
}

interface ItemShare {
  userId: number;
  userName: string;
  userAvatar: string;
  quantity: number;
}

interface CheckItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  isCommon: boolean;
  selectedBy: ItemShare[];
}

interface SessionData {
  id: string;
  venueName: string;
  date: string;
  participants: Participant[];
  items: CheckItem[];
  createdAt?: string;
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionIdFromUrl = searchParams.get('sessionId');
  const tgWebAppStartParam = searchParams.get('tgWebAppStartParam');

  const { webApp, user, startParam, isReady } = useTelegramWebApp();

  // Приоритет: 1) sessionId из URL, 2) tgWebAppStartParam из URL, 3) startParam из Telegram SDK, 4) null
  const sessionIdFromParams = sessionIdFromUrl || tgWebAppStartParam || startParam;
  const [sessionId, setSessionId] = useState<string | null>(sessionIdFromParams);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Map<string, number>>(new Map());

  // Подключаемся к WebSocket для отслеживания онлайн пользователей
  const { onlineUsers, connectionStatus } = useSessionPresence({
    sessionId,
    userId: user?.id || null,
    userName: user?.first_name || null,
    userAvatar: user?.photo_url || null,
    userColor: null,
  });

  // Отладочное логирование
  useEffect(() => {
    console.log('📡 WebSocket статус:', connectionStatus);
    console.log('👥 Онлайн пользователи:', onlineUsers);
  }, [connectionStatus, onlineUsers]);

  // Загружаем данные сессии
  useEffect(() => {
    console.log('[HomePage] sessionIdFromUrl:', sessionIdFromUrl);
    console.log('[HomePage] tgWebAppStartParam:', tgWebAppStartParam);
    console.log('[HomePage] startParam from SDK:', startParam);
    console.log('[HomePage] sessionIdFromParams:', sessionIdFromParams);
    console.log('[HomePage] current sessionId state:', sessionId);

    const fetchSession = async () => {
      try {
        let url: string;

        if (sessionIdFromParams) {
          // Если sessionId указан в URL, загружаем конкретную сессию
          url = `/api/sessions/${sessionIdFromParams}`;
        } else if (user?.id) {
          // Если sessionId не указан, загружаем сессии пользователя
          const userSessionsResponse = await fetch(`/api/sessions/user/${user.id}`);
          if (!userSessionsResponse.ok) {
            throw new Error('No active sessions found');
          }
          const sessions = await userSessionsResponse.json();

          if (!sessions || sessions.length === 0) {
            throw new Error('No active sessions found');
          }

          // Сортируем по дате создания (самый новый первым) и берем последний
          const sortedSessions = [...sessions].sort((a: SessionData, b: SessionData) => {
            const dateA = new Date(a.createdAt || 0).getTime();
            const dateB = new Date(b.createdAt || 0).getTime();
            return dateB - dateA;
          });
          const latestSession = sortedSessions[0];
          // Устанавливаем sessionId для использования в компоненте
          setSessionId(latestSession.id);
          url = `/api/sessions/${latestSession.id}`;
        } else {
          // Если нет ни sessionId, ни user - ждем
          setLoading(false);
          return;
        }

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Session not found');
        }
        const data = await response.json();
        setSessionData(data);
      } catch (error) {
        console.error('Error loading session:', error);
      } finally {
        setLoading(false);
      }
    };

    // Запускаем загрузку только когда есть sessionId или когда user готов
    if (sessionIdFromParams || user) {
      fetchSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionIdFromParams, user, router]);

  // Обрабатываем выбор/снятие выбора позиции
  const handleItemToggle = useCallback((itemId: string) => {
    setSelectedItems(prev => {
      const newMap = new Map(prev);
      if (newMap.has(itemId)) {
        newMap.delete(itemId);
      } else {
        newMap.set(itemId, 1);
      }
      return newMap;
    });
  }, []);

  // Обрабатываем изменение количества
  const handleQuantityChange = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      setSelectedItems(prev => {
        const newMap = new Map(prev);
        newMap.delete(itemId);
        return newMap;
      });
      return;
    }

    setSelectedItems(prev => {
      const newMap = new Map(prev);
      newMap.set(itemId, quantity);
      return newMap;
    });
  }, []);

  // Рассчитываем суммы
  const { totalAmount, userAmount } = useMemo(() => {
    if (!sessionData) return { totalAmount: 0, userAmount: 0 };

    let total = 0;
    let userSum = 0;
    const participantsCount = sessionData.participants.length || 1;

    sessionData.items.forEach(item => {
      const itemTotal = item.price * item.quantity;
      total += itemTotal;

      if (item.isCommon) {
        // Общие позиции делятся поровну на всех
        userSum += itemTotal / participantsCount;
      } else {
        // Частичные позиции - берем только то, что выбрали
        const selectedQuantity = selectedItems.get(item.id) || 0;
        if (selectedQuantity > 0) {
          userSum += item.price * selectedQuantity;
        }
      }
    });

    return {
      totalAmount: Math.round(total),
      userAmount: Math.round(userSum),
    };
  }, [sessionData, selectedItems]);

  // Настраиваем MainButton
  useEffect(() => {
    if (!webApp || !isReady) return;

    webApp.MainButton.setText('Подтвердить выбор');
    webApp.MainButton.show();

    const handleClick = () => {
      if (sessionId) {
        router.push(`/payment?sessionId=${sessionId}`);
      }
    };

    webApp.MainButton.onClick(handleClick);

    return () => {
      webApp.MainButton.offClick(handleClick);
      webApp.MainButton.hide();
    };
  }, [webApp, isReady, sessionId, router]);

  // Генерация рандомного яркого цвета для онлайн индикатора
  const getOnlineRingColor = (userId: number) => {
    const colors = [
      '#FF6B6B', // красный
      '#4ECDC4', // бирюзовый
      '#45B7D1', // голубой
      '#FFA07A', // лососевый
      '#98D8C8', // мятный
      '#F7DC6F', // желтый
      '#BB8FCE', // фиолетовый
      '#85C1E2', // светло-синий
      '#F8B739', // оранжевый
      '#52C77D', // зеленый
      '#FF85A6', // розовый
      '#7FCDCD', // аквамарин
    ];
    return colors[userId % colors.length];
  };

  // Обновляем участников с онлайн статусом
  const participantsWithStatus = useMemo(() => {
    if (!sessionData) return [];

    return sessionData.participants.map(participant => {
      const onlineUser = onlineUsers.find(u => u.userId === participant.id);
      return {
        ...participant,
        isOnline: !!onlineUser,
        onlineColor: onlineUser ? getOnlineRingColor(participant.id) : undefined,
      };
    });
  }, [sessionData, onlineUsers]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--tg-theme-bg-color,#ffffff)] flex items-center justify-center">
        <div className="text-[var(--tg-theme-hint-color,#999999)]">Загрузка...</div>
      </div>
    );
  }

  if (!loading && !sessionData) {
    return (
      <div className="min-h-screen bg-[var(--tg-theme-bg-color,#ffffff)] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-[var(--tg-theme-text-color,#000000)] mb-2">
            {user ? 'У вас нет активных сессий' : 'Сессия не найдена'}
          </div>
          <div className="text-sm text-[var(--tg-theme-hint-color,#999999)]">
            {user
              ? 'Создайте новый поход в баню через бота'
              : 'Проверьте ссылку и попробуйте снова'
            }
          </div>
        </div>
      </div>
    );
  }

  // Проверка на null для TypeScript
  if (!sessionData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--tg-theme-bg-color,#ffffff)] pb-24">
      {/* Шапка с названием и датой */}
      <div className="sticky top-0 z-10 bg-[var(--tg-theme-bg-color,#ffffff)] border-b border-[var(--tg-theme-secondary-bg-color,#f5f5f5)]">
        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (webApp) {
                  webApp.close();
                } else {
                  router.back();
                }
              }}
              className="text-[var(--tg-theme-link-color,#3390ec)]"
            >
              ←
            </button>
            <div className="flex-1">
              <div className="font-semibold text-[var(--tg-theme-text-color,#000000)]">
                {sessionData.venueName || 'Баня'}
              </div>
              {sessionData.date && (
                <div className="text-sm text-[var(--tg-theme-hint-color,#999999)]">
                  {sessionData.date}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Участники */}
        <div className="px-4 pb-3 pt-2 overflow-x-auto">
          <div className="flex gap-4">
            {participantsWithStatus.map(participant => (
              <div key={participant.id} className="flex flex-col items-center gap-1 min-w-[60px]">
                <div className="relative">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                    style={{
                      backgroundColor: participant.color || '#3390ec',
                      ...(participant.isOnline && participant.onlineColor ? {
                        boxShadow: `0 0 0 2px #ffffff, 0 0 0 4px ${participant.onlineColor}`,
                      } : {})
                    }}
                  >
                    {participant.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={participant.avatar}
                        alt={participant.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      participant.name.charAt(0).toUpperCase()
                    )}
                  </div>
                </div>
                <div className="text-xs text-[var(--tg-theme-text-color,#000000)] text-center truncate max-w-[60px]">
                  {participant.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Список позиций */}
      <div className="px-4 py-4 space-y-3">
        {sessionData.items.map(item => {
          const isSelected = selectedItems.has(item.id);
          const selectedQuantity = selectedItems.get(item.id) || 1;
          const totalSelected = item.selectedBy.reduce((sum, share) => sum + share.quantity, 0);
          const remaining = item.quantity - totalSelected;

          return (
            <div
              key={item.id}
              className={`rounded-2xl p-4 transition-all ${
                isSelected
                  ? 'bg-[var(--tg-theme-button-color,#3390ec)] text-white'
                  : 'bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)]'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Чекбокс */}
                <button
                  onClick={() => handleItemToggle(item.id)}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isSelected
                      ? 'bg-white border-white'
                      : 'border-[var(--tg-theme-hint-color,#999999)]'
                  }`}
                >
                  {isSelected && (
                    <svg className="w-4 h-4 text-[var(--tg-theme-button-color,#3390ec)]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>

                {/* Информация о позиции */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className={`font-medium ${isSelected ? 'text-white' : 'text-[var(--tg-theme-text-color,#000000)]'}`}>
                        {item.name}
                      </div>
                      {item.isCommon && (
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-[var(--tg-theme-button-color,#3390ec)]/10 text-[var(--tg-theme-button-color,#3390ec)]'
                        }`}>
                          общее
                        </span>
                      )}
                    </div>
                    <div className={`font-semibold whitespace-nowrap ${isSelected ? 'text-white' : 'text-[var(--tg-theme-text-color,#000000)]'}`}>
                      {item.price} ₽
                    </div>
                  </div>

                  {/* Редактор количества для частичных позиций */}
                  {!item.isCommon && isSelected && (
                    <div className="mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2">
                          <button
                            onClick={() => handleQuantityChange(item.id, selectedQuantity - 0.1)}
                            className="text-white text-xl font-bold w-6 h-6 flex items-center justify-center"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            value={selectedQuantity}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val)) {
                                handleQuantityChange(item.id, val);
                              }
                            }}
                            className="w-16 bg-transparent text-white text-center font-semibold outline-none"
                            step="0.1"
                            min="0"
                          />
                          <button
                            onClick={() => handleQuantityChange(item.id, selectedQuantity + 0.1)}
                            className="text-white text-xl font-bold w-6 h-6 flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => handleQuantityChange(item.id, selectedQuantity)}
                          className="px-3 py-2 bg-white/20 rounded-lg text-white text-sm font-medium"
                        >
                          OK
                        </button>
                        <button
                          onClick={() => handleItemToggle(item.id)}
                          className="px-3 py-2 bg-white/20 rounded-lg text-white text-sm"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="mt-2 text-sm text-white/80">
                        Вы берете: {selectedQuantity} шт • {Math.round(item.price * selectedQuantity)} ₽
                      </div>
                    </div>
                  )}

                  {/* Информация о выборе */}
                  {!item.isCommon && (
                    <div className={`text-sm mb-2 ${isSelected ? 'text-white/80' : 'text-[var(--tg-theme-hint-color,#999999)]'}`}>
                      {item.quantity > 1 && `× ${item.quantity}`}
                      {totalSelected > 0 && (
                        <>
                          {' • '}
                          Выбрано {totalSelected.toFixed(1)} из {item.quantity} • осталось {remaining.toFixed(1)}
                        </>
                      )}
                      {totalSelected === 0 && ' • Никто не выбрал'}
                    </div>
                  )}

                  {/* Аватары выбравших */}
                  {item.selectedBy.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {item.selectedBy.map((share, idx) => (
                        <div
                          key={idx}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold bg-[var(--tg-theme-button-color,#3390ec)] ring-2 ring-white"
                        >
                          {share.userAvatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={share.userAvatar}
                              alt={share.userName}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            share.userName.charAt(0).toUpperCase()
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Кнопки действий */}
      <div className="px-4 py-4 flex gap-3">
        <button
          onClick={() => router.push(`/add-expense?sessionId=${sessionId}`)}
          className="flex-1 py-3 bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] text-[var(--tg-theme-text-color,#000000)] rounded-xl font-medium"
        >
          + Общий расход
        </button>
        <button
          onClick={() => router.push(`/upload-check?sessionId=${sessionId}`)}
          className="flex-1 py-3 bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] text-[var(--tg-theme-text-color,#000000)] rounded-xl font-medium"
        >
          + Загрузить чек
        </button>
      </div>

      {/* Итоги */}
      <div className="fixed bottom-0 left-0 right-0 bg-[var(--tg-theme-bg-color,#ffffff)] border-t border-[var(--tg-theme-secondary-bg-color,#f5f5f5)] p-4 pb-20">
        <div className="flex justify-between items-center mb-2">
          <div className="text-[var(--tg-theme-hint-color,#999999)]">Общий счёт:</div>
          <div className="text-2xl font-bold text-[var(--tg-theme-text-color,#000000)]">
            {totalAmount} ₽
          </div>
        </div>
        <div className="flex justify-between items-center">
          <div className="text-[var(--tg-theme-hint-color,#999999)]">Ваша сумма:</div>
          <div className="text-3xl font-bold text-[var(--tg-theme-text-color,#000000)]">
            {userAmount} ₽
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--tg-theme-bg-color,#ffffff)] flex items-center justify-center">
        <div className="text-[var(--tg-theme-hint-color,#999999)]">Загрузка...</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
