import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { clientHeaders, API_BASE } from '@/lib/api';
import { ACCESS, cookieBase, REFRESH, REFRESH_MAX_AGE, tokenSecondsLeft } from '@/lib/session';

/**
 * The live line needs the access token in the browser (for the WebSocket to the API). This gives out only that
 * short token (15 minutes), never the refresh token; it refreshes first when the token is about to expire.
 * Same-origin only (SameSite=strict cookies), never cached.
 */
export async function GET() {
  const jar = await cookies();
  let access = jar.get(ACCESS)?.value;
  const refresh = jar.get(REFRESH)?.value;
  const no = (status: number) => NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Please log in again.' } }, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!refresh) return no(401);

  if (tokenSecondsLeft(access) < 120) {
    try {
      const res = await fetch(`${API_BASE}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await clientHeaders()) },
        body: JSON.stringify({ refreshToken: refresh }),
        cache: 'no-store',
        signal: AbortSignal.timeout(45_000),
      });
      // Refused while the current pass still works: another request is renewing at this moment; use the pass.
      if ((res.status === 401 || res.status === 403) && tokenSecondsLeft(access) > 0) return NextResponse.json({ token: access }, { headers: { 'Cache-Control': 'no-store' } });
      if (res.status === 401 || res.status === 403) return no(401);
      if (!res.ok) return no(503);
      const pair = (await res.json()) as { accessToken: string; refreshToken: string; expiresIn: number };
      jar.set(ACCESS, pair.accessToken, { ...cookieBase, maxAge: pair.expiresIn });
      jar.set(REFRESH, pair.refreshToken, { ...cookieBase, maxAge: REFRESH_MAX_AGE });
      access = pair.accessToken;
    } catch {
      return no(503);
    }
  }
  return NextResponse.json({ token: access, expiresIn: tokenSecondsLeft(access) }, { headers: { 'Cache-Control': 'no-store' } });
}
