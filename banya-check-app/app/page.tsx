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
  userColor?: string;
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
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Функция для перезагрузки данных сессии
  const reloadSessionData = useCallback(async () => {
    if (!sessionId) return;

    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      if (!response.ok) {
        throw new Error('Session not found');
      }
      const data = await response.json();
      setSessionData(data);
    } catch (error) {
      console.error('Error reloading session:', error);
    }
  }, [sessionId]);

  // Подключаемся к WebSocket для отслеживания онлайн пользователей
  const { onlineUsers, connectionStatus } = useSessionPresence({
    sessionId,
    userId: user?.id || null,
    userName: user?.first_name || null,
    userAvatar: user?.photo_url || null,
    userColor: null,
    onExpensesUpdated: reloadSessionData,
    onItemSelectionUpdated: reloadSessionData,
  });

  // Отладочное логирование (можно убрать в продакшене)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('📡 WebSocket статус:', connectionStatus);
      console.log('👥 Онлайн пользователи:', onlineUsers);
    }
  }, [connectionStatus, onlineUsers]);

  // Инициализация selectedItems из данных сессии
  useEffect(() => {
    if (!sessionData || !user) return;

    const newSelectedItems = new Map<string, number>();
    sessionData.items.forEach(item => {
      const userSelection = item.selectedBy.find(share => share.userId === user.id);
      if (userSelection && userSelection.quantity > 0) {
        newSelectedItems.set(item.id, userSelection.quantity);
      }
    });

    setSelectedItems(newSelectedItems);
  }, [sessionData, user]);

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
  const handleItemToggle = useCallback(async (itemId: string) => {
    const isCurrentlySelected = selectedItems.has(itemId);

    // Оптимистичное обновление UI
    setSelectedItems(prev => {
      const newMap = new Map(prev);
      if (isCurrentlySelected) {
        newMap.delete(itemId);
      } else {
        newMap.set(itemId, 1);
      }
      return newMap;
    });

    try {
      if (!user?.id) {
        console.error('No user ID found');
        return;
      }

      if (isCurrentlySelected) {
        // Убираем выбор
        const response = await fetch(`/api/items/${itemId}/unselect`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telegramId: user.id }),
        });

        if (response.ok) {
          // Принудительно перезагружаем данные после успешного снятия выбора
          await reloadSessionData();
        }
      } else {
        // Выбираем позицию
        const response = await fetch(`/api/items/${itemId}/select`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegramId: user.id,
            quantity: 1
          }),
        });

        if (response.ok) {
          // Принудительно перезагружаем данные после успешного выбора
          await reloadSessionData();
        }
      }
    } catch (error) {
      console.error('Error toggling item selection:', error);
      // Откатываем изменения при ошибке
      setSelectedItems(prev => {
        const newMap = new Map(prev);
        if (isCurrentlySelected) {
          newMap.set(itemId, 1);
        } else {
          newMap.delete(itemId);
        }
        return newMap;
      });
    }
  }, [selectedItems, user, reloadSessionData]);

  // Обрабатываем изменение количества
  const handleQuantityChange = useCallback(async (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      // Если количество 0 или меньше, убираем выбор
      handleItemToggle(itemId);
      return;
    }

    // Оптимистичное обновление UI
    const previousQuantity = selectedItems.get(itemId);
    setSelectedItems(prev => {
      const newMap = new Map(prev);
      newMap.set(itemId, quantity);
      return newMap;
    });

    try {
      if (!user?.id) {
        console.error('No user ID found');
        return;
      }

      // Обновляем количество на сервере
      const response = await fetch(`/api/items/${itemId}/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: user.id,
          quantity: quantity
        }),
      });

      if (response.ok) {
        // Принудительно перезагружаем данные после успешного изменения количества
        await reloadSessionData();
      }
    } catch (error) {
      console.error('Error updating item quantity:', error);
      // Откатываем изменения при ошибке
      setSelectedItems(prev => {
        const newMap = new Map(prev);
        if (previousQuantity !== undefined) {
          newMap.set(itemId, previousQuantity);
        } else {
          newMap.delete(itemId);
        }
        return newMap;
      });
    }
  }, [selectedItems, user, handleItemToggle, reloadSessionData]);

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

  // Генерация рандомного яркого цвета для пользователя
  const getUserColor = (userId: number) => {
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
        onlineColor: onlineUser ? getUserColor(participant.id) : undefined,
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
    <div className="min-h-screen bg-[var(--tg-theme-bg-color,#ffffff)] pb-4">
      {/* Шапка с названием и датой */}
      <div className="bg-[var(--tg-theme-bg-color,#ffffff)] border-b border-[var(--tg-theme-secondary-bg-color,#f5f5f5)]">
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
                  disabled={!item.isCommon && !isSelected && remaining <= 0}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                    isSelected
                      ? 'bg-white border-white'
                      : remaining <= 0 && !item.isCommon
                      ? 'border-[var(--tg-theme-hint-color,#999999)] opacity-30 cursor-not-allowed'
                      : 'border-[var(--tg-theme-hint-color,#999999)] hover:border-[var(--tg-theme-button-color,#3390ec)]'
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
                      {editingItemId === item.id ? (
                        // Показываем редактор количества
                        <div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2">
                              <button
                                onClick={() => handleQuantityChange(item.id, Math.max(1, selectedQuantity - 1))}
                                className="text-white text-xl font-bold w-6 h-6 flex items-center justify-center"
                              >
                                −
                              </button>
                              <input
                                type="number"
                                value={Math.round(selectedQuantity)}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  if (!isNaN(val) && val > 0) {
                                    handleQuantityChange(item.id, val);
                                  }
                                }}
                                className="w-16 bg-transparent text-white text-center font-semibold outline-none"
                                min="1"
                              />
                              <button
                                onClick={() => handleQuantityChange(item.id, selectedQuantity + 1)}
                                className="text-white text-xl font-bold w-6 h-6 flex items-center justify-center"
                              >
                                +
                              </button>
                            </div>
                            <button
                              onClick={() => setEditingItemId(null)}
                              className="px-3 py-2 bg-white/20 rounded-lg text-white text-sm font-medium"
                            >
                              OK
                            </button>
                            <button
                              onClick={() => {
                                setEditingItemId(null);
                                handleItemToggle(item.id);
                              }}
                              className="px-3 py-2 bg-white/20 rounded-lg text-white text-sm"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="mt-2 text-sm text-white/80">
                            Вы берете: {Math.round(selectedQuantity)} шт • {Math.round(item.price * selectedQuantity)} ₽
                          </div>
                        </div>
                      ) : (
                        // Показываем кнопку "Изменить"
                        <button
                          onClick={() => setEditingItemId(item.id)}
                          className="px-3 py-2 bg-white/20 rounded-lg text-white text-sm font-medium"
                        >
                          Изменить
                        </button>
                      )}
                    </div>
                  )}

                  {/* Информация о выборе */}
                  {!item.isCommon && (
                    <div className={`text-sm mb-2 ${isSelected ? 'text-white/80' : 'text-[var(--tg-theme-hint-color,#999999)]'}`}>
                      {totalSelected > 0 ? (
                        <>
                          Выбрано {Math.round(totalSelected)} из {Math.round(item.quantity)}
                          {remaining > 0 && ` • осталось ${Math.round(remaining)}`}
                          {remaining <= 0 && ' • все выбрали'}
                        </>
                      ) : (
                        'Никто не выбрал'
                      )}
                    </div>
                  )}

                  {/* Аватары выбравших */}
                  {item.selectedBy.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {item.selectedBy.map((share, idx) => {
                        const userColor = share.userColor || getUserColor(share.userId);
                        return (
                          <div
                            key={idx}
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold bg-[var(--tg-theme-button-color,#3390ec)]"
                            style={{
                              boxShadow: `0 0 0 2px ${userColor}`
                            }}
                          >
                            {share.userAvatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={share.userAvatar}
                                alt={share.userName || 'User'}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              (share.userName || 'U').charAt(0).toUpperCase()
                            )}
                          </div>
                        );
                      })}
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
      <div className="bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] p-4 mx-4 rounded-xl mb-4">
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
