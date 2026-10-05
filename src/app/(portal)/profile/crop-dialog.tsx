'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useT } from '@/components/client-kit';

/** What patients see is a portrait, 4:5. The preview is 280 × 350; the saved photo is 800 × 1000. */
const FW = 280;
const FH = 350;
const OUT_W = 800;
const OUT_H = 1000;
const MAX_ZOOM = 5;

/**
 * Asks the doctor to frame the photo: drag to move, slider or mouse wheel to zoom, inside a fixed portrait frame.
 * Gives back a 800 × 1000 JPEG (turned the right way up). Same idea as the app's crop screen.
 */
export function CropDialog({ file, onCancel, onDone }: { file: File; onCancel: () => void; onDone: (photo: Blob) => void }) {
  const { t } = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [bmp, setBmp] = useState<ImageBitmap | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  // The middle of the visible part, in the picture's own pixels.
  const centre = useRef({ x: 0, y: 0 });
  const [, redraw] = useState(0);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);

  useEffect(() => {
    let alive = true;
    createImageBitmap(file, { imageOrientation: 'from-image' })
      .then((b) => {
        if (!alive) return b.close();
        centre.current = { x: b.width / 2, y: b.height / 2 };
        setBmp(b);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [file]);

  /** Picture pixels shown per frame pixel at this zoom (zoom 1 = the picture just covers the frame). */
  const view = useCallback(
    (z: number) => {
      if (!bmp) return { vw: FW, vh: FH };
      const base = Math.max(FW / bmp.width, FH / bmp.height);
      return { vw: FW / (base * z), vh: FH / (base * z) };
    },
    [bmp],
  );

  const clamp = useCallback(
    (z: number) => {
      if (!bmp) return;
      const { vw, vh } = view(z);
      centre.current = {
        x: Math.min(bmp.width - vw / 2, Math.max(vw / 2, centre.current.x)),
        y: Math.min(bmp.height - vh / 2, Math.max(vh / 2, centre.current.y)),
      };
    },
    [bmp, view],
  );

  const paint = useCallback(
    (target: HTMLCanvasElement, w: number, h: number) => {
      if (!bmp) return;
      const ctx = target.getContext('2d');
      if (!ctx) return;
      const { vw, vh } = view(zoom);
      ctx.fillStyle = '#fff'; // a see-through PNG gets a white background, not black
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bmp, centre.current.x - vw / 2, centre.current.y - vh / 2, vw, vh, 0, 0, w, h);
    },
    [bmp, view, zoom],
  );

  useEffect(() => {
    if (canvas.current) paint(canvas.current, FW * 2, FH * 2);
  });

  const setZ = (z: number) => {
    const next = Math.min(MAX_ZOOM, Math.max(1, z));
    clamp(next);
    setZoom(next);
  };

  const done = () => {
    const out = document.createElement('canvas');
    out.width = OUT_W;
    out.height = OUT_H;
    paint(out, OUT_W, OUT_H);
    out.toBlob((b) => (b ? onDone(b) : setFailed(true)), 'image/jpeg', 0.88);
  };

  return (
    <dialog ref={dialog} onCancel={onCancel} style={{ border: '1px solid var(--rule)', borderRadius: 8, padding: 18, background: 'var(--card)', maxWidth: 'min(92vw, 360px)' }}>
      <h3 style={{ margin: '0 0 4px' }}>{t('Crop your photo')}</h3>
      <p className="muted" style={{ margin: '0 0 12px', fontSize: 13.5 }}>
        {t('Move and zoom so your face is in the middle.')}
      </p>
      {failed ? (
        <p role="alert" style={{ color: 'var(--alarm)' }}>
          {t('This photo could not be opened. Please choose another one.')}
        </p>
      ) : (
        <>
          <canvas
            ref={canvas}
            width={FW * 2}
            height={FH * 2}
            aria-label={t('Your photo. Drag to move it.')}
            style={{ width: FW, height: FH, maxWidth: '100%', display: 'block', margin: '0 auto', border: '1px solid var(--rule)', cursor: 'grab', touchAction: 'none', background: '#eee' }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerMove={(e) => {
              if (!drag.current || !bmp) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const { vw } = view(zoom);
              const perPx = vw / rect.width;
              centre.current = { x: centre.current.x - (e.clientX - drag.current.x) * perPx, y: centre.current.y - (e.clientY - drag.current.y) * perPx };
              drag.current = { x: e.clientX, y: e.clientY };
              clamp(zoom);
              redraw((n) => n + 1);
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            onWheel={(e) => setZ(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, fontSize: 13 }}>
            <span className="muted">{t('Zoom')}</span>
            <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={zoom} onChange={(e) => setZ(Number(e.target.value))} style={{ flex: 1 }} disabled={!bmp} />
          </label>
        </>
      )}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
        <button type="button" className="btn ghost" onClick={onCancel}>
          {t('Cancel')}
        </button>
        {!failed ? (
          <button type="button" className="btn" disabled={!bmp} onClick={done}>
            {t('Use this photo')}
          </button>
        ) : null}
      </div>
    </dialog>
  );
}
