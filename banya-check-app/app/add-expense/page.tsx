'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AddExpense() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [isCommon, setIsCommon] = useState(true);

  const handleSubmit = () => {
    if (!name.trim() || !price) {
      alert('Заполните все поля');
      return;
    }

    // TODO: Отправить данные на сервер
    const expense = {
      name: name.trim(),
      price: parseFloat(price),
      isCommon
    };

    console.log('Adding expense:', expense);
    alert(`Добавлен расход: ${expense.name} - ${expense.price} ₽${expense.isCommon ? ' (общий)' : ''}`);
    router.back();
  };

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
        <div className="fixed bottom-0 left-0 right-0 bg-[var(--tg-theme-bg-color,#ffffff)] border-t border-[var(--tg-theme-hint-color,#e0e0e0)] p-4">
          <div className="max-w-[420px] mx-auto">
            <button
              onClick={handleSubmit}
              className="w-full bg-[var(--tg-theme-button-color,#3390ec)] text-[var(--tg-theme-button-text-color,#ffffff)]
                         font-semibold py-4 rounded-xl transition-all active:scale-95"
            >
              Добавить расход
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
