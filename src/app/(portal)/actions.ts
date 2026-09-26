'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { runAction, type ActionResult } from '@/lib/actions';
import { api } from '@/lib/api';
import { clearSession, cookieBase, HOSPITAL, refreshToken } from '@/lib/session';
import type { Board, BookingDetail, DayBooking, Devices, EmergencyState, Messages, Prefs, Today, Week } from '@/lib/types';

/** Every change the website makes goes through these. Pages never call the API from the browser. */
const noRedirect = { redirectOn401: false } as const;

export async function signOut(): Promise<void> {
  const r = await refreshToken();
  if (r) await api('POST', '/v1/auth/logout', { anonymous: true, body: { refreshToken: r } }).catch(() => undefined);
  await clearSession();
  redirect('/sign-in');
}

export async function switchHospital(id: string): Promise<void> {
  (await cookies()).set(HOSPITAL, id, { ...cookieBase, maxAge: 365 * 86_400 });
  revalidatePath('/', 'layout');
}

// ── Today: the live line ──────────────────────────────────────────────────────────────────────────

export async function loadToday(hospitalId: string): Promise<ActionResult<Today>> {
  return runAction(async () => ({ data: await api<Today>('GET', '/v1/doctor/today', { query: { hospital: hospitalId }, ...noRedirect }) }));
}

type Command = 'start' | 'pause' | 'resume' | 'late' | 'end' | 'call-next' | 'done' | 'did-not-come' | 'skip' | 'call-now' | 'mark-reached' | 'put-back';

/**
 * One console command, with the board version the doctor was looking at (for the commands that depend on who is
 * where). The answer is the new line; if the line changed meanwhile, the error carries the fresh line.
 */
export async function opd(
  sessionId: string,
  command: Command,
  input: { expectedVersion?: number; bookingId?: string; minutes?: number; leftovers?: 'move' | 'cancel' } = {},
): Promise<ActionResult<Board>> {
  return runAction(async () => ({
    data: await api<Board>('POST', `/v1/doctor/sessions/${sessionId}/${command}`, { body: input, idempotent: command === 'end', ...noRedirect }),
  }));
}

export async function setBookingsPaused(paused: boolean): Promise<ActionResult> {
  const r = await runAction(async () => {
    await api('POST', '/v1/doctor/me/bookings-pause', { body: { paused }, ...noRedirect });
  });
  revalidatePath('/', 'layout');
  return r;
}

export async function setEmergency(body: { status: EmergencyState['status']; untilAt?: string; hospitalId?: string; mode?: EmergencyState['mode'] }): Promise<ActionResult<EmergencyState>> {
  const r = await runAction(async () => ({ data: await api<EmergencyState>('PUT', '/v1/doctor/emergency', { body, ...noRedirect }) }));
  revalidatePath('/', 'layout');
  return r;
}

// ── Bookings ──────────────────────────────────────────────────────────────────────────────────────

export async function bookingsOn(date: string): Promise<ActionResult<{ items: DayBooking[] }>> {
  return runAction(async () => ({ data: await api<{ items: DayBooking[] }>('GET', '/v1/doctor/bookings', { query: { date }, ...noRedirect }) }));
}

export async function cancelBooking(id: string, reason: string): Promise<ActionResult> {
  const r = await runAction(async () => {
    await api('POST', `/v1/doctor/bookings/${id}/cancel`, { body: { reason }, idempotent: true, ...noRedirect });
  });
  revalidatePath('/bookings', 'layout');
  return r;
}

/** "Ask to pick a new time": the patient chooses any new time (all money back if they don't in 48 hours). */
export async function askNewTime(id: string): Promise<ActionResult> {
  const r = await runAction(async () => {
    await api('POST', `/v1/doctor/bookings/${id}/move`, { body: { reason: 'The doctor changed the time' }, idempotent: true, ...noRedirect });
  });
  revalidatePath('/bookings', 'layout');
  return r;
}

export async function cancelDay(date: string, reason: string): Promise<ActionResult<{ bookings: number; refund: { display: string } }>> {
  const r = await runAction(async () => ({
    data: await api<{ bookings: number; refund: { display: string } }>('POST', `/v1/doctor/days/${date}/cancel`, { body: { reason }, idempotent: true, ...noRedirect }),
  }));
  revalidatePath('/', 'layout');
  return r;
}

export async function bookingDetail(id: string): Promise<ActionResult<BookingDetail>> {
  return runAction(async () => ({ data: await api<BookingDetail>('GET', `/v1/doctor/bookings/${id}`, noRedirect) }));
}

// ── Timings and leave ─────────────────────────────────────────────────────────────────────────────

export async function saveWeek(week: { hospitalId: string; openDaysAhead: number; days: Week['days'] }): Promise<ActionResult<Week>> {
  const r = await runAction(async () => {
    const out = await api<{ week: Week; message: string }>('PUT', '/v1/doctor/schedule', { body: week, ...noRedirect });
    return { data: out.week, message: out.message };
  });
  revalidatePath('/timings');
  return r;
}

export async function saveLeaves(days: string[]): Promise<ActionResult> {
  const r = await runAction(async () => {
    await api('PUT', '/v1/doctor/leaves', { body: { days: days.map((date) => ({ date })) }, ...noRedirect });
  });
  revalidatePath('/leave');
  return r;
}

// ── Messages and settings ─────────────────────────────────────────────────────────────────────────

export async function inbox(query: { limit?: number; after?: string; cursor?: string } = {}): Promise<ActionResult<Messages>> {
  return runAction(async () => ({ data: await api<Messages>('GET', '/v1/notifications', { query: { limit: 30, ...query }, ...noRedirect }) }));
}

export async function markRead(ids: string[] | 'all'): Promise<ActionResult> {
  const r = await runAction(async () => {
    await api('POST', '/v1/notifications/read', { body: ids === 'all' ? { all: true } : { ids }, ...noRedirect });
  });
  revalidatePath('/', 'layout');
  return r;
}

export async function setPref(key: keyof Prefs, value: boolean): Promise<ActionResult<Prefs>> {
  return runAction(async () => ({ data: await api<Prefs>('PATCH', '/v1/me/notification-prefs', { body: { [key]: value }, ...noRedirect }) }));
}

// ── Profile and account ───────────────────────────────────────────────────────────────────────────

export async function saveProfile(body: { gender: string; yearsExperience: number; languages: string[]; about: string; feePaise: number }): Promise<ActionResult> {
  const r = await runAction(async () => {
    await api('PATCH', '/v1/doctor/me', { body, ...noRedirect });
    return { message: 'Profile saved' };
  });
  revalidatePath('/', 'layout');
  return r;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<ActionResult> {
  return runAction(async () => {
    const out = await api<{ message: string }>('POST', '/v1/doctor/password', { body: { currentPassword, newPassword }, ...noRedirect });
    return { message: out.message };
  });
}

export async function devices(): Promise<ActionResult<Devices>> {
  return runAction(async () => ({ data: await api<Devices>('GET', '/v1/doctor/devices', noRedirect) }));
}

export async function signOutDevice(id: string): Promise<ActionResult> {
  const r = await runAction(async () => {
    await api('POST', `/v1/doctor/devices/${id}/sign-out`, { body: {}, ...noRedirect });
  });
  revalidatePath('/settings');
  return r;
}
