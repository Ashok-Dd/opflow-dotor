'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { translator, type Lang, type T } from '@/lib/i18n';

// ── Language ─────────────────────────────────────────────────────────────────────────────────────────

const LangCtx = createContext<{ lang: Lang; t: T }>({ lang: 'en', t: translator('en') });

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangCtx.Provider value={{ lang, t: translator(lang) }}>{children}</LangCtx.Provider>;
}

/** `const { t, lang } = useT();` in client components. */
export const useT = () => useContext(LangCtx);

// ── Toasts: short notes at the bottom ("Saved", or what went wrong) ──────────────────────────────────

interface Toast {
  id: number;
  text: string;
  bad?: boolean;
}
const ToastCtx = createContext<(text: string, bad?: boolean) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const next = useRef(1);
  const show = useCallback((text: string, bad?: boolean) => {
    const id = next.current++;
    setList((l) => [...l.slice(-2), { id, text, bad }]);
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), bad ? 6000 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {list.map((x) => (
          <div key={x.id} className={`toast${x.bad ? ' bad' : ''}`}>
            {x.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

// ── Dialog: the website's version of the app's bottom sheets ─────────────────────────────────────────

export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="sheet-dlg"
      aria-label={label}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // a click on the dimmed background
      }}
    >
      {open ? <div className="in">{children}</div> : null}
    </dialog>
  );
}

/** Ask "Are you sure?": resolves true when the doctor confirms. */
export type Confirm = (title: string, text: string, yes: string, danger?: boolean, no?: string) => Promise<boolean>;

/** "Are you sure?" with the app's words; resolves true when confirmed. */
export function useConfirm() {
  const [ask, setAsk] = useState<{ title: string; text: string; yes: string; danger?: boolean; no?: string; resolve: (ok: boolean) => void } | null>(null);
  const { t } = useT();
  const confirm = useCallback(
    (title: string, text: string, yes: string, danger?: boolean, no?: string) => new Promise<boolean>((resolve) => setAsk({ title, text, yes, danger, no, resolve })),
    [],
  );
  const close = (ok: boolean) => {
    ask?.resolve(ok);
    setAsk(null);
  };
  const dialog = (
    <Sheet open={!!ask} onClose={() => close(false)} label={ask?.title ?? ''}>
      {ask ? (
        <>
          <h3>{ask.title}</h3>
          <p className="lead" style={{ whiteSpace: 'pre-line' }}>
            {ask.text}
          </p>
          <div className="actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn ghost" onClick={() => close(false)}>
              {ask.no ?? t('Not now')}
            </button>
            <button type="button" className={`btn${ask.danger ? ' danger' : ''}`} onClick={() => close(true)} autoFocus>
              {ask.yes}
            </button>
          </div>
        </>
      ) : null}
    </Sheet>
  );
  return { confirm, dialog };
}
