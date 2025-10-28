'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface OnlineUser {
  userId: number;
  userName: string;
  userAvatar: string;
  userColor: string;
}

interface UseSessionPresenceProps {
  sessionId: string | null;
  userId: number | null;
  userName: string | null;
  userAvatar: string | null;
  userColor: string | null;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export function useSessionPresence({
  sessionId,
  userId,
  userName,
  userAvatar,
  userColor,
}: UseSessionPresenceProps) {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isIntentionalCloseRef = useRef(false);

  // Вычисляем задержку переподключения с экспоненциальным backoff
  const getReconnectDelay = (attempt: number): number => {
    // Задержки: 1s, 2s, 4s, 8s, 16s, 30s (max)
    const baseDelay = 1000;
    const maxDelay = 30000;
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    return delay;
  };

  // Функция для запуска ping-интервала
  const startPingInterval = useCallback(() => {
    // Очищаем старый интервал если есть
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }

    // Отправляем ping каждые 5 секунд
    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'ping' }));
        } catch (error) {
          console.log('⚠️ Ошибка отправки ping:', error);
        }
      }
    }, 5000); // 5 секунд - половина от таймаута в 10 секунд
  }, []);

  // Функция переподключения
  const scheduleReconnect = useCallback(() => {
    // Не переподключаемся если закрытие было намеренным
    if (isIntentionalCloseRef.current) {
      return;
    }

    const delay = getReconnectDelay(reconnectAttemptsRef.current);
    console.log(`🔄 Переподключение через ${delay}ms (попытка ${reconnectAttemptsRef.current + 1})`);

    setConnectionStatus('reconnecting');

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current += 1;
      connect();
    }, delay);
  }, []);

  const connect = useCallback(() => {
    if (!sessionId || !userId || !userName) {
      console.log('⚠️ WebSocket: нет данных для подключения', { sessionId, userId, userName });
      return;
    }

    // Закрываем существующее соединение если есть
    if (wsRef.current) {
      isIntentionalCloseRef.current = true;
      wsRef.current.close();
      isIntentionalCloseRef.current = false;
    }

    // Очищаем ping интервал
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    try {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3003';
      console.log('🔌 Подключаемся к WebSocket:', wsUrl);
      console.log('📊 Окружение:', {
        NODE_ENV: process.env.NODE_ENV,
        NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL
      });

      // Пропускаем WebSocket в production если нет правильного URL
      if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_WS_URL) {
        console.log('⚠️ WebSocket отключен (NEXT_PUBLIC_WS_URL не настроен)');
        return;
      }

      setConnectionStatus('connecting');

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket подключен');
        setConnectionStatus('connected');

        // Сбрасываем счётчик попыток переподключения
        reconnectAttemptsRef.current = 0;

        // Отправляем событие присоединения к сессии
        ws.send(JSON.stringify({
          type: 'join',
          sessionId,
          userId,
          userName,
          userAvatar: userAvatar || '',
          userColor: userColor || '#FF6B6B',
        }));

        // Запускаем ping интервал
        startPingInterval();
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case 'online_users':
              // Получили полный список онлайн пользователей
              setOnlineUsers(message.users);
              break;

            case 'user_joined':
              // Новый пользователь присоединился
              setOnlineUsers((prev) => {
                // Проверяем, нет ли уже такого пользователя
                if (prev.some((u) => u.userId === message.userId)) {
                  return prev;
                }
                return [
                  ...prev,
                  {
                    userId: message.userId,
                    userName: message.userName,
                    userAvatar: message.userAvatar,
                    userColor: message.userColor,
                  },
                ];
              });
              break;

            case 'user_left':
              // Пользователь отключился
              setOnlineUsers((prev) =>
                prev.filter((u) => u.userId !== message.userId)
              );
              break;

            case 'pong':
              // Ответ на ping - соединение живо
              break;

            default:
              // Игнорируем неизвестные типы сообщений
              break;
          }
        } catch (error) {
          // Тихо игнорируем ошибки парсинга
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket ошибка:', error);
        console.error('❌ WebSocket URL:', wsUrl);
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket закрыт:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        setConnectionStatus('disconnected');
        wsRef.current = null;

        // Очищаем ping интервал
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Пытаемся переподключиться если закрытие не было намеренным
        if (!isIntentionalCloseRef.current) {
          scheduleReconnect();
        }
      };
    } catch (error) {
      console.log('❌ Ошибка подключения WebSocket:', error);
      setConnectionStatus('disconnected');
      scheduleReconnect();
    }
  }, [sessionId, userId, userName, userAvatar, userColor, startPingInterval, scheduleReconnect]);

  // Подключаемся при монтировании и при изменении данных
  useEffect(() => {
    connect();

    // Cleanup при размонтировании
    return () => {
      // Устанавливаем флаг намеренного закрытия
      isIntentionalCloseRef.current = true;

      // Очищаем таймауты и интервалы
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      // Закрываем WebSocket
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      // Сбрасываем состояние
      setConnectionStatus('disconnected');
      setOnlineUsers([]);
    };
  }, [connect]);

  return {
    onlineUsers,
    isConnected: connectionStatus === 'connected',
    connectionStatus,
  };
}
