'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { useTelegramWebApp } from '../../hooks/useTelegramWebApp';
import { formatPrice } from '../../lib/formatNumber';

interface SessionData {
  id: string;
  adminId: number;
  participants: Array<{
    id: number;
    name: string;
    firstName?: string;
    username?: string;
  }>;
}

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const amount = searchParams.get('amount') || '0';
  const { user } = useTelegramWebApp();

  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Загружаем данные сессии для получения информации о казначее
  useEffect(() => {
    const fetchSession = async () => {
      if (!sessionId) return;

      try {
        const response = await fetch(`/api/sessions/${sessionId}`);
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

    fetchSession();
  }, [sessionId]);

  // Найти казначея (администратора сессии)
  const treasurer = sessionData?.participants.find(
    p => p.id === sessionData.adminId
  );
  const treasurerName = treasurer?.firstName || treasurer?.name || 'Администратор';
  const treasurerUsername = treasurer?.username;

  const handlePaymentConfirm = async () => {
    if (!sessionId || !user?.id) {
      setError('Ошибка: отсутствуют данные сессии или пользователя');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: String(user.id),
          amount: parseFloat(amount)
        })
      });

      if (!response.ok) {
        throw new Error('Failed to confirm payment');
      }

      // Переход на страницу отзывов
      router.push(`/review?sessionId=${sessionId}`);
    } catch (err) {
      console.error('Error confirming payment:', err);
      setError('Ошибка при подтверждении оплаты. Попробуйте снова.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--tg-theme-bg-color,#ffffff)] flex items-center justify-center">
        <div className="text-[var(--tg-theme-hint-color,#999999)]">Загрузка...</div>
      </div>
    );
  }

  if (!sessionData || Number(amount) === 0) {
    return (
      <div className="min-h-screen bg-[var(--tg-theme-bg-color,#ffffff)] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-[var(--tg-theme-text-color,#000000)] mb-2">
            Ошибка загрузки данных
          </div>
          <button
            onClick={() => router.back()}
            className="text-[var(--tg-theme-button-color,#3390ec)] underline"
          >
            Вернуться назад
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--tg-theme-bg-color,#ffffff)] flex justify-center">
      <div className="w-full max-w-[420px] flex flex-col h-screen">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--tg-theme-bg-color,#ffffff)] border-b border-[var(--tg-theme-hint-color,#e0e0e0)] z-10">
          <div className="p-4 flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="text-[var(--tg-theme-button-color,#3390ec)] text-2xl"
            >
              ←
            </button>
            <h1 className="text-lg font-semibold text-[var(--tg-theme-text-color,#000000)]">
              Оплата
            </h1>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-32 p-4">
          {/* Amount card */}
          <div className="bg-[var(--tg-theme-button-color,#3390ec)] rounded-2xl p-6 mb-4 text-center">
            <div className="text-white/70 text-sm mb-2">Ваша сумма к оплате:</div>
            <div className="text-white text-5xl font-bold">{formatPrice(Number(amount))}</div>
          </div>

          {/* Treasurer info */}
          <div className="bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] rounded-2xl p-4 mb-4">
            <div className="text-sm text-[var(--tg-theme-hint-color,#999999)] mb-2">
              Казначей:
            </div>
            <div className="text-lg font-semibold text-[var(--tg-theme-text-color,#000000)] mb-1">
              {treasurerName}
            </div>
            {treasurerUsername && (
              <div className="text-sm text-[var(--tg-theme-button-color,#3390ec)] mb-3">
                @{treasurerUsername}
              </div>
            )}

            {/* Instructions */}
            <div className="text-sm text-[var(--tg-theme-text-color,#000000)] leading-relaxed mt-3">
              <p className="mb-2">
                Переведите <strong>{formatPrice(Number(amount))}</strong> казначею
              </p>
              <p className="text-[var(--tg-theme-hint-color,#999999)] text-xs">
                Доступны переводы через СБП по номеру телефона
              </p>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-100 text-red-700 p-4 rounded-xl text-sm mb-4">
              {error}
            </div>
          )}
        </div>

        {/* Bottom button */}
        <div className="fixed bottom-0 left-0 right-0 bg-[var(--tg-theme-bg-color,#ffffff)] border-t border-[var(--tg-theme-hint-color,#e0e0e0)] p-4">
          <div className="max-w-[420px] mx-auto">
            <button
              onClick={handlePaymentConfirm}
              disabled={isSubmitting}
              className="w-full bg-[var(--tg-theme-button-color,#3390ec)] text-[var(--tg-theme-button-text-color,#ffffff)]
                         font-semibold py-4 rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Подтверждение...' : 'Я оплатил'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Payment() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--tg-theme-bg-color,#ffffff)] flex items-center justify-center">Загрузка...</div>}>
      <PaymentContent />
    </Suspense>
  );
}
