import { NextRequest, NextResponse } from 'next/server';

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function proxyToBackend(request: NextRequest, method: 'GET' | 'PUT') {
  const backendUrl = `${BACKEND_BASE_URL}/api/settings/bot`;
  const headers = new Headers();
  const authorization = request.headers.get('authorization');
  const contentType = request.headers.get('content-type');

  if (authorization) headers.set('authorization', authorization);
  if (contentType) headers.set('content-type', contentType);

  const options: RequestInit = {
    method,
    headers
  };

  if (method === 'PUT') {
    options.body = await request.text();
  }

  const response = await fetch(backendUrl, options);
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

export async function GET(request: NextRequest) {
  return proxyToBackend(request, 'GET');
}

export async function PUT(request: NextRequest) {
  return proxyToBackend(request, 'PUT');
}