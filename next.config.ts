import type { NextConfig } from 'next';

/** Private site for doctors: strict headers, no framing, no referrers to other sites, never indexed. */
const live = (process.env.NEXT_PUBLIC_LIVE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const liveWs = live.replace(/^http/, 'ws');
const dev = process.env.NODE_ENV !== 'production';

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" + (dev ? " 'unsafe-eval'" : ''),
  "style-src 'self' 'unsafe-inline'",
  // Doctor photos come from the storage CDN.
  "img-src 'self' data: https:" + (dev ? ' http://localhost:3000' : ''),
  "font-src 'self'",
  // The live line: the API's WebSocket (and its polling fallback).
  `connect-src 'self' ${live} ${liveWs}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
].join('; ');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default nextConfig;
