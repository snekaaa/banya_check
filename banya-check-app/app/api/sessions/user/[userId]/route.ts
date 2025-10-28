import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const apiUrl = process.env.API_URL || 'http://localhost:3002';

    const response = await fetch(`${apiUrl}/api/sessions/user/${userId}`);
    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}
