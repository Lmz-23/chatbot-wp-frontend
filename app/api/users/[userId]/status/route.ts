import { NextRequest, NextResponse } from 'next/server';

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const { userId } = await context.params;
  const headers = new Headers();
  const authorization = request.headers.get('authorization');
  const contentType = request.headers.get('content-type');

  if (authorization) headers.set('authorization', authorization);
  if (contentType) headers.set('content-type', contentType);

  const response = await fetch(`${BACKEND_BASE_URL}/api/users/${userId}/status`, {
    method: 'PUT',
    headers,
    body: await request.text()
  });

  const responseContentType = response.headers.get('content-type') || 'text/plain';
  if (responseContentType.includes('application/json')) {
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  }

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: {
      'content-type': responseContentType
    }
  });
}
