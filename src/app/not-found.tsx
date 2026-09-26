import Link from 'next/link';

import { serverT } from '@/lib/lang';

export default async function NotFound() {
  const t = await serverT();
  return (
    <div className="gate" style={{ gridTemplateColumns: '1fr' }}>
      <div className="form">
        <div className="pass">
          <h1>{t('This page is not here')}</h1>
          <p className="lead">{t('The link may be old. Go back to today’s OPD.')}</p>
          <Link prefetch={false} className="btn" href="/today">
            {t('Go to Today')}
          </Link>
        </div>
      </div>
    </div>
  );
}
