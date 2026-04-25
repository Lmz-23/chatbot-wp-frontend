type AuthTokenRuntime = typeof globalThis & {
  __replaiAccessToken?: string | null;
};

let accessToken: string | null = null;

const SESSION_FLAG_KEY = 'replai_session_active';

export function getToken() {
  if (typeof window === 'undefined') {
    return accessToken;
  }

  const runtime = globalThis as AuthTokenRuntime;

  if (runtime.__replaiAccessToken === undefined) {
    runtime.__replaiAccessToken = null;
  }

  return runtime.__replaiAccessToken;
}

export function setToken(token: string) {
  accessToken = token;

  if (typeof window === 'undefined') {
    return;
  }

  const runtime = globalThis as AuthTokenRuntime;
  runtime.__replaiAccessToken = token;
}

export function clearToken() {
  accessToken = null;

  if (typeof window === 'undefined') {
    return;
  }

  const runtime = globalThis as AuthTokenRuntime;
  runtime.__replaiAccessToken = null;
}

export function markSessionActive() {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SESSION_FLAG_KEY, '1');
}

export function clearSessionFlag() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_FLAG_KEY);
}

export function hasActiveSessionFlag() {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(SESSION_FLAG_KEY) === '1';
}

export function clearAuthSession() {
  clearToken();
  clearSessionFlag();
}