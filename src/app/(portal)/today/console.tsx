'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { loadToday, opd, switchHospital } from '@/app/(portal)/actions';
import { Sheet, useT, useToast } from '@/components/client-kit';
import { ClockRange, ClockTime } from '@/components/clock';
import { Icon } from '@/components/icons';
import { OpLoadingScreen } from '@/components/op-loader';
import { PauseCard, usePauseToggle } from '@/components/pause';
import { clockLabel, hourLabel, istHour, longDate, people } from '@/lib/format';
import { followLine } from '@/lib/live';
import type { Board, LineEntry, Today } from '@/lib/types';

type Cmd = Parameters<typeof opd>[1];

const STATE_LABEL: Record<LineEntry['state'], string> = {
  not_come: 'Not come yet',
  waiting: 'Waiting',
  with_doctor: 'With doctor',
  done: 'Done',
  did_not_come: 'Did not come',
  cancelled: 'Cancelled',
  moved: 'Date changed',
};
const STATE_TONE: Record<LineEntry['state'], string> = {
  not_come: '',
  waiting: 'warn',
  with_doctor: 'info',
  done: 'good',
  did_not_come: 'bad',
  cancelled: 'bad',
  moved: '',
};
const OPEN = new Set<LineEntry['state']>(['not_come', 'waiting', 'with_doctor']);

/** The OPD session to show: the first not yet over, else the last one of the day. */
const pickSession = (sessions: Board[], wanted?: string | null) =>
  sessions.find((s) => s.sessionId === wanted) ?? sessions.find((s) => s.status !== 'ended' && s.status !== 'cancelled') ?? sessions[sessions.length - 1] ?? null;

const hourOf = (e: LineEntry, fallback: number) => (e.startsAt ? istHour(e.startsAt) : fallback);

export function Console({
  initial,
  hospitalId,
  hospitalName,
  bookingsPaused,
  perHour,
  elsewhere,
}: {
  initial: Today;
  hospitalId: string;
  hospitalName: string;
  bookingsPaused: boolean;
  perHour: { start: number; end: number; perHour: number }[];
  elsewhere: { hospitalId: string; name: string; count: number; firstHour: number } | null;
}) {
  const { t, lang } = useT();
  const toast = useToast();
  const router = useRouter();
  const [today, setToday] = useState(initial);
  const [sessionId, setSessionId] = useState<string | null>(pickSession(initial.sessions)?.sessionId ?? null);
  const [connected, setConnected] = useState(false);
  const [busy, startBusy] = useTransition();
  const [heavy, setHeavy] = useState<Cmd | null>(null); // Start / END OPD show the full loader, like the app
  const [lateOpen, setLateOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const seenEmergency = useRef(new Set(initial.sessions.flatMap((s) => s.line.filter((e) => e.emergency).map((e) => e.bookingId))));

  const board = useMemo(() => pickSession(today.sessions, sessionId), [today, sessionId]);

  // One board replaces the one with the same session (from a command, the live connection or a check).
  const applyBoard = useCallback(
    (b: Board) => {
      setToday((d) => {
        const known = d.sessions.find((s) => s.sessionId === b.sessionId);
        if (known && known.version > b.version) return d; // an older answer arriving late
        return { ...d, sessions: known ? d.sessions.map((s) => (s.sessionId === b.sessionId ? b : s)) : [...d.sessions, b] };
      });
      // A new emergency patient: tell the doctor, also as a browser notification.
      for (const e of b.line) {
        if (e.emergency && !seenEmergency.current.has(e.bookingId)) {
          seenEmergency.current.add(e.bookingId);
          toast(t('Emergency patient coming: token {0}, {1}', [e.tokenLabel, e.name]));
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification(t('Emergency patient coming'), { body: `${e.tokenLabel} · ${e.name}`, icon: '/icon.png', tag: e.bookingId });
          }
        }
      }
    },
    [t, toast],
  );

  const refresh = useCallback(async () => {
    const r = await loadToday(hospitalId);
    if (r?.ok && r.data) setToday(r.data);
    else if (r && !r.ok && (r.code === 'UNAUTHENTICATED' || r.code === 'SIGNED_OUT')) router.push('/sign-in?expired=1');
  }, [hospitalId, router]);

  // Live: the WebSocket brings every change at once; a check runs every 10 s while it is down (60 s while up).
  useEffect(() => {
    if (!board) return;
    return followLine(board.sessionId, applyBoard, setConnected, () => router.push('/sign-in?expired=1'));
  }, [board?.sessionId, applyBoard]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const id = setInterval(() => void refresh(), connected ? 60_000 : 10_000);
    return () => clearInterval(id);
  }, [connected, refresh]);

  // Ask once (politely) to show browser notifications for emergency patients and new messages.
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const ask = () => void Notification.requestPermission();
      document.addEventListener('click', ask, { once: true });
      return () => document.removeEventListener('click', ask);
    }
  }, []);

  const send = useCallback(
    (cmd: Cmd, input: Parameters<typeof opd>[2] = {}, ok?: string) =>
      new Promise<boolean>((resolve) => {
        if (!board) return resolve(false);
        if (cmd === 'start' || cmd === 'end') setHeavy(cmd);
        startBusy(async () => {
          const r = await opd(board.sessionId, cmd, { expectedVersion: board.version, ...input });
          if (r?.ok && r.data) {
            applyBoard(r.data);
            if (ok) toast(ok);
            resolve(true);
            return;
          }
          if (r && !r.ok) {
            const fresh = r.details?.board as Board | undefined;
            if (r.code === 'STALE_BOARD' && fresh) {
              applyBoard(fresh);
              toast(t('The line changed. Please check it again.'), true);
            } else if (r.code === 'UNAUTHENTICATED' || r.code === 'SIGNED_OUT') {
              router.push('/sign-in?expired=1');
            } else {
              toast(t(r.message), true);
              void refresh();
            }
          }
          resolve(false);
        });
      }).finally(() => setHeavy(null)),
    [board, applyBoard, toast, t, refresh, router],
  );

  const current = board?.line.find((e) => e.state === 'with_doctor') ?? null;
  // Who CALL NEXT calls: the next one who reached, else the next token still to come (same as the server).
  const nextUp = board ? (board.line.find((e) => e.state === 'waiting') ?? board.line.find((e) => e.state === 'not_come') ?? null) : null;
  const running = board?.status === 'running' || board?.status === 'paused';
  const onBreak = board?.status === 'paused';

  const callNext = useCallback(async () => {
    if (!board || onBreak || (!nextUp && !current)) return;
    const who = nextUp;
    const done = await send('call-next');
    if (done) toast(who ? t('Calling token {0} — {1}', [who.tokenLabel, who.name]) : t('No one is waiting right now'));
  }, [board, onBreak, nextUp, current, send, toast, t]);

  // Keyboard: N call next · D done · S skip · B break (not while typing or in a dialog).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || busy) return;
      if (el && (el.closest('input, textarea, select, dialog[open]') || el.isContentEditable)) return;
      if (!running) return;
      const k = e.key.toLowerCase();
      if (k === 'n') void callNext();
      else if (k === 'd' && current) void send('done', {}, t('Done'));
      else if (k === 's' && current) void send('skip', { bookingId: current.bookingId }, t('Moved to the end of the line'));
      else if (k === 'b') void send(onBreak ? 'resume' : 'pause', {}, onBreak ? t('OPD started again') : t('Break started. Patients will see it.'));
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [running, onBreak, current, busy, callNext, send, t]);

  const pause = usePauseToggle(bookingsPaused);
  const togglePause = pause.toggle;

  const overlay =
    heavy === 'start' ? (
      <OpLoadingScreen message={t('Starting OPD…')} detail={t('Telling your patients')} />
    ) : heavy === 'end' ? (
      <OpLoadingScreen message={t('Ending OPD…')} />
    ) : null;

  if (!board) {
    return (
      <>
        <Head t={t} lang={lang} date={today.date} connected={connected} />
        {elsewhere ? <Elsewhere e={elsewhere} /> : null}
        <div className="empty" style={{ marginTop: 16 }}>
          <div className="art">
            <Icon name="seat" size={34} />
            <span className="badge">
              <Icon name="calendarCheck" size={16} />
            </span>
          </div>
          <b>{t('No OPD today at {0}', [hospitalName])}</b>
          <p>{t('You have no timings here today. You can add timings in My timings.')}</p>
          <div className="actions" style={{ justifyContent: 'center', marginTop: 14 }}>
            <Link prefetch={false} className="btn ghost" href="/timings">
              {t('My timings')}
            </Link>
          </div>
        </div>
        <PauseCard paused={bookingsPaused} />
        {pause.dialog}
      </>
    );
  }

  const startH = istHour(board.time.startsAt);
  const endTime = new Date(board.time.endsAt);
  const endH = istHour(board.time.endsAt) + (endTime.getUTCMinutes() > 0 ? 1 : 0);
  const cap = perHour.find((b) => startH >= b.start && startH < b.end)?.perHour ?? 8;
  const byHour = new Map<number, LineEntry[]>();
  const emergencies = board.line.filter((e) => e.emergency);
  for (const e of board.line.filter((x) => !x.emergency)) {
    const h = hourOf(e, startH);
    byHour.set(h, [...(byHour.get(h) ?? []), e]);
  }
  const hours = [...byHour.keys()].sort((a, b) => a - b);
  const booked = board.line.filter((e) => !e.emergency && e.state !== 'cancelled').length;
  const later = today.sessions.find((s) => s.sessionId !== board.sessionId && s.status === 'scheduled');

  const sessionTabs =
    today.sessions.length > 1 ? (
      <div className="chips" style={{ marginBottom: 16 }}>
        {today.sessions.map((s) => (
          <button key={s.sessionId} type="button" className="chip" aria-pressed={s.sessionId === board.sessionId} onClick={() => setSessionId(s.sessionId)}>
            <ClockRange start={istHour(s.time.startsAt)} end={istHour(s.time.endsAt) + (new Date(s.time.endsAt).getUTCMinutes() > 0 ? 1 : 0)} />
            {s.status === 'ended' ? ` · ${t('Over')}` : s.status === 'running' ? ` · ${t('Now')}` : ''}
          </button>
        ))}
      </div>
    ) : null;

  const lineList = (compact: boolean) => (
    <>
      {emergencies.length ? (
        <>
          <div className="slot-head">
            <span className="tag bad">{t('Emergency')}</span>
          </div>
          <div className="line">
            {emergencies.map((e) => (
              <Row key={e.bookingId} e={e} compact={compact} running={running} send={send} />
            ))}
          </div>
        </>
      ) : null}
      {hours.map((h) => {
        const inHour = byHour.get(h)!;
        const n = inHour.filter((e) => e.state !== 'cancelled').length;
        return (
          <div key={h}>
            <div className="slot-head">
              <ClockRange start={h} end={h + 1} />
              <Seats total={cap} taken={Math.min(n, cap)} />
              <span className="faint" style={{ marginLeft: 'auto', fontSize: 13 }}>
                {t('{0} booked', [n])}
              </span>
            </div>
            <div className="line">
              {inHour.map((e) => (
                <Row key={e.bookingId} e={e} compact={compact} running={running} send={send} />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );

  // ── Before the OPD starts ──────────────────────────────────────────────────────────────────────
  if (board.status === 'scheduled') {
    return (
      <>
        {overlay}
        <Head t={t} lang={lang} date={today.date} connected={connected} />
        {sessionTabs}
        <div className="console">
          <div>
            <HoursCard startH={startH} endH={endH} cap={cap} line={board.line} booked={booked} emergency={board.counts.emergency} />
            {elsewhere ? <Elsewhere e={elsewhere} /> : null}
            <h2 className="sec">{t('Expected patients')}</h2>
            {board.line.filter((e) => e.state !== 'cancelled' && e.state !== 'moved').length === 0 ? <NoOneYet paused={bookingsPaused} /> : lineList(true)}
          </div>
          <div className="rail">
            <button type="button" className="callnext" disabled={busy} onClick={() => void send('start', {}, t('OPD started. Patients are told.'))}>
              <Icon name="play" size={30} />
              <div>
                <b>{t('START OPD')}</b>
                <span>{t('Patients see “Doctor has started”')}</span>
              </div>
            </button>
            <div className="notice">
              <Icon name="info" />
              <span>{t('When you press Start OPD, patients will see "Doctor has started" and the live line.')}</span>
            </div>
            <PauseCard paused={bookingsPaused} />
            <Shortcuts />
          </div>
        </div>
        {pause.dialog}
      </>
    );
  }

  // ── After the OPD ─────────────────────────────────────────────────────────────────────────────
  if (board.status === 'ended' || board.status === 'cancelled') {
    const count = (s: LineEntry['state']) => board.line.filter((e) => e.state === s).length;
    return (
      <>
        {overlay}
        <Head t={t} lang={lang} date={today.date} connected={connected} />
        {sessionTabs}
        <div className="cols">
          <div className="card">
            <div style={{ color: 'var(--fern)', marginBottom: 6 }}>
              <Icon name="check" size={40} />
            </div>
            <h2 style={{ font: '500 32px var(--serif)', margin: 0 }}>{t('OPD is over')}</h2>
            <p className="muted" style={{ marginTop: 4 }}>
              {t('Good work today.')}
            </p>
            <dl className="kv" style={{ marginTop: 16 }}>
              <dt>{t('Patients seen')}</dt>
              <dd className="tnum">
                <b>{board.counts.done}</b>
              </dd>
              <dt>{t('Did not come')}</dt>
              <dd className="tnum">{board.counts.didNotCome}</dd>
              <dt>{t('Average time per patient')}</dt>
              <dd className="tnum">{t('{0} min', [board.avgConsultMinutes])}</dd>
              <dt>{t('Ran late by')}</dt>
              <dd className="tnum">{board.lateMinutes ? t('{0} min', [board.lateMinutes]) : t('On time')}</dd>
              <dt>{t('Moved to another day')}</dt>
              <dd className="tnum">{count('moved')}</dd>
              <dt>{t('Cancelled with money back')}</dt>
              <dd className="tnum">{count('cancelled')}</dd>
            </dl>
          </div>
          <div className="grid">
            {later ? (
              <button type="button" className="callnext" onClick={() => setSessionId(later.sessionId)}>
                <Icon name="arrow" size={28} />
                <div>
                  <b style={{ fontSize: 20 }}>{t('Open the next OPD ({0})', [hourLabel(istHour(later.time.startsAt))])}</b>
                  <span>{later.time.label}</span>
                </div>
              </button>
            ) : null}
            <Link prefetch={false} className="btn ghost" href="/reports">
              <Icon name="reports" /> {t('See reports')}
            </Link>
            <Link prefetch={false} className="btn ghost" href="/bookings">
              <Icon name="bookings" /> {t('Bookings')}
            </Link>
          </div>
        </div>
        {pause.dialog}
      </>
    );
  }

  // ── While the OPD runs ────────────────────────────────────────────────────────────────────────
  const waitingCount = board.line.filter((e) => e.state === 'waiting' || e.state === 'not_come').length;
  return (
    <>
      {overlay}
      <Head t={t} lang={lang} date={today.date} connected={connected} />
      {sessionTabs}
      <div className="console">
        <div>
          <div className="card flat" style={{ padding: 0 }}>
            <div className="stats five">
              <div>
                <b>{booked}</b>
                <span>{t('Booked')}</span>
              </div>
              <div className="alarm">
                <b>{board.counts.emergency}</b>
                <span>{t('Emergency')}</span>
              </div>
              <div className="fern">
                <b>{board.counts.done}</b>
                <span>{t('Done')}</span>
              </div>
              <div className="amber">
                <b>{board.counts.waiting}</b>
                <span>{t('Waiting')}</span>
              </div>
              <div className="alarm">
                <b>{board.counts.didNotCome}</b>
                <span>{t('Did not come')}</span>
              </div>
            </div>
          </div>
          <div className="actions" style={{ margin: '12px 0 18px' }}>
            {onBreak ? (
              <span className="tag info big">{t('You are on break')}</span>
            ) : board.lateMinutes === 0 ? (
              <span className="tag good big">{t('On time')}</span>
            ) : (
              <span className={`tag big ${board.lateMinutes >= 30 ? 'bad' : 'warn'}`}>{t('{0} min late', [board.lateMinutes])}</span>
            )}
            <span className="faint" style={{ fontSize: 13 }}>
              {t('Patients see this')}
            </span>
            {elsewhere ? (
              <span style={{ marginLeft: 'auto' }}>
                <Elsewhere e={elsewhere} inline />
              </span>
            ) : null}
          </div>

          <div className="head" style={{ margin: '0 0 8px' }}>
            <div className="kicker">{t('WITH DOCTOR NOW')}</div>
          </div>
          {current ? (
            <div className="card now-card">
              <div className="who">
                <div className={`token${current.emergency ? ' em' : ''}`}>{current.tokenLabel}</div>
                <div style={{ minWidth: 0 }}>
                  <h3>{current.name}</h3>
                  <div className="meta">
                    {[current.age != null ? t('{0} years', [current.age]) : null, current.gender ? t(cap1(current.gender)) : null, current.emergency ? t('Emergency') : t('Online')]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
              </div>
              {current.note ? (
                <div className="notice note">
                  <Icon name="messages" />
                  <span>{current.note}</span>
                </div>
              ) : null}
              <div className="acts">
                <button type="button" className="btn" disabled={busy} onClick={() => void send('done', {}, t('Done'))}>
                  <Icon name="check" /> {t('Done')} <kbd>D</kbd>
                </button>
                <button type="button" className="btn danger-outline" disabled={busy} onClick={() => void send('did-not-come', { bookingId: current.bookingId }, t('{0} marked as did not come', [current.name]))}>
                  <Icon name="userx" /> {t('Did not come')}
                </button>
                <button type="button" className="btn ghost" disabled={busy} onClick={() => void send('skip', { bookingId: current.bookingId }, t('Moved to the end of the line'))}>
                  <Icon name="undo" /> {t('Skip for now')} <kbd>S</kbd>
                </button>
              </div>
            </div>
          ) : (
            <div className="card nobody">
              <Icon name="seat" size={26} />
              <span>
                {nextUp ? t('No one inside. Press CALL NEXT for token {0}.', [nextUp.tokenLabel]) : t('No one inside. No one left in the line.')}
              </span>
            </div>
          )}

          <h2 className="sec">
            {t('The line')}
            <small>{people(lang, waitingCount)}</small>
          </h2>
          {board.line.length === 0 ? <NoOneYet paused={bookingsPaused} running /> : lineList(false)}
        </div>

        <div className="rail">
          <button type="button" className="callnext" disabled={busy || onBreak || (!nextUp && !current)} onClick={() => void callNext()}>
            <Icon name="megaphone" size={32} />
            <div>
              <b>{t('CALL NEXT')}</b>
              <span>{nextUp ? t('Token {0}', [nextUp.tokenLabel]) : current ? t('Finish {0}', [current.tokenLabel]) : t('No one waiting')}</span>
            </div>
            <kbd>N</kbd>
          </button>
          <div className="tools">
            <button type="button" className={`tool${onBreak ? ' on' : ''}`} disabled={busy} onClick={() => void send(onBreak ? 'resume' : 'pause', {}, onBreak ? t('OPD started again') : t('Break started. Patients will see it.'))}>
              <Icon name={onBreak ? 'play' : 'coffee'} size={22} />
              {onBreak ? t('Start again') : t('Take a break')}
            </button>
            <button type="button" className="tool" disabled={busy} onClick={() => setLateOpen(true)}>
              <Icon name="clock" size={22} />
              {t('I am late')}
            </button>
            <button type="button" className={`tool${bookingsPaused ? '' : ' amber'}`} disabled={busy || pause.busy} onClick={togglePause}>
              <Icon name={bookingsPaused ? 'play' : 'pause'} size={22} />
              {bookingsPaused ? t('Resume bookings') : t('Pause bookings')}
            </button>
          </div>
          {bookingsPaused ? <span className="tag warn big">{t('New bookings are paused. Patients already booked still come.')}</span> : null}
          <button type="button" className="btn danger-outline wide" disabled={busy} onClick={() => setEndOpen(true)}>
            <Icon name="stop" /> {t('END OPD')}
          </button>
          <Shortcuts />
        </div>
      </div>

      <Sheet open={lateOpen} onClose={() => setLateOpen(false)} label={t('How late are you?')}>
        <h3>{t('How late are you?')}</h3>
        <p className="lead">{t('Patients get a message, so they can come a little later.')}</p>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {[10, 20, 30, 45].map((m) => (
            <button
              key={m}
              type="button"
              className={`btn${board.lateMinutes === m ? '' : ' ghost'}`}
              disabled={busy}
              onClick={async () => {
                if (await send('late', { minutes: m }, t('Patients told: {0} min late', [m]))) setLateOpen(false);
              }}
            >
              {t('+{0} min', [m])}
            </button>
          ))}
        </div>
        <div className="actions" style={{ justifyContent: 'space-between', marginTop: 16 }}>
          <button type="button" className="btn ghost" onClick={() => setLateOpen(false)}>
            {t('Not now')}
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={busy}
            onClick={async () => {
              if (await send('late', { minutes: 0 }, t('Patients told: on time'))) setLateOpen(false);
            }}
          >
            <Icon name="check" /> {t('Back on time')}
          </button>
        </div>
      </Sheet>

      <EndSheet open={endOpen} onClose={() => setEndOpen(false)} left={waitingCount} busy={busy} onEnd={async (leftovers) => {
        if (await send('end', { leftovers }, t('OPD is over'))) setEndOpen(false);
      }} />
      {pause.dialog}
    </>
  );
}

const cap1 = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

function Head({ t, lang, date, connected }: { t: ReturnType<typeof useT>['t']; lang: ReturnType<typeof useT>['lang']; date: string; connected: boolean }) {
  return (
    <header className="head">
      <div>
        <div className="kicker">{longDate(lang, date)}</div>
        <h1>{t("Today's OPD")}</h1>
      </div>
      <span className={`live${connected ? '' : ' off'}`} title={connected ? t('Live: changes appear at once') : t('Checking every few seconds')}>
        <i />
        {connected ? t('LIVE') : t('CHECKING')}
      </span>
    </header>
  );
}

function Seats({ total, taken }: { total: number; taken: number }) {
  return (
    <span className={`seats${taken >= total ? ' full' : ''}`} aria-label={`${taken} / ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < taken ? 'on' : ''} />
      ))}
    </span>
  );
}

/** Today's OPD at a glance: the hours as a clock would say them, how full each hour is, and the counts. */
function HoursCard({ startH, endH, cap, line, booked, emergency }: { startH: number; endH: number; cap: number; line: LineEntry[]; booked: number; emergency: number }) {
  const { t } = useT();
  const hours = Array.from({ length: Math.max(1, endH - startH) }, (_, i) => startH + i);
  const nowH = istHour(new Date().toISOString());
  const at = (h: number) => line.filter((e) => !e.emergency && e.state !== 'cancelled' && hourOf(e, startH) === h).length;
  const seats = hours.length * cap;
  return (
    <div className="card hours">
      <div className="band">
        <div className="label">
          <Icon name="clock" size={15} />
          {t('OPD HOURS TODAY')}
          <span className="hrs">{t('{0} hrs', [hours.length])}</span>
        </div>
        <ClockRange start={startH} end={endH} shortSame={false} />
      </div>
      <div className="fill">
        {hours.map((h) => (
          <div key={h}>
            <i>
              <b className={at(h) >= cap ? 'full' : ''} style={{ height: `${Math.min(100, (at(h) / cap) * 100)}%` }} />
            </i>
            <span className={h === nowH ? 'now' : ''}>
              <ClockTime hour={h} suffix={false} />
            </span>
          </div>
        ))}
      </div>
      <div className="stats">
        <div>
          <b>{booked}</b>
          <span>{t('Booked')}</span>
        </div>
        <div className="alarm">
          <b>{emergency}</b>
          <span>{t('Emergency')}</span>
        </div>
        <div className="fern">
          <b>{Math.max(0, seats - booked)}</b>
          <span>{t('Seats left')}</span>
        </div>
      </div>
    </div>
  );
}

/** "You also have patients today at (the other hospital)", with a switch. */
function Elsewhere({ e, inline }: { e: { hospitalId: string; name: string; count: number; firstHour: number }; inline?: boolean }) {
  const { t, lang } = useT();
  const router = useRouter();
  return (
    <div className="notice warn" style={inline ? { margin: 0, padding: '8px 12px' } : { marginTop: 14 }}>
      <Icon name="hospital" />
      <span style={{ flex: 1 }}>{t('You also have {0} today at {1}, from {2}.', [people(lang, e.count), e.name, hourLabel(e.firstHour)])}</span>
      <button
        type="button"
        className="btn ghost small"
        onClick={async () => {
          await switchHospital(e.hospitalId);
          router.refresh();
        }}
      >
        {t('Switch')}
      </button>
    </div>
  );
}

function NoOneYet({ paused, running }: { paused: boolean; running?: boolean }) {
  const { t } = useT();
  return (
    <div className="empty">
      <div className="art">
        <Icon name="seat" size={34} />
        <span className="badge">
          <Icon name={running ? 'hourglass' : 'calendarCheck'} size={16} />
        </span>
      </div>
      <b>{running ? t('No one is in the line right now') : t('No one has booked this session yet')}</b>
      <p>
        {paused
          ? t('New bookings are paused, so patients cannot book you now. Resume bookings whenever you are ready.')
          : t('Patients can still book your open times. We will send you a message as soon as someone books.')}
      </p>
    </div>
  );
}

function Shortcuts() {
  const { t } = useT();
  return (
    <div className="faint" style={{ fontSize: 12.5, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <span>
        <kbd className="light">N</kbd> {t('Call next')}
      </span>
      <span>
        <kbd className="light">D</kbd> {t('Done')}
      </span>
      <span>
        <kbd className="light">S</kbd> {t('Skip')}
      </span>
      <span>
        <kbd className="light">B</kbd> {t('Break')}
      </span>
    </div>
  );
}

/** One patient in the line, with what the doctor can do for them (the app's per-patient sheet). */
function Row({ e, compact, running, send }: { e: LineEntry; compact: boolean; running: boolean; send: (cmd: Cmd, input?: Parameters<typeof opd>[2], ok?: string) => Promise<boolean> }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (ev: MouseEvent) => !ref.current?.contains(ev.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const faded = e.state === 'done' || e.state === 'cancelled' || e.state === 'moved';
  const act = async (cmd: Cmd, ok: string) => {
    setOpen(false);
    await send(cmd, { bookingId: e.bookingId }, ok);
  };
  const items = [
    e.state === 'not_come' ? { icon: 'reached' as const, label: t('Mark reached'), run: () => act('mark-reached', t('{0} marked as reached', [e.name])) } : null,
    (e.state === 'waiting' || e.state === 'not_come') && running ? { icon: 'megaphone' as const, label: t('Call in now'), run: () => act('call-now', t('Calling token {0}', [e.tokenLabel])) } : null,
    e.state === 'did_not_come' || e.state === 'done' ? { icon: 'undo' as const, label: t('Put back in line'), run: () => act('put-back', t('{0} is back in the line', [e.name])) } : null,
    (e.state === 'waiting' || e.state === 'not_come') && running ? { icon: 'userx' as const, label: t('Did not come'), danger: true, run: () => act('did-not-come', t('{0} marked as did not come', [e.name])) } : null,
  ].filter(Boolean) as { icon: 'reached'; label: string; danger?: boolean; run: () => void }[];
  return (
    <div className={`pt${e.state === 'with_doctor' ? ' with' : ''}${faded ? ' faded' : ''}`}>
      <div className={`tk${e.emergency && e.state !== 'with_doctor' ? ' em' : ''}`}>{e.tokenLabel}</div>
      <div className="nm" style={{ minWidth: 0 }}>
        <b>{e.name}</b>
        {e.emergency ? <span className="src">{t('EMERGENCY')}</span> : null}
        <span>
          {[e.age != null ? t('{0} yrs', [e.age]) : null, e.gender ? t(cap1(e.gender)) : null, e.note || null, e.reachedAt && e.state === 'waiting' ? t('Reached at {0}', [clockLabel(e.reachedAt)]) : null]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>
      {!compact || OPEN.has(e.state) ? <span className={`tag ${STATE_TONE[e.state]}`}>{t(STATE_LABEL[e.state])}</span> : <span />}
      <div className="menu" ref={ref}>
        <button type="button" aria-label={t('Actions for {0}', [e.name])} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <Icon name="dots" />
        </button>
        {open ? (
          <div className="pop" role="menu">
            {items.map((i) => (
              <button key={i.label} type="button" role="menuitem" className={i.danger ? 'danger' : undefined} onClick={i.run}>
                <Icon name={i.icon} /> {i.label}
              </button>
            ))}
            {!e.emergency ? (
              <Link prefetch={false} role="menuitem" href={`/bookings/${e.bookingId}`}>
                <Icon name="open" /> {t('See booking')}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** END OPD: confirm, then what to do for people still in the line (move them, or cancel with money back). */
function EndSheet({ open, onClose, left, busy, onEnd }: { open: boolean; onClose: () => void; left: number; busy: boolean; onEnd: (leftovers: 'move' | 'cancel') => void }) {
  const { t, lang } = useT();
  return (
    <Sheet open={open} onClose={onClose} label={t("End today's OPD?")}>
      <h3>{t("End today's OPD?")}</h3>
      {left > 0 ? (
        <>
          <p className="lead">
            {t('{0} still in the line', [people(lang, left)])}. {t('What should we do for them?')}
          </p>
          <div className="grid">
            <button type="button" className="btn" disabled={busy} onClick={() => onEnd('move')}>
              <Icon name="repeat" /> {t('Move them to another day')}
            </button>
            <button type="button" className="btn danger-outline" disabled={busy} onClick={() => onEnd('cancel')}>
              {t('Cancel and give money back')}
            </button>
            <button type="button" className="btn ghost" onClick={onClose}>
              {t('Not now')}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="lead">{t('Patients will see that the OPD is over.')}</p>
          <div className="actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn ghost" onClick={onClose}>
              {t('Not now')}
            </button>
            <button type="button" className="btn danger" disabled={busy} onClick={() => onEnd('move')}>
              {t('Yes, end OPD')}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
