import { NextRequest, NextResponse } from 'next/server';

/**
 * Проксируем запросы к аватарам на bot API
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const botApiUrl = process.env.API_URL || 'http://bot:3002';
    const avatarUrl = `${botApiUrl}/avatars/${filename}`;

    // Запрашиваем аватар у bot API
    const response = await fetch(avatarUrl);

    if (!response.ok) {
      return new NextResponse('Avatar not found', { status: 404 });
    }

    // Получаем изображение как buffer
    const imageBuffer = await response.arrayBuffer();

    // Возвращаем изображение с правильными заголовками
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error proxying avatar:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
