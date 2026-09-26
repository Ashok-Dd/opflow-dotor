'use client';

import { useState, useSyncExternalStore, useTransition } from 'react';

import { setPref, signOutDevice } from '@/app/(portal)/actions';
import { useConfirm, useT, useToast } from '@/components/client-kit';
import { Icon, type IconName } from '@/components/icons';
import { agoLabel } from '@/lib/format';
import type { Devices, Prefs } from '@/lib/types';

const ROWS: [keyof Prefs, IconName, string, string][] = [
  ['newBookings', 'calendarCheck', 'New booking', 'When a patient books you'],
  ['bookingChanges', 'repeat', 'Booking changed', 'When a patient changes date or time'],
  ['reminders', 'alarm', 'OPD starts soon', '30 minutes before each OPD'],
  ['eveningSummary', 'reports', 'Evening summary', "Tomorrow's bookings at 8 PM"],
];

/** The four phone-notification switches (the same as the app). Saved at once; put back if it didn't save. */
export function PrefSwitches({ initial }: { initial: Prefs }) {
  const { t } = useT();
  const toast = useToast();
  const [on, setOn] = useState(initial);
  const [, start] = useTransition();
  const flip = (k: keyof Prefs, v: boolean) => {
    setOn((p) => ({ ...p, [k]: v }));
    start(async () => {
      const r = await setPref(k, v);
      if (!r?.ok) {
        setOn((p) => ({ ...p, [k]: !v }));
        toast(t(r?.message ?? 'Something went wrong. Please try again.'), true);
      }
    });
  };
  return (
    <div className="rows">
      {ROWS.map(([k, icon, title, text]) => (
        <label key={k} className="row" style={{ cursor: 'pointer' }}>
          <span className="ico">
            <Icon name={icon} />
          </span>
          <span className="txt">
            <b>{t(title)}</b>
            <span>{t(text)}</span>
          </span>
          <span className="switch">
            <input type="checkbox" checked={on[k]} onChange={(e) => flip(k, e.target.checked)} />
            <span />
          </span>
        </label>
      ))}
      <BrowserAlerts />
    </div>
  );
}

/** Pop-up notices on this computer while the website is open (emergency patients, new messages). */
function BrowserAlerts() {
  const { t } = useT();
  // The browser's own answer (the server draws the page as "not asked yet").
  const [asked, setAsked] = useState<NotificationPermission | null>(null);
  const real = useSyncExternalStore(
    () => () => undefined,
    () => (typeof Notification === 'undefined' ? 'none' : Notification.permission),
    () => 'default' as const,
  );
  const perm = asked ?? real;
  const setPerm = setAsked;
  if (perm === 'none') return null;
  return (
    <div className="row">
      <span className="ico">
        <Icon name="bell" />
      </span>
      <span className="txt">
        <b>{t('Alerts on this computer')}</b>
        <span>
          {perm === 'granted'
            ? t('On: emergency patients and new messages pop up while this page is open.')
            : perm === 'denied'
              ? t('Blocked in this browser. Allow notifications for this site in the browser settings.')
              : t('Get emergency patients and new messages as pop-ups while this page is open.')}
        </span>
      </span>
      {perm === 'default' ? (
        <button type="button" className="btn small" onClick={async () => setPerm(await Notification.requestPermission())}>
          {t('Turn on')}
        </button>
      ) : null}
    </div>
  );
}

/** Where this account is signed in: phones (up to the limit) and this website (its own place). */
export function DeviceList({ initial }: { initial: Devices }) {
  const { t, lang } = useT();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [list, setList] = useState(initial.items);
  const [pending, start] = useTransition();
  return (
    <div className="card">
      <h3>{t('Signed in on')}</h3>
      <p className="muted" style={{ marginTop: -6, fontSize: 13.5 }}>
        {t('Up to {0} phones and {1} computer at a time.', [initial.max, initial.maxWeb])}
      </p>
      <div className="grid" style={{ gap: 8 }}>
        {list.map((d) => (
          <div key={d.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--rule-soft)' }}>
            <span className="avatar" style={{ width: 36, height: 36, borderRadius: 10 }}>
              <Icon name={d.platform === 'web' ? 'reports' : 'call'} />
            </span>
            <span style={{ flex: 1 }}>
              <b style={{ textTransform: 'capitalize' }}>{d.device}</b>
              {d.thisDevice ? <span className="tag good" style={{ marginLeft: 8 }}>{t('This one')}</span> : null}
              <span className="faint" style={{ display: 'block', fontSize: 12.5 }}>
                {t('Last used {0}', [agoLabel(lang, d.lastUsedAt).toLowerCase()])}
              </span>
            </span>
            {!d.thisDevice ? (
              <button
                type="button"
                className="btn ghost small"
                disabled={pending}
                onClick={async () => {
                  if (!(await confirm(t('Sign out this device?'), t('It will need the OPD ID and password to come back.'), t('Sign out'), true))) return;
                  start(async () => {
                    const r = await signOutDevice(d.id);
                    if (r?.ok) {
                      setList((l) => l.filter((x) => x.id !== d.id));
                      toast(t('Signed out'));
                    } else if (r) toast(t(r.message), true);
                  });
                }}
              >
                {t('Sign out')}
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {dialog}
    </div>
  );
}
