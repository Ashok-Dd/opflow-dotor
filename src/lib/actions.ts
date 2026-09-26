import 'server-only';

import { unstable_rethrow } from 'next/navigation';

import { ApiError } from './api';

/** What every form and button gets back. The page shows `message` or the error in place. */
export type ActionResult<T = unknown> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; code: string; message: string; fields?: Record<string, string>; details?: Record<string, unknown> }
  | null;

/**
 * Runs a doctor action. "Done" is only ever reported when the API really did it (the same rule as the app's
 * runStep); any failure comes back with the server's own words.
 */
export async function runAction<T>(fn: () => Promise<{ message?: string; data?: T } | void>): Promise<ActionResult<T>> {
  try {
    const out = (await fn()) ?? {};
    return { ok: true, message: out.message, data: out.data };
  } catch (err) {
    unstable_rethrow(err); // let Next.js redirects through
    if (err instanceof ApiError) {
      const fields = (err.details?.fields as Record<string, string> | undefined) ?? undefined;
      return { ok: false, code: err.code, message: err.message, fields, details: err.details };
    }
    console.error(err);
    return { ok: false, code: 'INTERNAL', message: 'Something went wrong. Please try again.' };
  }
}

export const str = (f: FormData, k: string): string => String(f.get(k) ?? '').trim();
