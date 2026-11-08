import type { Appointment } from '../api/types';

/**
 * Pure helpers for the appointments screen. No React Native imports, so the
 * root test suite can import this file. Date and clock helpers are shared with
 * the reservations screen.
 */
export { dayLabel, timeIn, todayIn } from '../reservations/format';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Awaiting confirmation',
  booked: 'Booked',
  confirmed: 'Confirmed',
  completed: 'Attended',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};

export const statusLabel = (status: string): string => STATUS_LABEL[status] ?? status;

/** Appointments that still hold a slot. */
const ACTIVE = ['pending', 'booked', 'confirmed'];
export const isActive = (a: Pick<Appointment, 'status'>): boolean => ACTIVE.includes(a.status);
export const activeCount = (items: Pick<Appointment, 'status'>[]): number => items.filter(isActive).length;

export interface AppointmentDay {
  date: string;
  items: Appointment[];
}

/** Days in date order, each in time order. Cancelled ones stay listed so the desk sees what changed. */
export function groupByDay(items: Appointment[]): AppointmentDay[] {
  const days = new Map<string, Appointment[]>();
  for (const item of items) days.set(item.date, [...(days.get(item.date) ?? []), item]);
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({ date, items: [...list].sort((a, b) => a.startsAt.localeCompare(b.startsAt)) }));
}
