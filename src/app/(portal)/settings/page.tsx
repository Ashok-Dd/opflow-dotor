import type { Metadata } from 'next';

import { get } from '@/lib/api';
import { serverT } from '@/lib/lang';
import type { Devices, Prefs } from '@/lib/types';

import { DeviceList, PrefSwitches } from './settings-ui';

export const metadata: Metadata = { title: 'Messages settings' };

export default async function SettingsPage() {
  const t = await serverT();
  const [prefs, devices] = await Promise.all([get<Prefs>('/v1/me/notification-prefs'), get<Devices>('/v1/doctor/devices')]);
  return (
    <>
      <header className="head">
        <div>
          <div className="kicker">{t('Me')}</div>
          <h1>{t('Messages settings')}</h1>
          <p>{t('Choose what comes to your phone as a notification.')}</p>
        </div>
      </header>
      <div className="cols">
        <div>
          <PrefSwitches initial={prefs} />
          <div className="notice" style={{ marginTop: 14 }}>
            {t('Emergency patients, money sent to your bank and notes from the OPflow team always come.')}
          </div>
        </div>
        <DeviceList initial={devices} />
      </div>
    </>
  );
}
