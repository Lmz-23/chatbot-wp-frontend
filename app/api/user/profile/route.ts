import { NextRequest, NextResponse } from 'next/server';

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export async function GET(request: NextRequest) {
  const headers = new Headers();
  const authorization = request.headers.get('authorization');

  if (authorization) headers.set('authorization', authorization);

  const response = await fetch(`${BACKEND_BASE_URL}/auth/me`, {
    method: 'GET',
    headers
  });

  const contentType = response.headers.get('content-type') || 'text/plain';
  if (contentType.includes('application/json')) {
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  }

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: {
      'content-type': contentType
    }
  });
}
