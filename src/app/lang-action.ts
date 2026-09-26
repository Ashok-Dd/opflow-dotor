'use server';

import { cookies } from 'next/headers';

import { LANG } from '@/lib/session';

/** Keeps the doctor's language for a year (not secret, so readable; the page is drawn by the server anyway). */
export async function setLanguage(lang: 'en' | 'te'): Promise<void> {
  (await cookies()).set(LANG, lang === 'te' ? 'te' : 'en', { path: '/', sameSite: 'lax', maxAge: 365 * 86_400 });
}
