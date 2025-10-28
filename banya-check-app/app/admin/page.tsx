'use client';

import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const router = useRouter();

  // Mock data - в будущем из API
  const stats = {
    totalAmount: 14000,
    collectedAmount: 5250,
    pendingAmount: 8750,
    participantsCount: 8,
    paidCount: 3,
    itemsCount: 9
  };

  const actions = [
    {
      id: 'items',
      label: 'Управление позициями',
      icon: '📝',
      path: '/admin/items',
      description: `${stats.itemsCount} позиций`
    },
    {
      id: 'payments',
      label: 'Контроль оплат',
      icon: '💰',
      path: '/admin/payments',
      description: `${stats.paidCount} из ${stats.participantsCount} оплатили`
    },
    {
      id: 'participants',
      label: 'Участники',
      icon: '👥',
      path: '/admin/participants',
      description: `${stats.participantsCount} человек`
    },
    {
      id: 'close',
      label: 'Закрыть счет',
      icon: '✅',
      path: '/admin/close',
      description: 'Завершить посещение',
      danger: true
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--tg-theme-bg-color,#ffffff)] flex justify-center">
      <div className="w-full max-w-[420px] flex flex-col h-screen">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--tg-theme-bg-color,#ffffff)] border-b border-[var(--tg-theme-hint-color,#e0e0e0)] z-10">
          <div className="p-4 flex items-center gap-3">
            <button
              onClick={() => router.push('/landing')}
              className="text-[var(--tg-theme-button-color,#3390ec)] text-2xl"
            >
              ←
            </button>
            <h1 className="text-lg font-semibold text-[var(--tg-theme-text-color,#000000)]">
              Админ панель
            </h1>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 pb-8">
          {/* Visit info */}
          <div className="bg-[var(--tg-theme-button-color,#3390ec)] rounded-2xl p-4 mb-4 text-white">
            <div className="text-sm opacity-80 mb-1">Посещение</div>
            <div className="text-xl font-bold mb-3">Баня &quot;Изба&quot; • 8 марта 2025</div>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] rounded-2xl p-4">
              <div className="text-sm text-[var(--tg-theme-hint-color,#999999)] mb-1">Общий счёт</div>
              <div className="text-2xl font-bold text-[var(--tg-theme-text-color,#000000)]">
                {stats.totalAmount} ₽
              </div>
            </div>

            <div className="bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] rounded-2xl p-4">
              <div className="text-sm text-[var(--tg-theme-hint-color,#999999)] mb-1">Собрано</div>
              <div className="text-2xl font-bold text-green-600">
                {stats.collectedAmount} ₽
              </div>
            </div>

            <div className="bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] rounded-2xl p-4">
              <div className="text-sm text-[var(--tg-theme-hint-color,#999999)] mb-1">Ожидается</div>
              <div className="text-2xl font-bold text-orange-600">
                {stats.pendingAmount} ₽
              </div>
            </div>

            <div className="bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] rounded-2xl p-4">
              <div className="text-sm text-[var(--tg-theme-hint-color,#999999)] mb-1">Оплатили</div>
              <div className="text-2xl font-bold text-[var(--tg-theme-text-color,#000000)]">
                {stats.paidCount}/{stats.participantsCount}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {actions.map(action => (
              <button
                key={action.id}
                onClick={() => router.push(action.path)}
                className={`w-full rounded-2xl p-4 transition-all active:scale-95 text-left ${
                  action.danger
                    ? 'bg-red-50 border-2 border-red-200'
                    : 'bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{action.icon}</div>
                  <div className="flex-1">
                    <div className={`font-semibold ${
                      action.danger
                        ? 'text-red-600'
                        : 'text-[var(--tg-theme-text-color,#000000)]'
                    }`}>
                      {action.label}
                    </div>
                    <div className={`text-sm ${
                      action.danger
                        ? 'text-red-500'
                        : 'text-[var(--tg-theme-hint-color,#999999)]'
                    }`}>
                      {action.description}
                    </div>
                  </div>
                  <div className="text-[var(--tg-theme-hint-color,#999999)] text-xl">
                    →
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
