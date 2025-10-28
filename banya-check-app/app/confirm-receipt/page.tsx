'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';

type CheckItem = {
  name: string;
  price: number;
  quantity: number;
  isCommon: boolean;
};

function ConfirmReceiptContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const receiptId = searchParams.get('receiptId');
  const token = searchParams.get('token');
  const sessionId = searchParams.get('sessionId');

  const [items, setItems] = useState<CheckItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Отсутствует токен');
      setLoading(false);
      return;
    }

    let pollCount = 0;
    const maxPolls = 10; // Максимум 10 попыток (~10 секунд)

    const pollStatus = async () => {
      try {
        // Используем Next.js API route для проксирования
        const res = await fetch(`/api/receipts/status/${token}`);
        const data = await res.json();

        console.log('Receipt status:', data.status, 'Poll count:', pollCount);

        if (data.status === 'completed' && data.items) {
          setItems(data.items);
          setLoading(false);
        } else if (data.status === 'processing') {
          pollCount++;
          if (pollCount < maxPolls) {
            // Продолжаем опрашивать каждую секунду
            setTimeout(pollStatus, 1000);
          } else {
            setError('Превышено время ожидания. Попробуйте обновить страницу через несколько секунд.');
            setLoading(false);
          }
        } else if (data.status === 'failed') {
          setError(data.error || 'Не удалось распознать чек');
          setLoading(false);
        } else {
          setError('Не удалось получить данные чека');
          setLoading(false);
        }
      } catch (err) {
        console.error('Error polling status:', err);
        setError('Ошибка загрузки данных');
        setLoading(false);
      }
    };

    pollStatus();
  }, [token]);

  const handleItemChange = (index: number, field: keyof CheckItem, value: string | number | boolean) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      [field]: value,
    };
    setItems(newItems);
  };

  const handleDeleteItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      { name: '', price: 0, quantity: 1, isCommon: false }
    ]);
  };

  const handleConfirm = async () => {
    if (items.length === 0) {
      alert('Добавьте хотя бы одну позицию');
      return;
    }

    // Валидация
    const invalidItems = items.filter(item => !item.name.trim() || item.price <= 0 || item.quantity <= 0);
    if (invalidItems.length > 0) {
      alert('Проверьте все позиции: название не должно быть пустым, цена и количество должны быть больше нуля');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Используем Next.js API route для проксирования
      const response = await fetch('/api/receipts/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiptId,
          sessionId,
          items,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка сохранения');
      }

      // Успешно сохранено
      alert('Позиции добавлены!');
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
      setSaving(false);
    }
  };

  const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--tg-theme-bg-color,#ffffff)] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin text-6xl mb-4">⏳</div>
          <div className="text-lg font-semibold text-[var(--tg-theme-text-color,#000000)]">
            Загрузка...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--tg-theme-bg-color,#ffffff)] flex justify-center pb-24">
      <div className="w-full max-w-[420px] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--tg-theme-bg-color,#ffffff)] border-b border-[var(--tg-theme-hint-color,#e0e0e0)] z-10">
          <div className="p-4 flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="text-[var(--tg-theme-button-color,#3390ec)] text-2xl"
              disabled={saving}
            >
              ←
            </button>
            <h1 className="text-lg font-semibold text-[var(--tg-theme-text-color,#000000)] flex-1">
              Проверьте позиции
            </h1>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="m-4 bg-red-100 text-red-700 p-4 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Items List */}
        <div className="p-4 space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-8 text-[var(--tg-theme-hint-color,#999999)]">
              Позиции не найдены. Добавьте их вручную.
            </div>
          ) : (
            items.map((item, index) => (
              <div
                key={index}
                className="bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] rounded-2xl p-4 space-y-3"
              >
                {/* Item name */}
                <div>
                  <label className="block text-xs font-medium text-[var(--tg-theme-hint-color,#999999)] mb-1">
                    Название
                  </label>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white text-[var(--tg-theme-text-color,#000000)] border border-[var(--tg-theme-hint-color,#e0e0e0)] focus:border-[var(--tg-theme-button-color,#3390ec)] outline-none"
                    placeholder="Название позиции"
                  />
                </div>

                {/* Price and Quantity */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--tg-theme-hint-color,#999999)] mb-1">
                      Цена (₽)
                    </label>
                    <input
                      type="number"
                      value={item.price}
                      onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-lg bg-white text-[var(--tg-theme-text-color,#000000)] border border-[var(--tg-theme-hint-color,#e0e0e0)] focus:border-[var(--tg-theme-button-color,#3390ec)] outline-none"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--tg-theme-hint-color,#999999)] mb-1">
                      Количество
                    </label>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 1)}
                      className="w-full px-3 py-2 rounded-lg bg-white text-[var(--tg-theme-text-color,#000000)] border border-[var(--tg-theme-hint-color,#e0e0e0)] focus:border-[var(--tg-theme-button-color,#3390ec)] outline-none"
                      min="1"
                      step="0.1"
                    />
                  </div>
                </div>

                {/* Common toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-[var(--tg-theme-text-color,#000000)]">
                      Общая позиция
                    </div>
                    <div className="text-xs text-[var(--tg-theme-hint-color,#999999)]">
                      Делится на всех участников
                    </div>
                  </div>
                  <button
                    onClick={() => handleItemChange(index, 'isCommon', !item.isCommon)}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      item.isCommon
                        ? 'bg-[var(--tg-theme-button-color,#3390ec)]'
                        : 'bg-[var(--tg-theme-hint-color,#999999)]'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full transition-transform ${
                        item.isCommon ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Delete button */}
                <button
                  onClick={() => handleDeleteItem(index)}
                  className="w-full py-2 text-sm text-red-600 font-medium"
                >
                  Удалить позицию
                </button>
              </div>
            ))
          )}

          {/* Add item button */}
          <button
            onClick={handleAddItem}
            className="w-full py-3 bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] text-[var(--tg-theme-button-color,#3390ec)] font-medium rounded-xl transition-all active:scale-95"
          >
            + Добавить позицию вручную
          </button>
        </div>

        {/* Bottom bar with total and confirm button */}
        <div className="fixed bottom-0 left-0 right-0 bg-[var(--tg-theme-bg-color,#ffffff)] border-t border-[var(--tg-theme-hint-color,#e0e0e0)] p-4">
          <div className="max-w-[420px] mx-auto">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[var(--tg-theme-hint-color,#999999)]">Общая сумма:</span>
              <span className="text-2xl font-bold text-[var(--tg-theme-text-color,#000000)]">
                {Math.round(totalAmount)} ₽
              </span>
            </div>
            <button
              onClick={handleConfirm}
              disabled={saving || items.length === 0}
              className="w-full bg-[var(--tg-theme-button-color,#3390ec)] text-[var(--tg-theme-button-text-color,#ffffff)] font-semibold py-4 rounded-xl transition-all active:scale-95 disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : `Подтвердить ${items.length} ${items.length === 1 ? 'позицию' : 'позиций'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmReceipt() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--tg-theme-bg-color,#ffffff)] flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-[var(--tg-theme-text-color,#000000)]">Загрузка...</div>
        </div>
      </div>
    }>
      <ConfirmReceiptContent />
    </Suspense>
  );
}
