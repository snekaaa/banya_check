'use client';

interface Participant {
  id: string;
  telegramId: string;
  username?: string;
  firstName?: string;
  avatar?: string;
  color?: string;
  selectionConfirmed: boolean;
  hasPayment?: boolean;
  isOnline?: boolean;
  amount?: number;
}

interface ParticipantsStatusProps {
  participants: Participant[];
  onlineUsers?: Set<string>;
}

export default function ParticipantsStatus({ participants, onlineUsers = new Set() }: ParticipantsStatusProps) {
  const confirmedCount = participants.filter(p => p.selectionConfirmed).length;
  const totalCount = participants.length;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Участники</h3>
        <span className="text-xs font-medium text-gray-500">
          {confirmedCount}/{totalCount} подтвердили выбор
        </span>
      </div>

      <div className="space-y-2">
        {participants.map((participant) => {
          const isOnline = onlineUsers.has(participant.telegramId);
          const displayName = participant.firstName || participant.username || 'Участник';

          return (
            <div
              key={participant.id}
              className="flex items-center justify-between p-2 rounded-lg bg-gray-50"
            >
              <div className="flex items-center gap-3">
                {/* Avatar with online indicator */}
                <div className="relative">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm"
                    style={{
                      backgroundColor: participant.color || '#6B7280'
                    }}
                  >
                    {participant.avatar ? (
                      <img
                        src={participant.avatar}
                        alt={displayName}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                  {isOnline && (
                    <div
                      className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white"
                      style={{ backgroundColor: '#10B981' }}
                    />
                  )}
                </div>

                {/* Name and Amount */}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{displayName}</p>
                    {participant.amount !== undefined && participant.amount > 0 && (
                      <>
                        <span className="text-xs text-gray-400">•</span>
                        <p className="text-sm font-medium text-gray-700">
                          {Math.round(participant.amount)} ₽
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Status indicator */}
              <div className="flex items-center gap-2">
                {participant.hasPayment ? (
                  <div className="flex items-center gap-1 text-green-600">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-xs font-medium">Оплатил</span>
                  </div>
                ) : participant.selectionConfirmed ? (
                  <div className="flex items-center gap-1 text-green-600">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-xs font-medium">Подтвердил</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-gray-400">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-xs font-medium">Выбирает</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Status message */}
      {confirmedCount < totalCount && (
        <div className="mt-3 p-2 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-700">
            Ожидаем подтверждения от {totalCount - confirmedCount} {totalCount - confirmedCount === 1 ? 'участника' : 'участников'}
          </p>
        </div>
      )}
    </div>
  );
}
