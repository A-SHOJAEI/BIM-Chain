/**
 * Authentication utilities for the BIM-Chain frontend.
 * Manages JWT tokens and user session state.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const TOKEN_KEY = 'bimchain_token';
const REFRESH_KEY = 'bimchain_refresh';

export interface AuthTokens {
  token: string;
  refreshToken: string;
}

export interface UserSession {
  userId: string;
  orgMspId: string;
  role: string;
}

/** Attempt login and store tokens on success. */
export async function login(username: string, password: string): Promise<AuthTokens> {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error('Login failed');
  const data: AuthTokens = await res.json();
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(TOKEN_KEY, data.token);
    sessionStorage.setItem(REFRESH_KEY, data.refreshToken);
  }
  return data;
}

/** Refresh the access token using the stored refresh token. */
export async function refreshToken(): Promise<string> {
  const stored = typeof window !== 'undefined' ? sessionStorage.getItem(REFRESH_KEY) : null;
  if (!stored) throw new Error('No refresh token');
  const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: stored }),
  });
  if (!res.ok) throw new Error('Token refresh failed');
  const data = await res.json();
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(TOKEN_KEY, data.token);
  }
  return data.token;
}

/** Get the stored access token. */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

/** Clear stored tokens (logout). */
export function logout(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
}

/** Check if a user is currently authenticated (has a stored token). */
export function isAuthenticated(): boolean {
  return getToken() !== null;
}

/**
 * Create an authenticated fetch wrapper that includes the JWT token
 * in the Authorization header.
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, { ...options, headers });
}
