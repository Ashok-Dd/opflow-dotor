'use client';

import { useActionState, useState } from 'react';

import { useT } from '@/components/client-kit';
import type { ActionResult } from '@/lib/actions';

import { setFirstPassword, signIn } from './actions';
import { OpLoadingScreen } from '@/components/op-loader';

function Result({ state }: { state: ActionResult }) {
  const { t } = useT();
  if (!state || state.ok) return null;
  return (
    <div className="notice bad" role="alert" style={{ marginBottom: 14 }}>
      {t(state.message)}
    </div>
  );
}

export function SignInForm({ next, expired }: { next: string; expired: boolean }) {
  const { t } = useT();
  const [state, run, pending] = useActionState(signIn, null);
  const [show, setShow] = useState(false);
  // Kept after a wrong password (React empties a form after it is sent); only the password is typed again.
  const [loginId, setLoginId] = useState('');
  return (
    <form action={run}>
      {pending ? <OpLoadingScreen message={t('Logging in…')} /> : null}
      <h1>{t('Doctor login')}</h1>
      <p className="lead">{t('Use the OPD ID and password from the OPflow team.')}</p>
      {expired && !state ? (
        <div className="notice warn" style={{ marginBottom: 14 }}>
          {t('Please log in again.')}
        </div>
      ) : null}
      <Result state={state} />
      <input type="hidden" name="next" value={next} />
      <label className="field">
        <span>{t('OPD ID')}</span>
        <input
          name="loginId"
          required
          placeholder="OPD-10234"
          autoComplete="username"
          autoCapitalize="characters"
          spellCheck={false}
          autoFocus
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
        />
      </label>
      <label className="field">
        <span>{t('Password')}</span>
        <div className="pw">
          <input name="password" type={show ? 'text' : 'password'} required autoComplete="current-password" />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="pw-toggle"
            aria-label={show ? t('Hide password') : t('Show password')}
          >
            {show ? t('Hide') : t('Show')}
          </button>
        </div>
      </label>
      <button className="btn" disabled={pending}>
        {pending ? t('Logging in…') : t('Log in')}
      </button>
      <p className="foot">{t('Forgot your password? Call the OPflow team; they will give you a new one.')}</p>
    </form>
  );
}

export function NewPasswordForm({ next }: { next: string }) {
  const { t } = useT();
  const [state, run, pending] = useActionState(setFirstPassword, null);
  return (
    <form action={run}>
      {pending ? <OpLoadingScreen message={t('Saving…')} /> : null}
      <h1>{t('Set your own password')}</h1>
      <p className="lead">{t('The password from the OPflow team works only once. Choose one only you know.')}</p>
      <Result state={state} />
      <input type="hidden" name="next" value={next} />
      <label className="field">
        <span>
          {t('New password')} <i>· {t('at least 8 letters and numbers')}</i>
        </span>
        <input name="password" type="password" required minLength={8} autoComplete="new-password" autoFocus />
      </label>
      <label className="field">
        <span>{t('Type it again')}</span>
        <input name="again" type="password" required minLength={8} autoComplete="new-password" />
      </label>
      <button className="btn" disabled={pending}>
        {pending ? t('Saving…') : t('Save password')}
      </button>
    </form>
  );
}
