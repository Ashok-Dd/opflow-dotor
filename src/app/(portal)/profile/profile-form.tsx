'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { saveProfile } from '@/app/(portal)/actions';
import { useT, useToast } from '@/components/client-kit';
import { Icon } from '@/components/icons';
import { rupees } from '@/lib/format';

const LANGS = ['Telugu', 'English', 'Hindi', 'Urdu', 'Tamil', 'Kannada'];
type Form = { gender: string; yearsExperience: number; languages: string[]; about: string; feePaise: number };

/** Gender, years, languages, fee (with the 90 / 10 split) and "About me" — the same fields as the app. */
export function ProfileForm({ initial }: { initial: Form }) {
  const { t } = useT();
  const toast = useToast();
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(f) !== saved;
  const fee = Math.round(f.feePaise / 100);
  const opflow = Math.floor(fee / 10);

  const save = () =>
    start(async () => {
      const r = await saveProfile(f);
      if (r?.ok) {
        setSaved(JSON.stringify(f));
        toast(t('Profile saved'));
        router.refresh();
      } else if (r) toast(t(r.message), true);
    });

  const stepper = (value: number, set: (v: number) => void, min: number, max: number, step: number, unit: string) => (
    <div className="actions" style={{ gap: 6 }}>
      <button type="button" className="btn ghost small" onClick={() => set(Math.max(min, value - step))} disabled={value <= min} aria-label="−">
        −
      </button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => set(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
        style={{ width: 100, textAlign: 'center' }}
      />
      <button type="button" className="btn ghost small" onClick={() => set(Math.min(max, value + step))} disabled={value >= max} aria-label="+">
        +
      </button>
      <span className="muted">{t(unit)}</span>
    </div>
  );

  return (
    <div className="card">
      <div className="field">
        <span>{t('Gender')}</span>
        <div className="chips">
          {(['female', 'male', 'other'] as const).map((g) => (
            <button key={g} type="button" className="chip" aria-pressed={f.gender === g} onClick={() => setF({ ...f, gender: g })}>
              {t(g === 'female' ? 'Female' : g === 'male' ? 'Male' : 'Other')}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>{t('Years of experience')}</span>
        {stepper(f.yearsExperience, (v) => setF({ ...f, yearsExperience: v }), 0, 60, 1, 'years')}
      </div>
      <div className="field">
        <span>{t('Languages you speak')}</span>
        <div className="chips">
          {LANGS.map((l) => {
            const on = f.languages.includes(l);
            return (
              <button
                key={l}
                type="button"
                className="chip"
                aria-pressed={on}
                onClick={() => {
                  const next = on ? f.languages.filter((x) => x !== l) : [...f.languages, l];
                  if (next.length) setF({ ...f, languages: next });
                }}
              >
                {t(l)}
              </button>
            );
          })}
        </div>
      </div>
      <div className="field">
        <span>{t('Doctor fee')}</span>
        {stepper(fee, (v) => setF({ ...f, feePaise: v * 100 }), 50, 3000, 50, 'rupees')}
        <div className="notice" style={{ marginTop: 6 }}>
          <Icon name="rupee" />
          <span>{t('Patient pays {0}. You get {1} (90%). OPflow keeps {2} (10%).', [rupees(fee * 100), rupees((fee - opflow) * 100), rupees(opflow * 100)])}</span>
        </div>
      </div>
      <label className="field">
        <span>
          {t('About me')} <i>· {t('{0} / 240', [f.about.length])}</i>
        </span>
        <textarea value={f.about} maxLength={240} onChange={(e) => setF({ ...f, about: e.target.value })} placeholder={t('What you treat, how you work with patients…')} />
      </label>
      <div className="actions" style={{ justifyContent: 'flex-end' }}>
        {dirty ? <span className="tag warn">{t('Not saved yet')}</span> : null}
        <button type="button" className="btn ghost" disabled={!dirty || pending} onClick={() => setF(JSON.parse(saved) as Form)}>
          {t('Undo')}
        </button>
        <button type="button" className="btn" disabled={!dirty || pending} onClick={save}>
          <Icon name="check" /> {pending ? t('Saving your profile…') : t('Save')}
        </button>
      </div>
    </div>
  );
}
