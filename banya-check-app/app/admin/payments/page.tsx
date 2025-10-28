'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';

type ParticipantPayment = {
  id: number;
  name: string;
  avatar: string;
  color: string;
  amount: number;
  hasPaid: boolean;
};

export default function AdminPayments() {
  const router = useRouter();

  // Mock data
  const payments: ParticipantPayment[] = [
    { id: 1, name: 'Андрей', avatar: 'https://i.pravatar.cc/150?img=12', color: '#FF6B6B', amount: 875, hasPaid: true },
    { id: 2, name: 'Мария', avatar: 'https://i.pravatar.cc/150?img=5', color: '#4ECDC4', amount: 1250, hasPaid: true },
    { id: 3, name: 'Иван', avatar: 'https://i.pravatar.cc/150?img=33', color: '#FFD93D', amount: 3125, hasPaid: true },
    { id: 4, name: 'Ольга', avatar: 'https://i.pravatar.cc/150?img=9', color: '#95E1D3', amount: 1800, hasPaid: false },
    { id: 5, name: 'Петр', avatar: 'https://i.pravatar.cc/150?img=15', color: '#A8E6CF', amount: 2200, hasPaid: false },
    { id: 6, name: 'Света', avatar: 'https://i.pravatar.cc/150?img=20', color: '#FFB6C1', amount: 1950, hasPaid: false },
    { id: 7, name: 'Макс', avatar: 'https://i.pravatar.cc/150?img=60', color: '#B4A7D6', amount: 1500, hasPaid: false },
    { id: 8, name: 'Анна', avatar: 'https://i.pravatar.cc/150?img=25', color: '#FFE5B4', amount: 1300, hasPaid: false },
  ];

  const totalCollected = payments.filter(p => p.hasPaid).reduce((sum, p) => sum + p.amount, 0);
  const totalPending = payments.filter(p => !p.hasPaid).reduce((sum, p) => sum + p.amount, 0);
  const paidCount = payments.filter(p => p.hasPaid).length;

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
              Контроль оплат
            </h1>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 pb-8">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-green-50 rounded-2xl p-4 border-2 border-green-200">
              <div className="text-sm text-green-700 mb-1">Собрано</div>
              <div className="text-2xl font-bold text-green-600">
                {totalCollected} ₽
              </div>
              <div className="text-xs text-green-600 mt-1">
                {paidCount} из {payments.length}
              </div>
            </div>

            <div className="bg-orange-50 rounded-2xl p-4 border-2 border-orange-200">
              <div className="text-sm text-orange-700 mb-1">Ожидается</div>
              <div className="text-2xl font-bold text-orange-600">
                {totalPending} ₽
              </div>
              <div className="text-xs text-orange-600 mt-1">
                {payments.length - paidCount} чел.
              </div>
            </div>
          </div>

          {/* Paid */}
          <div className="mb-6">
            <div className="text-sm font-medium text-green-600 mb-3 flex items-center gap-2">
              <span className="text-lg">✓</span>
              Оплатили ({paidCount})
            </div>
            <div className="space-y-2">
              {payments.filter(p => p.hasPaid).map(participant => (
                <div
                  key={participant.id}
                  className="bg-green-50 rounded-xl p-3 border border-green-200"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-full overflow-hidden border-2"
                      style={{ borderColor: participant.color }}
                    >
                      <Image
                        src={participant.avatar}
                        alt={participant.name}
                        width={48}
                        height={48}
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
                    <div className="text-green-600 text-2xl">✓</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending */}
          <div>
            <div className="text-sm font-medium text-orange-600 mb-3 flex items-center gap-2">
              <span className="text-lg">⏳</span>
              Ожидают оплаты ({payments.length - paidCount})
            </div>
            <div className="space-y-2">
              {payments.filter(p => !p.hasPaid).map(participant => (
                <div
                  key={participant.id}
                  className="bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] rounded-xl p-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-full overflow-hidden border-2"
                      style={{ borderColor: participant.color }}
                    >
                      <Image
                        src={participant.avatar}
                        alt={participant.name}
                        width={48}
                        height={48}
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
                    <button
                      onClick={() => {
                        if (confirm(`Отметить оплату от ${participant.name}?`)) {
                          // TODO: Обновить статус на сервере
                          alert('Оплата подтверждена');
                        }
                      }}
                      className="px-3 py-1.5 bg-[var(--tg-theme-button-color,#3390ec)] text-white rounded-lg text-sm font-medium transition-all active:scale-95"
                    >
                      Оплачено
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
