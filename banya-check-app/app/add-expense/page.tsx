'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';

function AddExpenseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [isCommon, setIsCommon] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      alert('Session ID не найден');
      router.back();
    }
  }, [sessionId, router]);

  const handleSubmit = async () => {
    console.log('[AddExpense] handleSubmit called');
    console.log('[AddExpense] sessionId:', sessionId);
    console.log('[AddExpense] name:', name, 'price:', price, 'isCommon:', isCommon);

    if (!name.trim() || !price) {
      alert('Заполните все поля');
      return;
    }

    setIsSubmitting(true);

    try {
      const url = `/api/sessions/${sessionId}/expenses`;
      console.log('[AddExpense] Sending POST to:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          price: parseFloat(price),
          isCommon
        }),
      });

      console.log('[AddExpense] Response status:', response.status);

      if (!response.ok) {
        throw new Error('Ошибка при добавлении расхода');
      }

      const data = await response.json();
      console.log('Expense added:', data);

      // Показываем модальное окно с подтверждением
      setShowConfirmModal(true);

      // Автоматически закрываем через 2 секунды
      setTimeout(() => {
        router.back();
      }, 2000);
    } catch (error) {
      console.error('Error adding expense:', error);
      alert('Ошибка при добавлении расхода. Попробуйте еще раз.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--tg-theme-bg-color,#ffffff)] flex justify-center">
      <div className="w-full max-w-[420px] flex flex-col h-screen">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--tg-theme-bg-color,#ffffff)] z-10">
          <div className="p-4 flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="text-[var(--tg-theme-button-color,#3390ec)] text-2xl"
            >
              ←
            </button>
            <h1 className="text-lg font-semibold text-[var(--tg-theme-text-color,#000000)]">
              Добавить общий расход
            </h1>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {/* Name input */}
            <div>
              <label className="block text-sm font-medium text-[var(--tg-theme-text-color,#000000)] mb-2">
                Название расхода
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Аренда парной"
                className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)]
                           text-[var(--tg-theme-text-color,#000000)] border-2 border-transparent
                           focus:border-[var(--tg-theme-button-color,#3390ec)] outline-none"
              />
            </div>

            {/* Price input */}
            <div>
              <label className="block text-sm font-medium text-[var(--tg-theme-text-color,#000000)] mb-2">
                Сумма (₽)
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)]
                           text-[var(--tg-theme-text-color,#000000)] text-2xl font-semibold border-2 border-transparent
                           focus:border-[var(--tg-theme-button-color,#3390ec)] outline-none"
              />
            </div>

            {/* Type toggle */}
            <div>
              <label className="block text-sm font-medium text-[var(--tg-theme-text-color,#000000)] mb-3">
                Тип расхода
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setIsCommon(true)}
                  className={`py-4 rounded-xl font-medium transition-all ${
                    isCommon
                      ? 'bg-[var(--tg-theme-button-color,#3390ec)] text-white'
                      : 'bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] text-[var(--tg-theme-text-color,#000000)]'
                  }`}
                >
                  Общий
                </button>
                <button
                  onClick={() => setIsCommon(false)}
                  className={`py-4 rounded-xl font-medium transition-all ${
                    !isCommon
                      ? 'bg-[var(--tg-theme-button-color,#3390ec)] text-white'
                      : 'bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] text-[var(--tg-theme-text-color,#000000)]'
                  }`}
                >
                  Частичный
                </button>
              </div>
              <div className="mt-2 text-xs text-[var(--tg-theme-hint-color,#999999)]">
                {isCommon
                  ? 'Расход будет разделен поровну между всеми участниками'
                  : 'Участники смогут выбрать, платят ли они за эту позицию'
                }
              </div>
            </div>

            {/* Examples */}
            <div className="bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] rounded-xl p-4">
              <div className="text-sm font-medium text-[var(--tg-theme-text-color,#000000)] mb-2">
                Примеры:
              </div>
              <div className="text-sm text-[var(--tg-theme-hint-color,#999999)] space-y-1">
                <div>• Аренда парной (общий)</div>
                <div>• Веники березовые (общий)</div>
                <div>• Самовар (общий)</div>
                <div>• Пивной набор (частичный)</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom button */}
        <div className="fixed bottom-0 left-0 right-0 bg-[var(--tg-theme-bg-color,#ffffff)] p-4">
          <div className="max-w-[420px] mx-auto">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full bg-[var(--tg-theme-button-color,#3390ec)] text-[var(--tg-theme-button-text-color,#ffffff)]
                         font-semibold py-4 rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Добавление...' : 'Добавить расход'}
            </button>
          </div>
        </div>

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--tg-theme-bg-color,#ffffff)] rounded-2xl p-6 max-w-[340px] w-full max-h-[80vh] flex flex-col">
              <div className="text-center mb-4">
                <div className="text-5xl mb-3">✅</div>
                <h2 className="text-xl font-bold text-[var(--tg-theme-text-color,#000000)] mb-2">
                  Расход добавлен
                </h2>
              </div>

              <div className="overflow-y-auto flex-1">
                <div className="bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] rounded-xl p-4 space-y-2">
                  <div className="text-sm text-[var(--tg-theme-hint-color,#999999)]">
                    Название
                  </div>
                  <div className="text-base font-medium text-[var(--tg-theme-text-color,#000000)] break-words">
                    {name}
                  </div>

                  <div className="text-sm text-[var(--tg-theme-hint-color,#999999)] mt-3">
                    Сумма
                  </div>
                  <div className="text-2xl font-bold text-[var(--tg-theme-text-color,#000000)]">
                    {price} ₽
                  </div>

                  <div className="text-sm text-[var(--tg-theme-hint-color,#999999)] mt-3">
                    Тип
                  </div>
                  <div className="text-base font-medium text-[var(--tg-theme-text-color,#000000)]">
                    {isCommon ? 'Общий' : 'Частичный'}
                  </div>
                </div>
              </div>

              <button
                onClick={() => router.back()}
                className="mt-4 w-full bg-[var(--tg-theme-button-color,#3390ec)] text-[var(--tg-theme-button-text-color,#ffffff)]
                           font-semibold py-3 rounded-xl transition-all active:scale-95"
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AddExpense() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[var(--tg-theme-bg-color,#ffffff)]">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <div className="text-[var(--tg-theme-text-color,#000000)]">Загрузка...</div>
        </div>
      </div>
    }>
      <AddExpenseContent />
    </Suspense>
  );
}
