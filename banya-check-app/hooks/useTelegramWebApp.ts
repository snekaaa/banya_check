'use client';

import { useEffect, useState } from 'react';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    query_id?: string;
    auth_date?: number;
    hash?: string;
    start_param?: string;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
  };
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  isClosingConfirmationEnabled: boolean;
  BackButton: {
    isVisible: boolean;
    show: () => void;
    hide: () => void;
  };
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText: (text: string) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export function useTelegramWebApp() {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [startParam, setStartParam] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    console.log('[useTelegramWebApp] Initializing...');
    console.log('[useTelegramWebApp] window.Telegram:', typeof window !== 'undefined' ? window.Telegram : 'undefined');

    const initTelegram = () => {
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        console.log('[useTelegramWebApp] Telegram WebApp found:', tg);
        console.log('[useTelegramWebApp] initDataUnsafe:', tg.initDataUnsafe);
        console.log('[useTelegramWebApp] start_param:', tg.initDataUnsafe?.start_param);

        setWebApp(tg);
        setUser(tg.initDataUnsafe?.user || null);
        setStartParam(tg.initDataUnsafe?.start_param || null);

        // Сообщаем Telegram что приложение готово
        tg.ready();

        // Расширяем на весь экран
        tg.expand();

        setIsReady(true);
        console.log('[useTelegramWebApp] Initialized successfully');
      } else {
        console.warn('[useTelegramWebApp] Telegram WebApp not found, retrying...');
      }
    };

    // Пробуем сразу
    initTelegram();

    // Если не получилось, пробуем через 100мс (на случай если скрипт еще загружается)
    const timeout = setTimeout(initTelegram, 100);

    return () => clearTimeout(timeout);
  }, []);

  return {
    webApp,
    user,
    startParam,
    isReady,
  };
}
