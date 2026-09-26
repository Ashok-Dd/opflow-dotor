import type { SVGProps } from 'react';

/** The OPflow "OP" mark (same shapes as the app's op_mark.dart). */
export function OpMark({ size = 36, color = 'currentColor', beat = '#8ed6a6' }: { size?: number; color?: string; beat?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="30" cy="50" r="21.5" fill="none" stroke={color} strokeWidth="11" />
      <path d="M64 28.5V80" stroke={color} strokeWidth="11" strokeLinecap="round" fill="none" />
      <path d="M64 28.5h10a13.5 13.5 0 0 1 0 27H64" stroke={color} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M14.95 50h8.6l2.8 4.73 3.44-15.48 3.65 20.21 3.01-9.46h8.6" stroke={beat} strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

const paths: Record<string, string> = {
  today: 'M4 5h16v15H4zM4 10h16M9 3v4M15 3v4M8 14h3v3H8z',
  bookings: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3',
  timings: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  leave: 'M4 20c6-1 10-5 11-11M15 9c2 0 4-1 5-4-3 0-5 1-5 4zM4 20l3-3',
  messages: 'M4 5h16v11H8l-4 4zM8 9h8M8 12h5',
  settings: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20a7 7 0 0 1 14 0',
  hospitals: 'M4 20V8l8-4 8 4v12M9 20v-5h6v5M12 8v4M10 10h4',
  earnings: 'M3 7h18v12H3zM3 11h18M16 15h2',
  reports: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  password: 'M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3M12 15v2',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
  emergency: 'M10 3h4v6.5l5.6-3.2 2 3.4L16 13l5.6 3.3-2 3.4L14 16.5V23h-4v-6.5l-5.6 3.2-2-3.4L8 13 2.4 9.7l2-3.4L10 9.5z',
  hospital: 'M4 20V6h16v14M9 20v-4h6v4M12 8v5M9.5 10.5h5',
  chevron: 'M6 9l6 6 6-6',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  call: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  megaphone: 'M3 10v4h4l6 4V6L7 10zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12',
  coffee: 'M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10h2a2 2 0 0 1 0 4h-2M8 3v3M12 3v3',
  play: 'M8 5l11 7-11 7z',
  pause: 'M8 5h3v14H8zM13 5h3v14h-3z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  dots: 'M12 6h.01M12 12h.01M12 18h.01',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  userx: 'M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM3 20a7 7 0 0 1 11-5.7M16 16l5 5M21 16l-5 5',
  reached: 'M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM3 20a7 7 0 0 1 11-5.7M15 18l2 2 4-4',
  open: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  repeat: 'M4 9a7 7 0 0 1 13-3l2 2M20 15a7 7 0 0 1-13 3l-2-2M19 4v4h-4M5 20v-4h4',
  block: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8',
  seat: 'M6 11V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5M4 11h16v4H4zM6 15v5M18 15v5',
  calendarCheck: 'M4 5h16v15H4zM4 10h16M9 3v4M15 3v4M9 15l2 2 4-4',
  hourglass: 'M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9',
  stop: 'M6 6h12v12H6z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.5',
  lock: 'M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3',
  rupee: 'M7 4h10M7 8h10M7 4c6 0 6 8 0 8h-1l8 8',
  logout: 'M15 4h4v16h-4M10 16l-4-4 4-4M6 12h10',
  menu: 'M4 7h16M4 12h16M4 17h16',
  alarm: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2 2M5 3L2 6M19 3l3 3',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
};

export type IconName = keyof typeof paths;

/** One line-icon style everywhere (1.8 stroke, round caps). */
export function Icon({ name, size = 18, ...rest }: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={paths[name]} />
    </svg>
  );
}
