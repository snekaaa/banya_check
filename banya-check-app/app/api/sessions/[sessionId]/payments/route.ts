import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await request.json();

    console.log('Confirming payment for session:', sessionId, 'participant:', body.participantId);

    // Проксируем запрос к бэкенду
    const backendUrl = process.env.API_URL || 'http://bot:3002';
    const response = await fetch(`${backendUrl}/api/sessions/${sessionId}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', response.status, errorText);
      return NextResponse.json(
        { error: errorText || 'Failed to confirm payment' },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log('Payment confirmed successfully:', result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error confirming payment:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
