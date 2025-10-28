'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Image from 'next/image';

type Participant = {
  id: number;
  name: string;
  avatar: string;
  color: string;
  amount: number;
  hasPaid: boolean;
};

type UnassignedItem = {
  id: number;
  name: string;
  price: number;
  quantity: number;
  remaining: number;
};

export default function AdminClose() {
  const router = useRouter();
  const [isClosing, setIsClosing] = useState(false);

  // Mock data
  const participants: Participant[] = [
    { id: 1, name: 'Андрей', avatar: 'https://i.pravatar.cc/150?img=12', color: '#FF6B6B', amount: 875, hasPaid: true },
    { id: 2, name: 'Мария', avatar: 'https://i.pravatar.cc/150?img=5', color: '#4ECDC4', amount: 1250, hasPaid: true },
    { id: 3, name: 'Иван', avatar: 'https://i.pravatar.cc/150?img=33', color: '#FFD93D', amount: 3125, hasPaid: true },
    { id: 4, name: 'Ольга', avatar: 'https://i.pravatar.cc/150?img=9', color: '#95E1D3', amount: 1800, hasPaid: false },
    { id: 5, name: 'Петр', avatar: 'https://i.pravatar.cc/150?img=15', color: '#A8E6CF', amount: 2200, hasPaid: false },
    { id: 6, name: 'Света', avatar: 'https://i.pravatar.cc/150?img=20', color: '#FFB6C1', amount: 1950, hasPaid: false },
    { id: 7, name: 'Макс', avatar: 'https://i.pravatar.cc/150?img=60', color: '#B4A7D6', amount: 1500, hasPaid: false },
    { id: 8, name: 'Анна', avatar: 'https://i.pravatar.cc/150?img=25', color: '#FFE5B4', amount: 1300, hasPaid: false },
  ];

  const unassignedItems: UnassignedItem[] = [
    { id: 2, name: 'Веники березовые', price: 500, quantity: 4, remaining: 1 },
    { id: 8, name: 'Морс клюквенный', price: 200, quantity: 4, remaining: 1 },
  ];

  const totalAmount = participants.reduce((sum, p) => sum + p.amount, 0);
  const paidCount = participants.filter(p => p.hasPaid).length;
  const unpaidCount = participants.length - paidCount;
  const hasUnassigned = unassignedItems.length > 0;

  const handleClose = () => {
    if (unpaidCount > 0) {
      if (!confirm(`${unpaidCount} человек ещё не оплатили. Закрыть счёт?`)) {
        return;
      }
    }

    setIsClosing(true);
    // TODO: Отправить запрос на закрытие счета
    setTimeout(() => {
      alert('Счёт успешно закрыт!');
      router.push('/landing');
    }, 1000);
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
              disabled={isClosing}
            >
              ←
            </button>
            <h1 className="text-lg font-semibold text-[var(--tg-theme-text-color,#000000)]">
              Закрытие счёта
            </h1>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-32 p-4">
          {/* Warning if unpaid */}
          {unpaidCount > 0 && (
            <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">⚠️</div>
                <div className="flex-1">
                  <div className="font-semibold text-orange-700 mb-1">
                    Не все оплатили
                  </div>
                  <div className="text-sm text-orange-600">
                    {unpaidCount} {unpaidCount === 1 ? 'человек' : 'человека'} ещё не оплатил счёт
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Unassigned items warning */}
          {hasUnassigned && (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">⚠️</div>
                <div className="flex-1">
                  <div className="font-semibold text-yellow-700 mb-2">
                    Нераспределённые позиции
                  </div>
                  <div className="space-y-1 mb-2">
                    {unassignedItems.map(item => (
                      <div key={item.id} className="text-sm text-yellow-600">
                        • {item.name} - осталось {item.remaining} из {item.quantity}
                      </div>
                    ))}
                  </div>
                  <div className="text-sm text-yellow-600">
                    Будут разделены поровну между всеми участниками
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="bg-[var(--tg-theme-button-color,#3390ec)] rounded-2xl p-4 mb-4 text-white">
            <div className="text-sm opacity-80 mb-1">Итоговая сумма</div>
            <div className="text-4xl font-bold mb-4">{totalAmount} ₽</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs opacity-80">Оплатили</div>
                <div className="text-xl font-semibold">{paidCount} чел.</div>
              </div>
              <div>
                <div className="text-xs opacity-80">Не оплатили</div>
                <div className="text-xl font-semibold">{unpaidCount} чел.</div>
              </div>
            </div>
          </div>

          {/* Participants list */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-[var(--tg-theme-text-color,#000000)] mb-3">
              Участники
            </div>
            {participants.map(participant => (
              <div
                key={participant.id}
                className={`rounded-xl p-3 ${
                  participant.hasPaid
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full overflow-hidden border-2"
                    style={{ borderColor: participant.color }}
                  >
                    <Image
                      src={participant.avatar}
                      alt={participant.name}
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-[var(--tg-theme-text-color,#000000)]">
                      {participant.name}
                    </div>
                    <div className="text-sm text-[var(--tg-theme-hint-color,#999999)]">
                      {participant.amount} ₽
                    </div>
                  </div>
                  {participant.hasPaid ? (
                    <div className="text-green-600 text-xl">✓</div>
                  ) : (
                    <div className="text-orange-500 text-xl">⏳</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom button */}
        <div className="fixed bottom-0 left-0 right-0 bg-[var(--tg-theme-bg-color,#ffffff)] border-t border-[var(--tg-theme-hint-color,#e0e0e0)] p-4">
          <div className="max-w-[420px] mx-auto">
            <button
              onClick={handleClose}
              disabled={isClosing}
              className={`w-full font-semibold py-4 rounded-xl transition-all ${
                isClosing
                  ? 'bg-[var(--tg-theme-hint-color,#999999)] text-white cursor-not-allowed'
                  : 'bg-red-600 text-white active:scale-95'
              }`}
            >
              {isClosing ? 'Закрываем...' : 'Закрыть счёт'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
