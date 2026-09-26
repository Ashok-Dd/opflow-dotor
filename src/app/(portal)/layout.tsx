import { Shell } from '@/components/shell';
import { ApiError, get } from '@/lib/api';
import { initials } from '@/lib/format';
import { serverT } from '@/lib/lang';
import { portal } from '@/lib/portal';
import type { EmergencyState, Messages } from '@/lib/types';

/** Every signed-in page: the frame with the doctor, their hospitals, emergency status and unread messages. */
export default async function PortalLayout({ children }: LayoutProps<'/'>) {
  const t = await serverT();
  let data;
  try {
    const [p, emergency, msgs] = await Promise.all([
      portal(),
      get<EmergencyState>('/v1/doctor/emergency'),
      get<Messages>('/v1/notifications', { limit: 1 }),
    ]);
    data = { ...p, emergency, unread: msgs.unread, newestAt: msgs.items[0]?.createdAt ?? new Date().toISOString() };
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    return (
      <div className="gate" style={{ gridTemplateColumns: '1fr' }}>
        <div className="form">
          <div className="pass">
            <h1>{t('We could not load your OPD')}</h1>
            <p className="lead">{t(err.message)}</p>
            <a className="btn" href="/today">
              {t('Try again')}
            </a>
          </div>
        </div>
      </div>
    );
  }
  const { me, hospitals, hospital, emergency, unread, newestAt } = data;
  return (
    <Shell
      doctor={{ name: me.name, loginId: me.loginId, initials: initials(me.name), photo: me.photo?.s ?? me.photo?.m }}
      hospitals={hospitals}
      hospitalId={hospital?.id ?? null}
      emergency={emergency}
      unread={unread}
      newestAt={newestAt}
    >
      {children}
    </Shell>
  );
}
