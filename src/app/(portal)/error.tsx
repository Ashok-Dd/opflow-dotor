'use client';

import { useT } from '@/components/client-kit';

/** Any page that fails (no internet, a busy server) shows this instead of a blank screen; the menu keeps working. */
export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useT();
  const busy = /too many/i.test(error.message);
  return (
    <div className="empty" style={{ maxWidth: 560 }}>
      <b>{busy ? t('Too many tries. Please wait a minute and try again.') : t('This page could not be shown')}</b>
      <p>
        {busy
          ? t('Your OPD is safe: nothing was changed.')
          : t('Please check your internet and try again. If it keeps happening, call the OPflow team with this code: {0}', [error.digest ?? '—'])}
      </p>
      <div className="actions" style={{ justifyContent: 'center', marginTop: 14 }}>
        <button type="button" className="btn" onClick={reset}>
          {t('Try again')}
        </button>
      </div>
    </div>
  );
}
