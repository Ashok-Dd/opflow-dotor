'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { saveWeek } from '@/app/(portal)/actions';
import { useConfirm, useT, useToast } from '@/components/client-kit';
import { ClockRange } from '@/components/clock';
import { Icon } from '@/components/icons';
import { hourLabel } from '@/lib/format';
import type { Week, WeekBlock } from '@/lib/types';
import { OpLoadingScreen } from '@/components/op-loader';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;
const hOf = (s: string) => Number(s.slice(0, 2));
const clone = (w: Week) => JSON.parse(JSON.stringify(w)) as Week;
const OPEN_AHEAD = [7, 14, 30, 60];

/** Every week, per hospital: hours, patients per hour, average time, emergencies; and how far ahead to book. */
export function WeekEditor({ initial }: { initial: Week }) {
  const { t } = useT();
  const toast = useToast();
  const router = useRouter();
  const [week, setWeek] = useState(() => clone(initial));
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const [pending, start] = useTransition();
  const { confirm, dialog } = useConfirm();
  const dirty = JSON.stringify(week) !== saved;

  const day = (wd: number) => week.days.find((d) => d.weekday === wd)!;
  const edit = (wd: number, fn: (blocks: WeekBlock[]) => WeekBlock[]) =>
    setWeek((w) => ({ ...w, days: w.days.map((d) => (d.weekday === wd ? { ...d, blocks: fn(d.blocks.map((b) => ({ ...b }))) } : d)) }));
  const add = (wd: number) =>
    edit(wd, (blocks) => {
      const last = blocks[blocks.length - 1];
      const start = last ? Math.min(22, hOf(last.end) + 1) : 9;
      return [...blocks, { start: hh(start), end: hh(Math.min(23, start + 4)), perHour: last?.perHour ?? 8, takeEmergency: true, avgMinutes: last?.avgMinutes ?? 7 }];
    });
  const sameMonSat = () =>
    setWeek((w) => {
      const mon = w.days.find((d) => d.weekday === 1)!.blocks;
      return { ...w, days: w.days.map((d) => (d.weekday >= 2 && d.weekday <= 6 ? { ...d, blocks: mon.map((b) => ({ ...b })) } : d)) };
    });

  const save = async () => {
    if (!(await confirm(t('Save your new timings?'), t('Patients will see the new times and can book them. Bookings already made stay the same.'), t('Yes, save')))) return;
    start(async () => {
      const r = await saveWeek({ hospitalId: week.hospitalId, openDaysAhead: week.openDaysAhead, days: week.days });
      if (r?.ok && r.data) {
        setWeek(clone(r.data));
        setSaved(JSON.stringify(r.data));
        toast(t(r.message ?? 'Saved. Patients will see the new times.'));
        router.refresh();
      } else if (r && !r.ok) toast(t(r.message), true);
    });
  };

  return (
    <>
      {pending ? <OpLoadingScreen message={t('Saving your timings…')} detail={t('Patients will see the new times')} /> : null}
      {dialog}
      <h2 className="sec">{t('Every week')}</h2>
      <div className="wk">
        {[1, 2, 3, 4, 5, 6, 7].map((wd) => {
          const blocks = day(wd).blocks;
          return (
            <div key={wd} className="card d">
              <div>
                <b>{t(DAYS[wd - 1]!)}</b>
                <div className="faint" style={{ fontSize: 13 }}>
                  {blocks.length ? blocks.map((b) => `${hourLabel(hOf(b.start))} – ${hourLabel(hOf(b.end))}`).join(', ') : t('No OPD')}
                </div>
              </div>
              <div>
                {blocks.map((b, i) => (
                  <div key={i} className="blk">
                    <ClockRange start={hOf(b.start)} end={hOf(b.end)} shortSame={false} />
                    <label className="sr" htmlFor={`s${wd}${i}`}>
                      {t('Starts at')}
                    </label>
                    <select
                      name="start"
                      id={`s${wd}${i}`}
                      value={hOf(b.start)}
                      onChange={(e) => edit(wd, (bs) => bs.map((x, j) => (j === i ? { ...x, start: hh(Number(e.target.value)), end: hOf(x.end) <= Number(e.target.value) ? hh(Number(e.target.value) + 1) : x.end } : x)))}
                    >
                      {Array.from({ length: 17 }, (_, k) => k + 6).map((h) => (
                        <option key={h} value={h}>
                          {hourLabel(h)}
                        </option>
                      ))}
                    </select>
                    <span className="faint">–</span>
                    <label className="sr" htmlFor={`e${wd}${i}`}>
                      {t('Ends at')}
                    </label>
                    <select name="end" id={`e${wd}${i}`} value={hOf(b.end)} onChange={(e) => edit(wd, (bs) => bs.map((x, j) => (j === i ? { ...x, end: hh(Number(e.target.value)) } : x)))}>
                      {Array.from({ length: 23 - hOf(b.start) }, (_, k) => hOf(b.start) + 1 + k).map((h) => (
                        <option key={h} value={h}>
                          {hourLabel(h)}
                        </option>
                      ))}
                    </select>
                    <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                      {t('Patients per hour')}
                      <select name="perHour" value={b.perHour} onChange={(e) => edit(wd, (bs) => bs.map((x, j) => (j === i ? { ...x, perHour: Number(e.target.value) } : x)))}>
                        {Array.from({ length: 20 }, (_, k) => k + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                      {t('Average time per patient')}
                      <select name="avgMinutes" value={b.avgMinutes} onChange={(e) => edit(wd, (bs) => bs.map((x, j) => (j === i ? { ...x, avgMinutes: Number(e.target.value) } : x)))}>
                        {Array.from({ length: 29 }, (_, k) => k + 2).map((n) => (
                          <option key={n} value={n}>
                            {n} min
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                      <span className="switch">
                        <input type="checkbox" checked={b.takeEmergency} onChange={(e) => edit(wd, (bs) => bs.map((x, j) => (j === i ? { ...x, takeEmergency: e.target.checked } : x)))} />
                        <span />
                      </span>
                      {t('Take emergency patients')}
                    </label>
                    <span className="faint" style={{ fontSize: 12.5 }}>
                      {t('Total online: {0} patients', [(hOf(b.end) - hOf(b.start)) * b.perHour])}
                    </span>
                    <button type="button" className="btn ghost small" onClick={() => edit(wd, (bs) => bs.filter((_, j) => j !== i))} aria-label={t('Remove this time')} title={t('Remove this time')}>
                      <Icon name="x" size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="actions" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <button type="button" className="btn ghost small" onClick={() => add(wd)} disabled={blocks.length >= 4}>
                  + {t('Add time')}
                </button>
                {wd === 1 && blocks.length ? (
                  <button type="button" className="btn ghost small" onClick={sameMonSat}>
                    {t('Same for Mon – Sat')}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginTop: 14 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <b>{t('Open booking before')}</b>
          <div className="muted" style={{ fontSize: 13.5 }}>
            {t('How many days ahead patients can book')}
          </div>
        </div>
        <div className="chips">
          {OPEN_AHEAD.map((n) => (
            <button key={n} type="button" className="chip" aria-pressed={week.openDaysAhead === n} onClick={() => setWeek((w) => ({ ...w, openDaysAhead: n }))}>
              {t('{0} days', [n])}
            </button>
          ))}
        </div>
      </div>

      <div className="actions" style={{ position: 'sticky', bottom: 16, marginTop: 18, justifyContent: 'flex-end' }}>
        {dirty ? <span className="tag warn big">{t('Not saved yet')}</span> : null}
        <button type="button" className="btn ghost" disabled={!dirty || pending} onClick={() => setWeek(JSON.parse(saved) as Week)}>
          {t('Undo')}
        </button>
        <button type="button" className="btn" disabled={!dirty || pending} onClick={save}>
          <Icon name="check" /> {pending ? t('Saving your timings…') : t('Save')}
        </button>
      </div>
    </>
  );
}
