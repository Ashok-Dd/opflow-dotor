import { NextResponse, type NextRequest } from 'next/server';

const ACCESS = 'opfd_at';
const REFRESH = 'opfd_rt';
const API = (process.env.DOCTOR_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const PUBLIC = ['/sign-in', '/new-password'];
const REFRESH_MAX_AGE = 30 * 86_400;

function secondsLeft(token: string | undefined): number {
  if (!token) return -1;
  try {
    const json = atob((token.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/'));
    return (JSON.parse(json).exp ?? 0) - Math.floor(Date.now() / 1000);
  } catch {
    return -1;
  }
}

/**
 * Before each page and action: no session → sign in. Access token about to expire → swap the refresh token for a
 * new pair here (pages can't set cookies while rendering), so everything after runs with a fresh token.
 * A slow network or a waking server never signs the doctor out: only the API's own "no" does.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const access = request.cookies.get(ACCESS)?.value;
  const refresh = request.cookies.get(REFRESH)?.value;
  const prefetch = request.headers.get('next-router-prefetch') === '1' || request.headers.get('purpose') === 'prefetch';

  const harden = (res: NextResponse) => {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    res.headers.set('Cache-Control', 'no-store');
    return res;
  };

  if (isPublic) return harden(NextResponse.next());

  if (!refresh) {
    if (pathname.startsWith('/api/')) return harden(NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in again.' } }, { status: 401 }));
    const url = new URL('/sign-in', request.url);
    if (pathname !== '/') url.searchParams.set('next', pathname + search);
    return harden(NextResponse.redirect(url));
  }

  if (secondsLeft(access) > 180 || prefetch) return harden(NextResponse.next());

  try {
    const key = process.env.DOCTOR_WEB_KEY;
    const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim();
    const res = await fetch(`${API}/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(key ? { 'x-opflow-web-key': key, ...(ip ? { 'x-opflow-client-ip': ip } : {}) } : {}),
      },
      body: JSON.stringify({ refreshToken: refresh }),
      cache: 'no-store',
      signal: AbortSignal.timeout(45_000),
    });
    if (res.ok) {
      const pair = (await res.json()) as { accessToken: string; refreshToken: string; expiresIn: number };
      // What renders now sees the new token too.
      request.cookies.set(ACCESS, pair.accessToken);
      request.cookies.set(REFRESH, pair.refreshToken);
      const out = NextResponse.next({ request: { headers: request.headers } });
      const opts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/' };
      out.cookies.set(ACCESS, pair.accessToken, { ...opts, maxAge: pair.expiresIn });
      out.cookies.set(REFRESH, pair.refreshToken, { ...opts, maxAge: REFRESH_MAX_AGE });
      return harden(out);
    }
    if ((res.status === 401 || res.status === 403) && secondsLeft(access) <= 0) {
      // The API said no (expired, signed out elsewhere, password changed) and the current pass is used up: sign in
      // again. (A "no" while the pass still works is another request renewing at the same moment: carry on.)
      if (pathname.startsWith('/api/')) return harden(NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in again.' } }, { status: 401 }));
      const url = new URL('/sign-in', request.url);
      url.searchParams.set('expired', '1');
      url.searchParams.set('next', pathname + search);
      const out = NextResponse.redirect(url);
      out.cookies.delete(ACCESS);
      out.cookies.delete(REFRESH);
      return harden(out);
    }
  } catch {
    // API unreachable: let the page render; it shows "cannot reach the server" in place.
  }
  return harden(NextResponse.next());
}

export const config = {
  // Everything except Next's own files and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|robots.txt).*)'],
};
