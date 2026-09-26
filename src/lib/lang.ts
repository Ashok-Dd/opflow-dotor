import 'server-only';

import { cookies } from 'next/headers';

import { translator, type Lang } from './i18n';
import { LANG } from './session';

export async function getLang(): Promise<Lang> {
  return (await cookies()).get(LANG)?.value === 'te' ? 'te' : 'en';
}

/** For server components: `const tr = await serverT();` */
export async function serverT() {
  return translator(await getLang());
}
