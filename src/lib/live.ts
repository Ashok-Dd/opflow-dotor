'use client';

import { io, type Socket } from 'socket.io-client';

import type { Board } from './types';

const LIVE_URL = (process.env.NEXT_PUBLIC_LIVE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

async function token(onSignedOut: () => void): Promise<string | null> {
  try {
    const r = await fetch('/api/live-token', { cache: 'no-store', credentials: 'same-origin' });
    if (r.status === 401) {
      onSignedOut();
      return null;
    }
    if (!r.ok) return null;
    return ((await r.json()) as { token: string }).token;
  } catch {
    return null;
  }
}

/**
 * The live line over the API's WebSocket (/live), the same one the doctor app uses: join the OPD, get `line`
 * every time anything changes (a patient booked, another device pressed Call next…). Tells the page whether the
 * connection is up, so it can check by itself every 10 s while it is down.
 */
export function followLine(sessionId: string, onLine: (b: Board) => void, onConnected: (up: boolean) => void, onSignedOut: () => void): () => void {
  let socket: Socket | null = null;
  let stopped = false;

  void (async () => {
    const t = await token(onSignedOut);
    if (!t || stopped) return;
    socket = io(`${LIVE_URL}/live`, { auth: { token: t }, transports: ['websocket'], reconnectionDelayMax: 10_000 });
    socket.on('connect', () => {
      onConnected(true);
      socket?.emit('join', { sessionId });
    });
    socket.on('disconnect', () => onConnected(false));
    socket.on('connect_error', () => onConnected(false));
    socket.on('line', (b: Board) => {
      if (b.sessionId === sessionId) onLine(b);
    });
    // The token lasts 15 minutes; the server asks for a new one a minute before.
    socket.on('reauth', async () => {
      const n = await token(onSignedOut);
      if (n) socket?.emit('auth', { token: n });
    });
    socket.io.on('reconnect_attempt', async () => {
      const n = await token(onSignedOut);
      if (n && socket) socket.auth = { token: n };
    });
  })();

  return () => {
    stopped = true;
    socket?.emit('leave', { sessionId });
    socket?.disconnect();
    onConnected(false);
  };
}
