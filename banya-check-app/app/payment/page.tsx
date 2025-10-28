'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const amount = searchParams.get('amount') || '0';
  const [copied, setCopied] = useState<string | null>(null);

  const treasurer = {
    name: 'Андрей Носов',
    phone: '+7 (999) 123-45-67',
    banks: [
      { name: 'Сбербанк', color: '#21A038' },
      { name: 'Тинькофф', color: '#FFDD2D' },
      { name: 'ВТБ', color: '#0088CC' },
    ]
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handlePaymentConfirm = () => {
    // TODO: Отправить подтверждение на сервер
    router.push('/review');
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
              Оплата
            </h1>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-32 p-4">
          {/* Amount card */}
          <div className="bg-[var(--tg-theme-button-color,#3390ec)] rounded-2xl p-6 mb-4 text-center">
            <div className="text-white/70 text-sm mb-2">Ваша сумма к оплате:</div>
            <div className="text-white text-5xl font-bold">{Math.round(Number(amount))} ₽</div>
          </div>

          {/* Treasurer info */}
          <div className="bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] rounded-2xl p-4 mb-4">
            <div className="text-sm text-[var(--tg-theme-hint-color,#999999)] mb-2">
              Казначей:
            </div>
            <div className="text-lg font-semibold text-[var(--tg-theme-text-color,#000000)] mb-3">
              {treasurer.name}
            </div>

            {/* Phone */}
            <div className="mb-3">
              <div className="text-xs text-[var(--tg-theme-hint-color,#999999)] mb-1">
                Номер телефона:
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 text-[var(--tg-theme-text-color,#000000)] font-medium">
                  {treasurer.phone}
                </div>
                <button
                  onClick={() => copyToClipboard(treasurer.phone, 'phone')}
                  className="px-3 py-2 bg-[var(--tg-theme-button-color,#3390ec)] text-white rounded-lg text-sm"
                >
                  {copied === 'phone' ? '✓' : 'Копировать'}
                </button>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] rounded-2xl p-4">
            <div className="text-sm text-[var(--tg-theme-text-color,#000000)] leading-relaxed">
              <p className="mb-2">
                Переведите <strong>{Math.round(Number(amount))} ₽</strong> на номер телефона казначея
              </p>
              <p className="text-[var(--tg-theme-hint-color,#999999)] text-xs mt-3">
                Доступны переводы через: Сбербанк, Тинькофф, ВТБ и другие банки по номеру телефона
              </p>
            </div>
          </div>
        </div>

        {/* Bottom button */}
        <div className="fixed bottom-0 left-0 right-0 bg-[var(--tg-theme-bg-color,#ffffff)] border-t border-[var(--tg-theme-hint-color,#e0e0e0)] p-4">
          <div className="max-w-[420px] mx-auto">
            <button
              onClick={handlePaymentConfirm}
              className="w-full bg-[var(--tg-theme-button-color,#3390ec)] text-[var(--tg-theme-button-text-color,#ffffff)]
                         font-semibold py-4 rounded-xl transition-all active:scale-95"
            >
              Я оплатил
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
