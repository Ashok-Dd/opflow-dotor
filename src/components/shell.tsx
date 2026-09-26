'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { inbox, signOut, switchHospital } from '@/app/(portal)/actions';
import type { DoctorHospital, EmergencyState, Message } from '@/lib/types';

import { useT } from './client-kit';
import { EmergencyButton } from './emergency';
import { Icon, OpMark, type IconName } from './icons';
import { LangToggle } from './lang-toggle';

const NAV: { title: string; items: { href: string; label: string; icon: IconName }[] }[] = [
  {
    title: 'OPD',
    items: [
      { href: '/today', label: 'Today', icon: 'today' },
      { href: '/bookings', label: 'Bookings', icon: 'bookings' },
      { href: '/messages', label: 'Messages', icon: 'messages' },
    ],
  },
  {
    title: 'My work',
    items: [
      { href: '/timings', label: 'My timings', icon: 'timings' },
      { href: '/leave', label: 'Leave and holidays', icon: 'leave' },
      { href: '/hospitals', label: 'Hospitals I work at', icon: 'hospitals' },
      { href: '/earnings', label: 'My earnings', icon: 'earnings' },
      { href: '/reports', label: 'Reports', icon: 'reports' },
    ],
  },
  {
    title: 'Me',
    items: [
      { href: '/profile', label: 'My profile', icon: 'profile' },
      { href: '/settings', label: 'Messages settings', icon: 'settings' },
      { href: '/password', label: 'Change password', icon: 'password' },
    ],
  },
];

/**
 * The frame: green sidebar (slides in behind ☰ on small screens) and a top bar with the hospital switcher, the
 * emergency switch, the messages bell and the language. New messages are checked every 60 s; with the doctor's
 * permission the browser also shows them as a notification while this page is open.
 */
export function Shell({
  doctor,
  hospitals,
  hospitalId,
  emergency,
  unread: unread0,
  newestAt,
  children,
}: {
  doctor: { name: string; loginId: string; initials: string; photo?: string };
  hospitals: DoctorHospital[];
  hospitalId: string | null;
  emergency: EmergencyState;
  unread: number;
  /** The newest message's time when the page was drawn (the regular check asks only for newer ones). */
  newestAt: string;
  children: ReactNode;
}) {
  const { t } = useT();
  const path = usePathname();
  const router = useRouter();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  // The bell: the page's count, or a newer one from the regular check (measured against that same page count).
  const [polled, setPolled] = useState<{ base: number; n: number } | null>(null);
  const unread = polled && polled.base === unread0 ? polled.n : unread0;
  const [pickHospital, setPickHospital] = useState(false);
  const newest = useRef<string>(newestAt);
  const hospital = hospitals.find((h) => h.id === hospitalId) ?? null;

  // New messages: the count in the bell, and (if allowed) a browser notification for each new one.
  useEffect(() => {
    let stop = false;
    const check = async () => {
      const r = await inbox({ limit: 5, after: newest.current });
      if (stop || !r?.ok || !r.data) return;
      setPolled({ base: unread0, n: r.data.unread });
      const fresh: Message[] = r.data.items;
      if (fresh.length && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        for (const m of fresh.slice(0, 3)) {
          const n = new Notification(t(m.title), { body: m.body, icon: '/icon.png', tag: m.id });
          n.onclick = () => {
            window.focus();
            router.push(m.bookingId ? `/bookings/${m.bookingId}` : '/messages');
          };
        }
      }
      if (fresh[0]) newest.current = fresh[0].createdAt;
    };
    // The page already came with the count; the first check is in a minute.
    const id = setInterval(check, 60_000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [router, t, unread0]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenOn(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className={`frame${open ? ' menu-open' : ''}`}>
      <aside className="side" aria-label={t('Menu')}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Link prefetch={false} href="/today" className="brand">
            <OpMark size={34} color="#fff" />
            <div>
              <b>OPflow</b>
              <span>{t('FOR DOCTORS')}</span>
            </div>
          </Link>
          <button type="button" className="close" aria-label={t('Close menu')} onClick={() => setOpenOn(null)}>
            <Icon name="x" />
          </button>
        </div>
        <nav>
          {NAV.map((g) => (
            <div key={g.title}>
              <div className="group">{t(g.title)}</div>
              {g.items.map((i) => {
                const active = path === i.href || path.startsWith(`${i.href}/`);
                return (
                  <Link prefetch={false} key={i.href} href={i.href} aria-current={active ? 'page' : undefined} onClick={() => setOpenOn(null)}>
                    <span className="ico">
                      <Icon name={i.icon} />
                    </span>
                    <span>{t(i.label)}</span>
                    {i.href === '/messages' && unread > 0 ? <span className="count">{unread > 99 ? '99+' : unread}</span> : <span />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="who">
          <div className="avatar" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- doctor photos come from the storage CDN already in small fixed sizes */}
            {doctor.photo ? <img src={doctor.photo} alt="" /> : doctor.initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <b>{doctor.name}</b>
            <span>{doctor.loginId}</span>
          </div>
          <form action={signOut}>
            <button type="submit">{t('Log out')}</button>
          </form>
        </div>
      </aside>
      <div className="scrim" onClick={() => setOpenOn(null)} aria-hidden="true" />

      <div className="main">
        <header className="bar">
          <button type="button" className="burger" aria-label={t('Open menu')} onClick={() => setOpenOn(path)}>
            <Icon name="menu" size={20} />
          </button>
          {hospital ? (
            <div className="menu">
              <button
                type="button"
                className="pillbtn"
                onClick={() => hospitals.length > 1 && setPickHospital((v) => !v)}
                aria-haspopup={hospitals.length > 1 ? 'menu' : undefined}
                aria-expanded={pickHospital}
              >
                <Icon name="hospital" />
                <span style={{ textAlign: 'left' }}>
                  <small>{t('Hospital')}</small>
                  {hospital.name}
                </span>
                {hospitals.length > 1 ? <Icon name="chevron" size={16} /> : null}
              </button>
              {pickHospital ? (
                <div className="pop" role="menu" style={{ left: 0, right: 'auto', minWidth: 280 }}>
                  {hospitals.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={h.id === hospitalId}
                      onClick={async () => {
                        setPickHospital(false);
                        await switchHospital(h.id);
                        router.refresh();
                      }}
                    >
                      <Icon name={h.id === hospitalId ? 'check' : 'hospital'} />
                      <span>
                        <b style={{ display: 'block' }}>{h.name}</b>
                        <span className="faint" style={{ fontSize: 12.5 }}>
                          {[h.area, h.city].filter(Boolean).join(', ')}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="spacer" />
          <EmergencyButton state={emergency} hospitals={hospitals} hospitalId={hospitalId} />
          <Link prefetch={false} href="/messages" className="pillbtn" aria-label={unread ? t('Messages, {0} new', [unread]) : t('Messages')}>
            <Icon name="bell" />
            {unread > 0 ? <span className="dot">{unread > 9 ? '9+' : unread}</span> : null}
          </Link>
          <span className="hide-sm">
            <LangToggle />
          </span>
        </header>
        <main className="sheet">{children}</main>
      </div>
    </div>
  );
}
