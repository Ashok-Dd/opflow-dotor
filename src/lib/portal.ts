import 'server-only';

import { cookies } from 'next/headers';
import { cache } from 'react';

import { get } from './api';
import { HOSPITAL } from './session';
import type { DoctorHospital, DoctorMe } from './types';

/**
 * Who is signed in, their hospitals and the one on screen — once per request (the layout and the page share it).
 * Throws the API's error (e.g. no internet); the layout shows it in place.
 */
export const portal = cache(async () => {
  const [me, all] = await Promise.all([get<DoctorMe>('/v1/doctor/me'), get<DoctorHospital[]>('/v1/doctor/hospitals')]);
  const hospitals = all.filter((h) => h.status === 'active');
  const chosen = (await cookies()).get(HOSPITAL)?.value;
  const hospital = hospitals.find((h) => h.id === chosen) ?? hospitals.find((h) => h.isPrimary) ?? hospitals[0] ?? null;
  return { me, hospitals, hospital };
});
