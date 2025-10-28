'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';

function UploadCheckContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверяем наличие sessionId
    if (!sessionId) {
      setError('Пожалуйста, откройте приложение из группового чата через кнопку "Открыть БаняСчет"');
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      // Создаем FormData для загрузки файла
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', sessionId);

      // Отправляем файл на сервер через Next.js API route
      const uploadResponse = await fetch('/api/receipts/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.message || 'Ошибка загрузки файла');
      }

      const uploadData = await uploadResponse.json();
      const { token, receiptId } = uploadData;

      setIsUploading(false);
      setIsProcessing(true);

      // Начинаем polling статуса обработки
      let attempts = 0;
      const maxAttempts = 15; // 15 секунд максимум
      const pollInterval = 1000; // каждую секунду

      const checkStatus = async () => {
        try {
          const statusResponse = await fetch(`/api/receipts/status/${token}`);

          if (!statusResponse.ok) {
            throw new Error('Ошибка проверки статуса');
          }

          const statusData = await statusResponse.json();

          if (statusData.status === 'completed') {
            // Распознавание завершено, переходим на страницу подтверждения
            router.push(`/confirm-receipt?receiptId=${receiptId}&token=${token}&sessionId=${sessionId}`);
            return;
          }

          if (statusData.status === 'failed') {
            throw new Error('Не удалось распознать чек');
          }

          // Продолжаем polling
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(checkStatus, pollInterval);
          } else {
            throw new Error('Превышено время ожидания. Попробуйте еще раз.');
          }
        } catch (err) {
          setIsProcessing(false);
          setError(err instanceof Error ? err.message : 'Произошла ошибка');
        }
      };

      // Ждем 5 секунд перед первой проверкой (рекомендация TabScanner)
      setTimeout(checkStatus, 5000);

    } catch (err) {
      setIsUploading(false);
      setIsProcessing(false);
      setError(err instanceof Error ? err.message : 'Произошла ошибка при загрузке');
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
              disabled={isUploading || isProcessing}
            >
              ←
            </button>
            <h1 className="text-lg font-semibold text-[var(--tg-theme-text-color,#000000)]">
              Загрузить чек
            </h1>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center p-4">
          {!isUploading && !isProcessing ? (
            <div className="w-full">
              {error && (
                <div className="mb-4 bg-red-100 text-red-700 p-4 rounded-xl text-sm">
                  {error}
                </div>
              )}
              <label className="w-full cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] rounded-2xl p-8 text-center border-2 border-dashed border-[var(--tg-theme-hint-color,#999999)]">
                  <div className="text-6xl mb-4">📸</div>
                  <div className="text-lg font-semibold text-[var(--tg-theme-text-color,#000000)] mb-2">
                    Сфотографируйте чек
                  </div>
                  <div className="text-sm text-[var(--tg-theme-hint-color,#999999)]">
                    Нажмите, чтобы выбрать фото из галереи или сделать снимок
                  </div>
                </div>
              </label>
            </div>
          ) : (
            <div className="text-center">
              {/* Upload animation */}
              {isUploading && (
                <>
                  <div className="inline-block animate-spin text-6xl mb-4">⏳</div>
                  <div className="text-lg font-semibold text-[var(--tg-theme-text-color,#000000)] mb-2">
                    Загружаем фото...
                  </div>
                  <div className="text-sm text-[var(--tg-theme-hint-color,#999999)]">
                    Пожалуйста, подождите
                  </div>
                </>
              )}

              {/* Processing animation */}
              {isProcessing && (
                <>
                  <div className="inline-block animate-pulse text-6xl mb-4">🔍</div>
                  <div className="text-lg font-semibold text-[var(--tg-theme-text-color,#000000)] mb-2">
                    Распознаем позиции...
                  </div>
                  <div className="text-sm text-[var(--tg-theme-hint-color,#999999)]">
                    Это займет несколько секунд
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Tips */}
        {!isUploading && !isProcessing && (
          <div className="p-4 pb-8">
            <div className="bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] rounded-xl p-4">
              <div className="text-sm font-medium text-[var(--tg-theme-text-color,#000000)] mb-2">
                Для лучшего распознавания:
              </div>
              <div className="text-sm text-[var(--tg-theme-hint-color,#999999)] space-y-1">
                <div>• Сфотографируйте чек при хорошем освещении</div>
                <div>• Убедитесь, что все позиции видны</div>
                <div>• Держите камеру ровно над чеком</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function UploadCheck() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--tg-theme-bg-color,#ffffff)] flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-[var(--tg-theme-text-color,#000000)]">Загрузка...</div>
        </div>
      </div>
    }>
      <UploadCheckContent />
    </Suspense>
  );
}
