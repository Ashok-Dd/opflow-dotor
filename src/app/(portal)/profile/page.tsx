import type { Metadata } from 'next';

import { Icon } from '@/components/icons';
import { serverT } from '@/lib/lang';
import { portal } from '@/lib/portal';

import { PhotoPicker } from './photo-picker';
import { ProfileForm } from './profile-form';

export const metadata: Metadata = { title: 'My profile' };

/** What patients see on the doctor's card. Name, degrees and registration are changed only by the OPflow team. */
export default async function ProfilePage() {
  const t = await serverT();
  const { me } = await portal();
  return (
    <>
      <header className="head">
        <div>
          <div className="kicker">{t('Me')}</div>
          <h1>{t('My profile')}</h1>
          <p>{t('Patients see this on your card and page.')}</p>
        </div>
      </header>
      <div className="cols">
        <ProfileForm
          initial={{ gender: me.gender, yearsExperience: me.yearsExperience, languages: me.languages, about: me.about, feePaise: me.feePaise }}
        />
        <div className="grid">
          <div className="card" style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
            <PhotoPicker name={me.name} photo={me.photo?.m ?? null} />
            <div>
              <h3 style={{ margin: 0 }}>{me.name}</h3>
              <div className="muted">{t(me.typeName)}</div>
              <div className="faint" style={{ fontSize: 13 }}>
                {me.degrees}
              </div>
              <span className={`tag ${me.live ? 'good' : 'warn'}`} style={{ marginTop: 8 }}>
                {t(me.verificationMessage)}
              </span>
            </div>
          </div>
          <div className="card">
            <h3>{t('Profile strength')}</h3>
            <div style={{ height: 10, borderRadius: 6, background: 'var(--mint)', overflow: 'hidden' }}>
              <div style={{ width: `${me.profileStrength}%`, height: '100%', background: 'var(--fern)' }} />
            </div>
            <p className="muted" style={{ margin: '8px 0 0', fontSize: 13.5 }}>
              {t('{0}% complete. A clear photo, about you and your timings help patients choose you.', [me.profileStrength])}
            </p>
          </div>
          <div className="card">
            <h3>
              <Icon name="lock" /> {t('Changed by the OPflow team')}
            </h3>
            <dl className="kv">
              <dt>{t('Name')}</dt>
              <dd>{me.name}</dd>
              <dt>{t('Degrees')}</dt>
              <dd>{me.degrees}</dd>
              <dt>{t('Registration')}</dt>
              <dd className="mono">
                {me.regCouncil} {me.regNo}
              </dd>
              <dt>{t('OPD ID')}</dt>
              <dd className="mono">{me.loginId}</dd>
            </dl>
            <p className="faint" style={{ fontSize: 13, marginBottom: 0 }}>
              {t(me.lockedNote)}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
