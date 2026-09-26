import 'server-only';

import { randomUUID } from 'node:crypto';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { accessToken } from './session';

export const API_BASE = (process.env.DOCTOR_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
export const APP_VERSION = 'web-0.1.0';
/** Every sign-in from this website says so: the API gives the website its own place (it never signs out a phone). */
export const WEB_DEVICE = { platform: 'web', appVersion: APP_VERSION } as const;

/** The API's one error shape, in simple English, ready to show. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

interface CallOptions {
  body?: unknown;
  query?: Query;
  /** Changes that must never happen twice get an Idempotency-Key (safe to retry). */
  idempotent?: boolean;
  /** Public endpoints (sign-in) don't send the session. */
  anonymous?: boolean;
  token?: string;
  /** Pages: a 401 sends the doctor to sign in. Actions: return the error instead. */
  redirectOn401?: boolean;
}

/**
 * The doctor's browser, as the API should see it. Only believed by the API together with DOCTOR_WEB_KEY, so the
 * sign-in limits and the "signed-in devices" list are about the doctor's own computer, not this server.
 */
export async function clientHeaders(): Promise<Record<string, string>> {
  const key = process.env.DOCTOR_WEB_KEY;
  if (!key) return {};
  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || h.get('x-real-ip') || '';
  const ua = h.get('user-agent') ?? '';
  return {
    'x-opflow-web-key': key,
    ...(ip ? { 'x-opflow-client-ip': ip } : {}),
    ...(ua ? { 'x-opflow-client-ua': ua.slice(0, 300) } : {}),
  };
}

/** Calls the OPflow API from this server. */
export async function api<T = unknown>(method: string, path: string, opts: CallOptions = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const hdrs: Record<string, string> = { accept: 'application/json', 'x-app-version': APP_VERSION, ...(await clientHeaders()) };
  if (opts.body !== undefined) hdrs['content-type'] = 'application/json';
  if (opts.idempotent) hdrs['idempotency-key'] = randomUUID();
  const token = opts.anonymous ? undefined : (opts.token ?? (await accessToken()));
  if (token) hdrs.authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: hdrs,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      cache: 'no-store',
      // A sleeping free server can take up to a minute to wake: a short limit would report errors for work that succeeds.
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    throw new ApiError(503, 'API_UNREACHABLE', 'The OPflow server cannot be reached right now. Please check your internet and try again.');
  }
  if (res.status === 401 && !opts.anonymous && opts.redirectOn401 !== false) redirect('/sign-in?expired=1');
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok) {
    const body = type.includes('json')
      ? ((await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string; details?: Record<string, unknown> } })
      : {};
    throw new ApiError(res.status, body.error?.code ?? 'ERROR', body.error?.message ?? 'Something went wrong. Please try again.', body.error?.details);
  }
  if (type.includes('json')) return (await res.json()) as T;
  return (await res.text()) as T;
}

export const get = <T>(path: string, query?: Query) => api<T>('GET', path, { query });

/** For pages: returns data, or the error to show in place (never crashes the page). */
export async function load<T>(path: string, query?: Query): Promise<{ data: T; error: null } | { data: null; error: ApiError }> {
  try {
    return { data: await get<T>(path, query), error: null };
  } catch (err) {
    if (err instanceof ApiError) return { data: null, error: err };
    throw err; // redirects etc.
  }
}
