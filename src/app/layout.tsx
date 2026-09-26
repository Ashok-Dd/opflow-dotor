import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from 'next/font/google';

import { LangProvider, ToastProvider } from '@/components/client-kit';
import { getLang } from '@/lib/lang';

import './globals.css';

const plex = IBM_Plex_Sans({ variable: '--font-plex', subsets: ['latin'], weight: ['400', '500', '600', '700'] });
const plexMono = IBM_Plex_Mono({ variable: '--font-plex-mono', subsets: ['latin'], weight: ['400', '500', '600'] });
const newsreader = Newsreader({ variable: '--font-newsreader', subsets: ['latin'], weight: ['400', '500'], style: ['normal', 'italic'] });

export const metadata: Metadata = {
  title: { default: 'OPflow for Doctors', template: '%s · OPflow for Doctors' },
  description: 'Run your OPD from your desk: today’s line, bookings, timings and messages.',
  robots: { index: false, follow: false, nocache: true },
  // same-origin (not no-referrer): browsers send Origin: null with no-referrer, and Server Actions rightly refuse that.
  referrer: 'same-origin',
};

export const viewport: Viewport = { themeColor: '#1f7a5c' };

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const lang = await getLang();
  return (
    <html lang={lang === 'te' ? 'te' : 'en-IN'} className={`${plex.variable} ${plexMono.variable} ${newsreader.variable}`}>
      <body>
        <LangProvider lang={lang}>
          <ToastProvider>{children}</ToastProvider>
        </LangProvider>
      </body>
    </html>
  );
}
