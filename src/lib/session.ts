import 'server-only';

import { cookies } from 'next/headers';

/**
 * The doctor's session lives only in httpOnly, SameSite=strict cookies. JavaScript in the page never sees the
 * refresh token; pages and actions call the API from this server.
 */
export const ACCESS = 'opfd_at';
export const REFRESH = 'opfd_rt';
/** First sign-in: the one-time token that lets the doctor set their own password. */
export const CHANGE = 'opfd_ct';
/** The hospital the doctor is looking at (a doctor may work at more than one). */
export const HOSPITAL = 'opfd_h';
/** A random id for this browser (kept after log out): the API knows it is the same browser signing in again. */
export const BROWSER = 'opfd_did';
export const LANG = 'opf_lang';

export const secure = process.env.NODE_ENV === 'production';
export const cookieBase = { httpOnly: true, secure, sameSite: 'strict' as const, path: '/' };
/** Refresh tokens live 30 days on the API; the cookie carries it that long. */
export const REFRESH_MAX_AGE = 30 * 86_400;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Seconds until the JWT expires (no signature check here: the API checks every request). */
export function tokenSecondsLeft(token: string | undefined): number {
  if (!token) return -1;
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { exp?: number };
    return (payload.exp ?? 0) - Math.floor(Date.now() / 1000);
  } catch {
    return -1;
  }
}

export function tokenClaims(token: string | undefined): { sub?: string; role?: string; did?: string; sid?: string } {
  try {
    return JSON.parse(Buffer.from((token ?? '').split('.')[1] ?? '', 'base64url').toString('utf8'));
  } catch {
    return {};
  }
}

/** Only in Server Actions / Route Handlers (cookies can't be written while a page renders). */
export async function saveSession(pair: TokenPair): Promise<void> {
  const jar = await cookies();
  jar.set(ACCESS, pair.accessToken, { ...cookieBase, maxAge: pair.expiresIn });
  jar.set(REFRESH, pair.refreshToken, { ...cookieBase, maxAge: REFRESH_MAX_AGE });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACCESS);
  jar.delete(REFRESH);
  jar.delete(CHANGE);
  jar.delete(HOSPITAL);
}

export async function accessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS)?.value;
}

export async function refreshToken(): Promise<string | undefined> {
  return (await cookies()).get(REFRESH)?.value;
}
