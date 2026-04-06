let accessToken: string | null = null;

const SESSION_FLAG_KEY = 'replai_session_active';

export function getToken() {
  return accessToken;
}

export function setToken(token: string) {
  accessToken = token;
}

export function clearToken() {
  accessToken = null;
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