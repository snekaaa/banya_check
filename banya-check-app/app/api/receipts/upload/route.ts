import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const apiUrl = process.env.API_URL || 'http://localhost:3002';
    console.log('Upload API called, API_URL:', apiUrl);

    const formData = await request.formData();
    console.log('FormData fields:', Array.from(formData.keys()));

    // Получаем sessionId из formData
    const sessionId = formData.get('sessionId');
    console.log('SessionId from form:', sessionId);

    // Создаем новую FormData для отправки на бэкенд
    const backendFormData = new FormData();

    // Копируем файл
    const file = formData.get('file');
    if (file) {
      backendFormData.append('file', file);
    }

    // Добавляем sessionId как строку
    if (sessionId) {
      backendFormData.append('sessionId', sessionId.toString());
    }

    // Пробрасываем запрос на бэкенд
    console.log('Sending request to:', `${apiUrl}/api/receipts/upload`);
    const response = await fetch(`${apiUrl}/api/receipts/upload`, {
      method: 'POST',
      body: backendFormData,
    });

    console.log('Backend response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Backend error:', errorData);
      return NextResponse.json(
        { error: errorData.error || 'Upload failed', message: errorData.message },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('Upload successful:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Failed to upload receipt', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
