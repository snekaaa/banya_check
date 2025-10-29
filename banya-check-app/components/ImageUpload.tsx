'use client';

import { useState, useRef } from 'react';

interface ImageUploadProps {
  onUploadComplete: (url: string) => void;
  onUploadError?: (error: string) => void;
}

export default function ImageUpload({ onUploadComplete, onUploadError }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Проверка типа файла
    if (!file.type.startsWith('image/')) {
      onUploadError?.('Пожалуйста, выберите изображение');
      return;
    }

    // Проверка размера (макс 10MB)
    if (file.size > 10 * 1024 * 1024) {
      onUploadError?.('Размер файла не должен превышать 10MB');
      return;
    }

    // Показываем превью
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Загружаем файл
    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('http://localhost:3002/api/upload-payment-proof', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки файла');
      }

      const data = await response.json();

      if (data.success && data.url) {
        onUploadComplete(data.url);
      } else {
        throw new Error('Не удалось получить URL файла');
      }
    } catch (error) {
      console.error('Upload error:', error);
      onUploadError?.(error instanceof Error ? error.message : 'Ошибка загрузки');
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {!previewUrl ? (
        <button
          onClick={handleClick}
          disabled={uploading}
          className="w-full p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex flex-col items-center gap-2">
            <svg
              className="w-12 h-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <div className="text-sm text-gray-600">
              {uploading ? (
                <span className="text-blue-600 font-medium">Загрузка...</span>
              ) : (
                <>
                  <span className="text-blue-600 font-medium">Нажмите для загрузки</span>
                  <span className="block text-xs text-gray-500 mt-1">PNG, JPG до 10MB</span>
                </>
              )}
            </div>
          </div>
        </button>
      ) : (
        <div className="relative">
          <img
            src={previewUrl}
            alt="Payment proof preview"
            className="w-full rounded-xl object-cover max-h-64"
          />
          <button
            onClick={handleRemove}
            className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          {uploading && (
            <div className="absolute inset-0 bg-black bg-opacity-50 rounded-xl flex items-center justify-center">
              <div className="text-white font-medium">Загрузка...</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
