import type { ReactNode } from 'react';

import { Icon, OpMark } from '@/components/icons';
import { LangToggle } from '@/components/lang-toggle';
import type { T } from '@/lib/i18n';

/** The sign-in frame: OPflow's green panel with what the website is for, and the form on paper. */
export function Gate({ t, children }: { t: T; children: ReactNode }) {
  return (
    <div className="gate">
      <section className="art" aria-hidden="false">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <OpMark size={40} color="#fff" />
          <div className="brand" style={{ padding: 0 }}>
            <div>
              <b>OPflow</b>
              <span>{t('FOR DOCTORS')}</span>
            </div>
          </div>
        </div>
        <div>
          <h2>
            {t('Your OPD,')} <em>{t('from your desk.')}</em>
          </h2>
          <p>{t('Everything in the OPflow doctor app, on a big screen: today’s line, bookings, timings and messages, always in step with your phone.')}</p>
          <ul>
            <li>
              <i>
                <Icon name="megaphone" />
              </i>
              {t('Call the next patient with one key')}
            </li>
            <li>
              <i>
                <Icon name="bookings" />
              </i>
              {t('Every booking, at every hospital you work at')}
            </li>
            <li>
              <i>
                <Icon name="lock" />
              </i>
              {t('Only for doctors added by the OPflow team')}
            </li>
          </ul>
          <div className="board">
            <div className="token">07</div>
            <div>
              <div style={{ font: '600 11px var(--mono)', letterSpacing: '0.12em', color: 'var(--leaf)' }}>{t('WITH DOCTOR NOW')}</div>
              <div style={{ font: '500 20px var(--serif)' }}>{t('Right patient, right doctor, at the right time.')}</div>
            </div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#bfd8cc' }}>{t('Patients book in the OPflow app. This website is only for doctors.')}</div>
      </section>
      <section className="form">
        <div className="pass">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 28 }}>
            <LangToggle />
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}
