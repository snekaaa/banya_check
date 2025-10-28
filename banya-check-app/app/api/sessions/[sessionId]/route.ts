import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const apiUrl = process.env.API_URL || 'http://localhost:3002';

    const response = await fetch(`${apiUrl}/api/sessions/${sessionId}`);

    if (!response.ok) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
  }
}
