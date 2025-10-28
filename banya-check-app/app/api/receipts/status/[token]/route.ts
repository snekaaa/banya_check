import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const apiUrl = process.env.API_URL || 'http://localhost:3002';

    const response = await fetch(`${apiUrl}/api/receipts/status/${token}`);

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Status check failed' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Failed to check receipt status' },
      { status: 500 }
    );
  }
}
