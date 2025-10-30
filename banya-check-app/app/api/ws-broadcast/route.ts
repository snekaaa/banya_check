import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/ws-broadcast
 *
 * Принимает WebSocket сообщение от backend и отправляет его всем подключенным клиентам в сессии
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, message } = body;

    if (!sessionId || !message) {
      return NextResponse.json(
        { error: 'sessionId and message are required' },
        { status: 400 }
      );
    }

    // Вызываем глобальную функцию broadcastToSession из server.js
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (global as any).broadcastToSession === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).broadcastToSession(sessionId, message);

      return NextResponse.json({
        success: true,
        message: 'Broadcast sent successfully'
      });
    } else {
      console.error('⚠️ broadcastToSession function not found in global scope');
      return NextResponse.json(
        { error: 'WebSocket server not initialized' },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error('❌ Error in ws-broadcast API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
