'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { inbox, markRead } from '@/app/(portal)/actions';
import { useT, useToast } from '@/components/client-kit';
import { Icon, type IconName } from '@/components/icons';
import { agoLabel } from '@/lib/format';
import type { Message, Messages } from '@/lib/types';

const LOOK: Record<Message['kind'], [IconName, string]> = {
  booked: ['calendarCheck', 'var(--fern)'],
  reminder: ['alarm', 'var(--forest)'],
  late: ['clock', 'var(--amber)'],
  turn: ['megaphone', 'var(--fern)'],
  cancelled: ['block', 'var(--alarm)'],
  changed: ['repeat', 'var(--amber)'],
  refund: ['rupee', 'var(--fern)'],
  system: ['info', 'var(--forest)'],
};

export function Inbox({ first }: { first: Messages }) {
  const { t, lang } = useT();
  const toast = useToast();
  const router = useRouter();
  const [items, setItems] = useState(first.items);
  const [cursor, setCursor] = useState(first.nextCursor);
  const [unread, setUnread] = useState(first.unread);
  const [pending, start] = useTransition();

  const open = (m: Message) => {
    if (!m.readAt) {
      setItems((l) => l.map((x) => (x.id === m.id ? { ...x, readAt: new Date().toISOString() } : x)));
      setUnread((n) => Math.max(0, n - 1));
      void markRead([m.id]);
    }
    if (m.bookingId) router.push(`/bookings/${m.bookingId}`);
  };

  if (items.length === 0) {
    return (
      <div className="empty">
        <div className="art">
          <Icon name="bell" size={34} />
        </div>
        <b>{t('No messages')}</b>
        <p>{t('New bookings, time changes and emergency patients will show here.')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="actions" style={{ justifyContent: 'flex-end', marginBottom: 10 }}>
        {unread > 0 ? (
          <button
            type="button"
            className="btn ghost small"
            onClick={() =>
              start(async () => {
                const r = await markRead('all');
                if (r?.ok) {
                  setItems((l) => l.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })));
                  setUnread(0);
                  router.refresh();
                } else if (r) toast(t(r.message), true);
              })
            }
            disabled={pending}
          >
            <Icon name="check" size={16} /> {t('Mark all read')}
          </button>
        ) : null}
      </div>
      <div className="rows" style={{ display: 'block' }}>
        {items.map((m) => {
          const [icon, color] = LOOK[m.kind] ?? LOOK.system;
          return (
            <button
              key={m.id}
              type="button"
              className={`msg${m.readAt ? '' : ' unread'}`}
              onClick={() => open(m)}
              style={{ width: '100%', border: 0, borderBottom: '1px solid var(--rule-soft)', cursor: m.bookingId || !m.readAt ? 'pointer' : 'default', textAlign: 'left', font: 'inherit', display: 'grid' }}
            >
              <span className="ic" style={{ color }}>
                <Icon name={icon} size={20} />
              </span>
              <span style={{ minWidth: 0 }}>
                <b>{t(m.title)}</b>
                <p>{m.body}</p>
              </span>
              <span style={{ display: 'flex', alignItems: 'center' }}>
                <time dateTime={m.createdAt}>{agoLabel(lang, m.createdAt)}</time>
                {m.readAt ? null : <span className="u" aria-label={t('New')} />}
              </span>
            </button>
          );
        })}
      </div>
      {cursor ? (
        <div className="actions" style={{ justifyContent: 'center', marginTop: 14 }}>
          <button
            type="button"
            className="btn ghost"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await inbox({ cursor });
                if (r?.ok && r.data) {
                  const known = new Set(items.map((x) => x.id));
                  setItems((l) => [...l, ...r.data!.items.filter((x) => !known.has(x.id))]);
                  setCursor(r.data.nextCursor);
                } else if (r && !r.ok) toast(t(r.message), true);
              })
            }
          >
            {pending ? t('Loading more…') : t('Load more')}
          </button>
        </div>
      ) : null}
    </>
  );
}
