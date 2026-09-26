import type { Metadata } from 'next';

import { Icon } from '@/components/icons';
import { get } from '@/lib/api';
import { rupees } from '@/lib/format';
import { serverT } from '@/lib/lang';
import { portal } from '@/lib/portal';
import type { DoctorHospital } from '@/lib/types';

export const metadata: Metadata = { title: 'Hospitals I work at' };

/** The address once: area and city only when the address does not already say them. */
function fullAddress(h: DoctorHospital): string {
  const lower = h.address.toLowerCase();
  return [h.address, ...[h.area, h.city].filter((x) => x && !lower.includes(x.toLowerCase()))].filter(Boolean).join(', ');
}

export default async function HospitalsPage() {
  const t = await serverT();
  const { me } = await portal();
  const all = await get<DoctorHospital[]>('/v1/doctor/hospitals');
  return (
    <>
      <header className="head">
        <div>
          <div className="kicker">{t('My work')}</div>
          <h1>{t('Hospitals I work at')}</h1>
          <p>{t('The OPflow team adds and removes hospitals on your profile.')}</p>
        </div>
      </header>
      <div className="cards">
        {all.map((h) => (
          <div key={h.id} className="card">
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span className="avatar" style={{ borderRadius: 12 }}>
                <Icon name="hospital" />
              </span>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0 }}>{h.name}</h3>
                <div className="muted" style={{ fontSize: 13.5 }}>
                  {fullAddress(h)}
                </div>
              </div>
            </div>
            <div className="actions" style={{ marginTop: 12 }}>
              {h.isPrimary ? <span className="tag good">{t('Main hospital')}</span> : null}
              {h.hasEmergency ? <span className="tag bad">{t('Emergency 24 hours')}</span> : null}
              <span className={`tag ${h.status === 'active' ? 'good' : 'warn'}`}>{t(h.status === 'active' ? 'Active' : 'Paused')}</span>
            </div>
            <div className="grow" />
            <dl className="kv" style={{ marginTop: 12 }}>
              <dt>{t('Phone')}</dt>
              <dd className="mono">{h.phone || '—'}</dd>
              <dt>{t('Your fee here')}</dt>
              <dd className="tnum">{rupees(h.feePaiseOverride ?? me.feePaise)}</dd>
            </dl>
          </div>
        ))}
      </div>
    </>
  );
}
