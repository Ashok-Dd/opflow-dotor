'use server';

import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { runAction, str, type ActionResult } from '@/lib/actions';
import { api, WEB_DEVICE } from '@/lib/api';
import { BROWSER, CHANGE, cookieBase, saveSession, type TokenPair } from '@/lib/session';

/**
 * This browser as a device for the API. A doctor account can be open in one browser at a time: the same browser
 * signing in again is recognised by this id (kept for 400 days, also after log out); a different one is refused.
 */
async function webDevice() {
  const jar = await cookies();
  let id = jar.get(BROWSER)?.value;
  if (!id || !/^[A-Za-z0-9-]{16,64}$/.test(id)) {
    id = `web-${randomUUID()}`;
    jar.set(BROWSER, id, { ...cookieBase, maxAge: 400 * 86_400 });
  }
  return { ...WEB_DEVICE, installId: id };
}

/** Only paths on this site after sign-in (never an outside address). */
const safeNext = (v: string) => (v.startsWith('/') && !v.startsWith('//') ? v : '/today');

/** OPD ID + password. First sign-in (or after the OPflow team resets it): set your own password next. */
export async function signIn(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  let go: string | null = null;
  const r = await runAction(async () => {
    const out = await api<{ mustChange: boolean; changeToken?: string } & Partial<TokenPair>>('POST', '/v1/auth/doctor/login', {
      anonymous: true,
      body: { loginId: str(form, 'loginId').toUpperCase(), password: String(form.get('password') ?? ''), device: await webDevice() },
    });
    if (out.mustChange && out.changeToken) {
      (await cookies()).set(CHANGE, out.changeToken, { ...cookieBase, maxAge: 600 });
      go = `/new-password?next=${encodeURIComponent(safeNext(str(form, 'next')))}`;
      return;
    }
    await saveSession(out as TokenPair);
    go = safeNext(str(form, 'next'));
  });
  if (r?.ok && go) redirect(go);
  return r;
}

/** First sign-in: the doctor's own password (the one from the OPflow team works only once). */
export async function setFirstPassword(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const a = String(form.get('password') ?? '');
  const b = String(form.get('again') ?? '');
  if (a !== b) return { ok: false, code: 'MISMATCH', message: 'The two passwords are not the same.' };
  const jar = await cookies();
  const changeToken = jar.get(CHANGE)?.value;
  if (!changeToken) return { ok: false, code: 'CHANGE_EXPIRED', message: 'Please log in again.' };
  let go: string | null = null;
  const r = await runAction(async () => {
    const pair = await api<TokenPair>('POST', '/v1/auth/doctor/set-password', {
      anonymous: true,
      body: { changeToken, newPassword: a, device: await webDevice() },
    });
    jar.delete(CHANGE);
    await saveSession(pair);
    go = safeNext(str(form, 'next'));
  });
  if (r?.ok && go) redirect(go);
  return r;
}
