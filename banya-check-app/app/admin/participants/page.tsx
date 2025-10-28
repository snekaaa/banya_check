'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Image from 'next/image';

type Participant = {
  id: number;
  name: string;
  avatar: string;
  color: string;
  role: 'admin' | 'participant';
  amount: number;
};

export default function AdminParticipants() {
  const router = useRouter();

  // Mock data
  const [participants, setParticipants] = useState<Participant[]>([
    { id: 1, name: 'Андрей', avatar: 'https://i.pravatar.cc/150?img=12', color: '#FF6B6B', role: 'admin', amount: 875 },
    { id: 2, name: 'Мария', avatar: 'https://i.pravatar.cc/150?img=5', color: '#4ECDC4', role: 'participant', amount: 1250 },
    { id: 3, name: 'Иван', avatar: 'https://i.pravatar.cc/150?img=33', color: '#FFD93D', role: 'participant', amount: 3125 },
    { id: 4, name: 'Ольга', avatar: 'https://i.pravatar.cc/150?img=9', color: '#95E1D3', role: 'participant', amount: 1800 },
    { id: 5, name: 'Петр', avatar: 'https://i.pravatar.cc/150?img=15', color: '#A8E6CF', role: 'participant', amount: 2200 },
    { id: 6, name: 'Света', avatar: 'https://i.pravatar.cc/150?img=20', color: '#FFB6C1', role: 'participant', amount: 1950 },
    { id: 7, name: 'Макс', avatar: 'https://i.pravatar.cc/150?img=60', color: '#B4A7D6', role: 'participant', amount: 1500 },
    { id: 8, name: 'Анна', avatar: 'https://i.pravatar.cc/150?img=25', color: '#FFE5B4', role: 'participant', amount: 1300 },
  ]);

  const handleDelete = (id: number, name: string) => {
    if (confirm(`Удалить ${name} из посещения?`)) {
      setParticipants(participants.filter(p => p.id !== id));
    }
  };

  const toggleRole = (id: number) => {
    setParticipants(participants.map(p =>
      p.id === id ? { ...p, role: p.role === 'admin' ? 'participant' : 'admin' } : p
    ));
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
              Участники
            </h1>
            <button
              onClick={() => alert('Добавление участника')}
              className="text-[var(--tg-theme-button-color,#3390ec)] font-semibold"
            >
              + Добавить
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 pb-8">
          <div className="text-sm text-[var(--tg-theme-hint-color,#999999)] mb-4">
            Всего участников: {participants.length}
          </div>

          <div className="space-y-3">
            {participants.map(participant => (
              <div
                key={participant.id}
                className="bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] rounded-2xl p-4"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-14 h-14 rounded-full overflow-hidden border-2"
                    style={{ borderColor: participant.color }}
                  >
                    <Image
                      src={participant.avatar}
                      alt={participant.name}
                      width={56}
                      height={56}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-[var(--tg-theme-text-color,#000000)] mb-1">
                      {participant.name}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        participant.role === 'admin'
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {participant.role === 'admin' ? 'Админ' : 'Участник'}
                      </span>
                      <span className="text-sm text-[var(--tg-theme-hint-color,#999999)]">
                        {participant.amount} ₽
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => toggleRole(participant.id)}
                    className="flex-1 py-2 bg-[var(--tg-theme-bg-color,#ffffff)] text-[var(--tg-theme-text-color,#000000)]
                               rounded-lg text-sm font-medium transition-all active:scale-95 border border-[var(--tg-theme-hint-color,#999999)]"
                  >
                    {participant.role === 'admin' ? 'Снять админа' : 'Сделать админом'}
                  </button>
                  {participant.role !== 'admin' && (
                    <button
                      onClick={() => handleDelete(participant.id, participant.name)}
                      className="px-4 py-2 bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-all active:scale-95"
                    >
                      Удалить
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
