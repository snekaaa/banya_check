'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type CheckItem = {
  id: number;
  name: string;
  price: number;
  quantity: number;
  isCommon?: boolean;
  selectedCount: number;
};

export default function AdminItems() {
  const router = useRouter();

  // Mock data
  const [items, setItems] = useState<CheckItem[]>([
    { id: 1, name: 'Аренда парной (2 часа)', price: 3000, quantity: 1, isCommon: true, selectedCount: 8 },
    { id: 2, name: 'Веники березовые', price: 500, quantity: 4, isCommon: false, selectedCount: 3 },
    { id: 3, name: 'Пивной набор', price: 1200, quantity: 1, isCommon: false, selectedCount: 3 },
    { id: 4, name: 'Чай травяной', price: 300, quantity: 2, isCommon: false, selectedCount: 2 },
    { id: 5, name: 'Салат Цезарь', price: 450, quantity: 3, isCommon: false, selectedCount: 2 },
    { id: 6, name: 'Шашлык из курицы', price: 650, quantity: 5, isCommon: false, selectedCount: 4 },
    { id: 7, name: 'Картофель по-деревенски', price: 300, quantity: 2, isCommon: false, selectedCount: 2 },
    { id: 8, name: 'Морс клюквенный', price: 200, quantity: 4, isCommon: false, selectedCount: 3 },
    { id: 9, name: 'Пельмени домашние', price: 400, quantity: 3, isCommon: false, selectedCount: 2 },
  ]);

  const handleDelete = (id: number) => {
    if (confirm('Удалить эту позицию?')) {
      setItems(items.filter(item => item.id !== id));
    }
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
            <h1 className="text-lg font-semibold text-[var(--tg-theme-text-color,#000000)] flex-1">
              Управление позициями
            </h1>
            <button
              onClick={() => router.push('/add-expense')}
              className="text-[var(--tg-theme-button-color,#3390ec)] font-semibold"
            >
              + Добавить
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 pb-8">
          <div className="space-y-3">
            {items.map(item => (
              <div
                key={item.id}
                className="bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] rounded-2xl p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-medium text-[var(--tg-theme-text-color,#000000)] mb-1">
                      {item.name}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-[var(--tg-theme-text-color,#000000)] font-semibold">
                        {item.price} ₽
                      </span>
                      {item.quantity > 1 && (
                        <span className="text-[var(--tg-theme-hint-color,#999999)]">
                          × {item.quantity}
                        </span>
                      )}
                      {item.isCommon && (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-600">
                          общее
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-[var(--tg-theme-hint-color,#999999)]">
                    Выбрали: {item.selectedCount} чел.
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/admin/items/${item.id}/edit`)}
                      className="px-3 py-1.5 bg-[var(--tg-theme-button-color,#3390ec)] text-white rounded-lg text-sm font-medium transition-all active:scale-95"
                    >
                      Редактировать
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-all active:scale-95"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
