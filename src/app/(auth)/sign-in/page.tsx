import type { Metadata } from 'next';

import { serverT } from '@/lib/lang';

import { Gate } from '../gate';
import { SignInForm } from '../forms';

export const metadata: Metadata = { title: 'Log in' };

export default async function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  const sp = await searchParams;
  const t = await serverT();
  const next = typeof sp.next === 'string' ? sp.next : '/today';
  return (
    <Gate t={t}>
      <SignInForm next={next} expired={sp.expired === '1'} />
    </Gate>
  );
}
