'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { setLanguage } from '@/app/lang-action';

import { useT } from './client-kit';

/** English / తెలుగు, like the app. The choice is kept in a cookie and the page is drawn again at once. */
export function LangToggle() {
  const { lang } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const pick = (l: 'en' | 'te') =>
    start(async () => {
      await setLanguage(l);
      router.refresh();
    });
  return (
    <div className="lang" role="group" aria-label="Language" aria-busy={pending}>
      <button type="button" aria-pressed={lang === 'en'} onClick={() => pick('en')}>
        English
      </button>
      <button type="button" aria-pressed={lang === 'te'} onClick={() => pick('te')}>
        తెలుగు
      </button>
    </div>
  );
}
