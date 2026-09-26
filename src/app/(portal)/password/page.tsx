import type { Metadata } from 'next';

import { serverT } from '@/lib/lang';

import { PasswordForm } from './password-form';

export const metadata: Metadata = { title: 'Change password' };

export default async function PasswordPage() {
  const t = await serverT();
  return (
    <>
      <header className="head">
        <div>
          <div className="kicker">{t('Me')}</div>
          <h1>{t('Change password')}</h1>
          <p>{t('Other phones are logged out after the change.')}</p>
        </div>
      </header>
      <div style={{ maxWidth: 460 }}>
        <PasswordForm />
      </div>
    </>
  );
}
