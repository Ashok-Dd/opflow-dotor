/** What the OPflow API sends the doctor (the same data the doctor app uses). */

export interface Money {
  paise: number;
  display: string;
}

export interface DoctorMe {
  id: string;
  name: string;
  gender: 'female' | 'male' | 'other';
  typeId: string;
  typeName: string;
  properName: string;
  degrees: string;
  regCouncil: string;
  regNo: string;
  yearsExperience: number;
  languages: string[];
  about: string;
  feePaise: number;
  fee: Money;
  share: Money;
  photo: { s?: string; m?: string; l?: string } | null;
  verification: string;
  status: string;
  bookingsPaused: boolean;
  loginId: string;
  profileStrength: number;
  live: boolean;
  verificationMessage: string;
  lockedNote: string;
}

export interface DoctorHospital {
  id: string;
  name: string;
  area: string;
  city: string;
  address: string;
  phone: string;
  hasEmergency: boolean;
  isPrimary: boolean;
  feePaiseOverride: number | null;
  status: string;
}

/** One patient in the doctor's line (live.service doctorLine). */
export interface LineEntry {
  bookingId: string;
  token: number;
  tokenLabel: string;
  emergency: boolean;
  state: 'not_come' | 'waiting' | 'with_doctor' | 'done' | 'did_not_come' | 'cancelled' | 'moved';
  name: string;
  age: number | null;
  gender: string | null;
  note: string;
  hour: string | null;
  startsAt: string | null;
  reachedAt: string | null;
  calledAt: string | null;
  doneAt: string | null;
  changed: boolean;
}

export interface Board {
  sessionId: string;
  version: number;
  status: 'scheduled' | 'running' | 'paused' | 'ended' | 'cancelled';
  onBreak: boolean;
  date: string;
  hospital: { id: string; name: string };
  time: { startsAt: string; endsAt: string; label: string };
  lateMinutes: number;
  avgConsultMinutes: number;
  nowSeeing: { bookingId: string; tokenLabel: string; name: string } | null;
  counts: { total: number; waiting: number; notCome: number; withDoctor: number; done: number; didNotCome: number; emergency: number };
  line: LineEntry[];
}

export interface Today {
  date: string;
  bookingsPaused: boolean;
  emergency: EmergencyState;
  sessions: Board[];
}

export interface EmergencyState {
  status: 'off' | 'available_now' | 'available_till';
  untilAt: string | null;
  hospitalId: string | null;
  mode: 'at_hospital' | 'phone_first';
  updatedAt?: string | null;
}

export interface DayBooking {
  id: string;
  code: string;
  status: 'confirmed' | 'completed' | 'no_show' | 'cancelled_by_provider';
  tokenLabel: string;
  emergency: boolean;
  name: string;
  age: number | null;
  gender: string | null;
  note: string;
  hospital: { id: string; name: string };
  hour: string;
  startsAt: string;
  queueState: LineEntry['state'] | null;
  changed: boolean;
  waitingForNewTime: boolean;
  fee: Money;
  sessionId: string;
}

export interface BookingDetail {
  id: string;
  code: string;
  status: DayBooking['status'];
  source: 'online' | 'emergency';
  token: number;
  tokenLabel: string;
  name: string;
  age: number | null;
  gender: string | null;
  note: string;
  sessionDate: string;
  sessionId: string;
  hospitalId: string;
  startsAt: string | null;
  state: LineEntry['state'] | null;
  waitingForNewTime: boolean;
  changed: boolean;
  cancelledReason: string | null;
  fee: Money;
  emergencyChargePaise: number;
  events: { type: string; at: string }[];
}

export interface WeekBlock {
  start: string;
  end: string;
  perHour: number;
  takeEmergency: boolean;
  avgMinutes: number;
}

export interface Week {
  hospitalId: string;
  openDaysAhead: number;
  days: { weekday: number; blocks: WeekBlock[] }[];
}

export interface Leave {
  id: string;
  date: string;
  hospitalId: string | null;
  reason: string | null;
}

export interface Earnings {
  days: number;
  totals: { patients: number; earned: Money; inBank: Money; coming: Money; moneyBackGiven: Money };
  rows: { date: string; dayLabel: string; patients: number; fees: Money; opflow: Money; yours: Money; inBank: Money; coming: Money; moneyBack: Money }[];
}

export interface Reports {
  days: number;
  sessions: number;
  booked: number;
  seen: number;
  missed: number;
  cancelled: number;
  emergency: number;
  avgConsultMinutes: number | null;
  showRate: number | null;
}

export interface Message {
  id: string;
  kind: 'booked' | 'reminder' | 'late' | 'turn' | 'cancelled' | 'changed' | 'refund' | 'system';
  title: string;
  body: string;
  bookingId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface Messages {
  items: Message[];
  nextCursor: string | null;
  unread: number;
}

export interface Prefs {
  newBookings: boolean;
  bookingChanges: boolean;
  reminders: boolean;
  eveningSummary: boolean;
}

export interface Devices {
  max: number;
  maxWeb: number;
  items: { id: string; thisDevice: boolean; device: string; platform: string | null; signedInAt: string; lastUsedAt: string }[];
}

export interface BookingCounts {
  from: string;
  days: { date: string; coming: number; total: number }[];
}
