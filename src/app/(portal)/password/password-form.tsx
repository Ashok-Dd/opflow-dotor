'use client';

import { useRef, useState, useTransition } from 'react';

import { changePassword } from '@/app/(portal)/actions';
import { useT, useToast } from '@/components/client-kit';
import { OpLoadingScreen } from '@/components/op-loader';

export function PasswordForm() {
  const { t } = useT();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={form}
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const current = String(f.get('current') ?? '');
        const next = String(f.get('next') ?? '');
        if (next !== String(f.get('again') ?? '')) return setError(t('The two passwords are not the same.'));
        setError(null);
        start(async () => {
          const r = await changePassword(current, next);
          if (r?.ok) {
            form.current?.reset();
            toast(t(r.message ?? 'Password changed. Other phones are logged out.'));
          } else if (r) setError(t(r.message));
        });
      }}
    >
      {pending ? <OpLoadingScreen message={t('Saving…')} /> : null}
      {error ? (
        <div className="notice bad" role="alert" style={{ marginBottom: 14 }}>
          {error}
        </div>
      ) : null}
      <label className="field">
        <span>{t('Current password')}</span>
        <input name="current" type="password" required autoComplete="current-password" />
      </label>
      <label className="field">
        <span>
          {t('New password')} <i>· {t('at least 8 letters and numbers')}</i>
        </span>
        <input name="next" type="password" required minLength={8} autoComplete="new-password" />
      </label>
      <label className="field">
        <span>{t('Type it again')}</span>
        <input name="again" type="password" required minLength={8} autoComplete="new-password" />
      </label>
      <button className="btn" disabled={pending}>
        {pending ? t('Saving…') : t('Change password')}
      </button>
    </form>
  );
}
