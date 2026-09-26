import { OpLoadingPanel } from '@/components/op-loader';
import { serverT } from '@/lib/lang';

/** Between pages: the OPflow loader (never a blank screen or a spinner). */
export default async function Loading() {
  const t = await serverT();
  return <OpLoadingPanel text={t('Loading…')} height={420} />;
}
