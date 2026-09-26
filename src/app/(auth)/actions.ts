'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { runAction, str, type ActionResult } from '@/lib/actions';
import { api, WEB_DEVICE } from '@/lib/api';
import { CHANGE, cookieBase, saveSession, type TokenPair } from '@/lib/session';

/** Only paths on this site after sign-in (never an outside address). */
const safeNext = (v: string) => (v.startsWith('/') && !v.startsWith('//') ? v : '/today');

/** OPD ID + password. First sign-in (or after the OPflow team resets it): set your own password next. */
export async function signIn(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  let go: string | null = null;
  const r = await runAction(async () => {
    const out = await api<{ mustChange: boolean; changeToken?: string } & Partial<TokenPair>>('POST', '/v1/auth/doctor/login', {
      anonymous: true,
      body: { loginId: str(form, 'loginId').toUpperCase(), password: String(form.get('password') ?? ''), device: WEB_DEVICE },
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
      body: { changeToken, newPassword: a, device: WEB_DEVICE },
    });
    jar.delete(CHANGE);
    await saveSession(pair);
    go = safeNext(str(form, 'next'));
  });
  if (r?.ok && go) redirect(go);
  return r;
}
