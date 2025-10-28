'use client';

import { useRouter, useParams } from 'next/navigation';
import { useState } from 'react';
import Image from 'next/image';

type Participant = {
  id: number;
  name: string;
  avatar: string;
  color: string;
  share: number;
};

export default function EditItem() {
  const router = useRouter();
  const params = useParams();
  const itemId = params.id;

  // Mock data
  const [name, setName] = useState('Пивной набор');
  const [price, setPrice] = useState('1200');
  const [quantity, setQuantity] = useState('1');
  const [isCommon, setIsCommon] = useState(false);

  const [participants, setParticipants] = useState<Participant[]>([
    { id: 1, name: 'Андрей', avatar: 'https://i.pravatar.cc/150?img=12', color: '#FF6B6B', share: 1 },
    { id: 2, name: 'Мария', avatar: 'https://i.pravatar.cc/150?img=5', color: '#4ECDC4', share: 1 },
    { id: 3, name: 'Иван', avatar: 'https://i.pravatar.cc/150?img=33', color: '#FFD93D', share: 1 },
    { id: 4, name: 'Ольга', avatar: 'https://i.pravatar.cc/150?img=9', color: '#95E1D3', share: 0 },
    { id: 5, name: 'Петр', avatar: 'https://i.pravatar.cc/150?img=15', color: '#A8E6CF', share: 0 },
    { id: 6, name: 'Света', avatar: 'https://i.pravatar.cc/150?img=20', color: '#FFB6C1', share: 0 },
    { id: 7, name: 'Макс', avatar: 'https://i.pravatar.cc/150?img=60', color: '#B4A7D6', share: 0 },
    { id: 8, name: 'Анна', avatar: 'https://i.pravatar.cc/150?img=25', color: '#FFE5B4', share: 0 },
  ]);

  const toggleParticipant = (id: number) => {
    setParticipants(participants.map(p =>
      p.id === id ? { ...p, share: p.share > 0 ? 0 : 1 } : p
    ));
  };

  const updateShare = (id: number, share: number) => {
    const normalized = Math.max(0.1, Math.min(10, share));
    setParticipants(participants.map(p =>
      p.id === id ? { ...p, share: normalized } : p
    ));
  };

  const handleSave = () => {
    // TODO: Сохранить изменения на сервер
    console.log('Saving item:', { itemId, name, price, quantity, isCommon, participants });
    alert('Позиция обновлена');
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
              Редактирование позиции
            </h1>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-32 p-4">
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-[var(--tg-theme-text-color,#000000)] mb-2">
                Название
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)]
                           text-[var(--tg-theme-text-color,#000000)] border-2 border-transparent
                           focus:border-[var(--tg-theme-button-color,#3390ec)] outline-none"
              />
            </div>

            {/* Price and Quantity */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[var(--tg-theme-text-color,#000000)] mb-2">
                  Цена (₽)
                </label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)]
                             text-[var(--tg-theme-text-color,#000000)] border-2 border-transparent
                             focus:border-[var(--tg-theme-button-color,#3390ec)] outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--tg-theme-text-color,#000000)] mb-2">
                  Количество
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)]
                             text-[var(--tg-theme-text-color,#000000)] border-2 border-transparent
                             focus:border-[var(--tg-theme-button-color,#3390ec)] outline-none"
                />
              </div>
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-[var(--tg-theme-text-color,#000000)] mb-3">
                Тип расхода
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setIsCommon(true)}
                  className={`py-3 rounded-xl font-medium transition-all ${
                    isCommon
                      ? 'bg-[var(--tg-theme-button-color,#3390ec)] text-white'
                      : 'bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] text-[var(--tg-theme-text-color,#000000)]'
                  }`}
                >
                  Общий
                </button>
                <button
                  onClick={() => setIsCommon(false)}
                  className={`py-3 rounded-xl font-medium transition-all ${
                    !isCommon
                      ? 'bg-[var(--tg-theme-button-color,#3390ec)] text-white'
                      : 'bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] text-[var(--tg-theme-text-color,#000000)]'
                  }`}
                >
                  Частичный
                </button>
              </div>
            </div>

            {/* Participants */}
            <div>
              <label className="block text-sm font-medium text-[var(--tg-theme-text-color,#000000)] mb-3">
                Кто платит
              </label>
              <div className="space-y-2">
                {participants.map(participant => (
                  <div
                    key={participant.id}
                    className="bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] rounded-xl p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full overflow-hidden border-2 flex-shrink-0"
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
                      </div>
                      <div className="flex items-center gap-2">
                        {participant.share > 0 && !isCommon && (
                          <input
                            type="number"
                            step="0.5"
                            min="0.1"
                            max="10"
                            value={participant.share}
                            onChange={(e) => updateShare(participant.id, parseFloat(e.target.value) || 1)}
                            className="w-16 px-2 py-1 rounded-lg text-center bg-white border border-[var(--tg-theme-hint-color,#999999)]"
                          />
                        )}
                        <button
                          onClick={() => toggleParticipant(participant.id)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                            participant.share > 0
                              ? 'bg-green-500 text-white'
                              : 'bg-[var(--tg-theme-bg-color,#ffffff)] border-2 border-[var(--tg-theme-hint-color,#999999)]'
                          }`}
                        >
                          {participant.share > 0 ? '✓' : ''}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom button */}
        <div className="fixed bottom-0 left-0 right-0 bg-[var(--tg-theme-bg-color,#ffffff)] border-t border-[var(--tg-theme-hint-color,#e0e0e0)] p-4">
          <div className="max-w-[420px] mx-auto">
            <button
              onClick={handleSave}
              className="w-full bg-[var(--tg-theme-button-color,#3390ec)] text-white
                         font-semibold py-4 rounded-xl transition-all active:scale-95"
            >
              Сохранить изменения
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
