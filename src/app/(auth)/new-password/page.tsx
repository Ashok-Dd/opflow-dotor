import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { serverT } from '@/lib/lang';
import { CHANGE } from '@/lib/session';

import { Gate } from '../gate';
import { NewPasswordForm } from '../forms';

export const metadata: Metadata = { title: 'Set your password' };

export default async function NewPasswordPage({ searchParams }: PageProps<'/new-password'>) {
  // Only right after a first sign-in (the one-time token lives 10 minutes).
  if (!(await cookies()).get(CHANGE)) redirect('/sign-in?expired=1');
  const sp = await searchParams;
  const t = await serverT();
  return (
    <Gate t={t}>
      <NewPasswordForm next={typeof sp.next === 'string' ? sp.next : '/today'} />
    </Gate>
  );
}
