'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { currentPhoto, photoDone, removePhoto, uploadPhoto } from '@/app/(portal)/actions';
import { useConfirm, useT, useToast } from '@/components/client-kit';
import { Icon } from '@/components/icons';
import { OpLoader, OpLoadingScreen } from '@/components/op-loader';
import { initials } from '@/lib/format';

const LONG_SIDE = 1200;

/** The picked photo as a JPEG no longer than 1200 px (turned the right way up), like the app's image picker. */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, LONG_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  ctx.fillStyle = '#fff'; // a see-through PNG gets a white background, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no blob'))), 'image/jpeg', 0.86));
}

/** The doctor's photo with Change / Remove. The new photo shows once the API has made its sizes. */
export function PhotoPicker({ name, photo }: { name: string; photo: string | null }) {
  const { t } = useT();
  const toast = useToast();
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const waitForNewPhoto = async (before: string | null) => {
    setWaiting(true);
    for (let i = 0; i < 20 && alive.current; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const r = await currentPhoto();
      if (r?.ok && r.data && r.data !== before) break;
    }
    if (!alive.current) return;
    await photoDone();
    setWaiting(false);
    setPreview(null);
    router.refresh();
  };

  const pick = (file: File | undefined) => {
    if (input.current) input.current.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast(t('Please choose a JPG, PNG or WebP photo.'), true);
    start(async () => {
      let blob: Blob;
      try {
        blob = await shrink(file);
      } catch {
        toast(t('This photo could not be opened. Please choose another one.'), true);
        return;
      }
      const form = new FormData();
      form.set('photo', new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
      const r = await uploadPhoto(form);
      if (r?.ok) {
        setPreview(URL.createObjectURL(blob));
        toast(t('Photo saved. Patients will see it in a moment.'));
        void waitForNewPhoto(photo);
      } else if (r) toast(t(r.message), true);
    });
  };

  const remove = async () => {
    if (!(await confirm(t('Remove your photo?'), t('Patients will see your initials instead.'), t('Yes, remove'), true))) return;
    start(async () => {
      const r = await removePhoto();
      if (r?.ok) {
        toast(t('Photo removed'));
        router.refresh();
      } else if (r) toast(t(r.message), true);
    });
  };

  const shown = preview ?? photo;
  return (
    <div className="photo-pick">
      {pending ? <OpLoadingScreen message={t('Saving your photo…')} detail={t('Patients will see it right away')} /> : null}
      <div className="avatar" style={{ width: 84, height: 104, borderRadius: 16, fontSize: 30, position: 'relative' }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- doctor photos come from the storage CDN already in small fixed sizes */}
        {shown ? <img src={shown} alt="" /> : initials(name)}
        {waiting ? (
          <span className="photo-wait" title={t('Getting your photo ready…')}>
            <OpLoader size={34} color="#fff" beat="var(--leaf)" label={t('Getting your photo ready…')} />
          </span>
        ) : null}
      </div>
      <div className="photo-btns">
        <button type="button" className="btn ghost small" disabled={pending || waiting} onClick={() => input.current?.click()}>
          <Icon name="camera" /> {photo ? t('Change photo') : t('Add photo')}
        </button>
        {photo && !waiting ? (
          <button type="button" className="linkbtn" disabled={pending} onClick={() => void remove()}>
            {t('Remove')}
          </button>
        ) : null}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pick(e.target.files?.[0])} />
      {dialog}
    </div>
  );
}
