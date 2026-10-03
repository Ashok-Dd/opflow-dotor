'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useTransition, type ReactNode } from 'react';

import { useT } from '@/components/client-kit';
import { OpLoadingPanel } from '@/components/op-loader';

const Ctx = createContext<{ pending: boolean; go: (href: string) => void }>({ pending: false, go: () => {} });

/**
 * Changing the day or the filter only changes the address's query, so Next shows no loading page for it and the
 * screen looks stuck. Here the change runs as a transition: the old list stays out of the way and the loader shows
 * until the new day has arrived.
 */
export function BookingsShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <Ctx.Provider value={{ pending, go: (href) => start(() => router.push(href)) }}>{children}</Ctx.Provider>;
}

/** A day or filter link: opens at once on the same page and shows the loader while the new list comes. */
export function NavLink({ href, className, current, children }: { href: string; className?: string; current?: boolean; children: ReactNode }) {
  const { go } = useContext(Ctx);
  return (
    <Link
      prefetch={false}
      href={href}
      className={className}
      aria-current={current ? 'page' : undefined}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        go(href);
      }}
    >
      {children}
    </Link>
  );
}

/** The list under the day strip: the loader while another day is coming. */
export function Results({ children }: { children: ReactNode }) {
  const { pending } = useContext(Ctx);
  const { t } = useT();
  return pending ? <OpLoadingPanel text={t('Loading…')} height={300} /> : <>{children}</>;
}
