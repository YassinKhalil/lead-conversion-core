import type { LocalizedText } from './types.js';

/**
 * Meta caps an interactive list row title at 24 characters and silently
 * truncates anything longer. Titles are built to fit rather than trimmed, so a
 * long Arabic weekday/month pair never loses its time.
 */
export const SLOT_TITLE_MAX_LENGTH = 24;

const MAX_LOOKAHEAD_DAYS = 14;
const HOUR_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)$/;

const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const WEEKDAYS_CA = ['diumenge', 'dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres', 'dissabte'];
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_CA = ['gen', 'feb', 'març', 'abr', 'maig', 'juny', 'jul', 'ago', 'set', 'oct', 'nov', 'des'];
const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

export interface SlotSchedulingConfig {
  timezone: string;
  appointmentHours: string[];
  blackoutDays: string[];
}

export interface GeneratedSlot {
  startsAt: string;
  localDate: string;
  localTime: string;
  labels: LocalizedText;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * Every conversion below goes through the IANA database via
 * `Intl.DateTimeFormat` with an explicit `timeZone`. Egypt observes DST from
 * the last Friday of April to the last Thursday of October, so a fixed
 * +02:00/+03:00 offset would place slots on the wrong instant around either
 * boundary.
 */
function localDate(timezone: string, date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function zonedParts(date: Date, timezone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((part) => part.type === type)?.value || '0');
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

function partsAsUtcMs(parts: ZonedParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

function calendarDatePlusDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split('-').map((value) => Number(value));
  return new Date(Date.UTC(year || 1970, (month || 1) - 1, (day || 1) + days)).toISOString().slice(0, 10);
}

function weekdayIndex(dateString: string): number {
  const [year, month, day] = dateString.split('-').map((value) => Number(value));
  return new Date(Date.UTC(year || 1970, (month || 1) - 1, day || 1)).getUTCDay();
}

function zonedDateTimeToUtcIso(dateString: string, hour: number, minute: number, timezone: string): string {
  const [year, month, day] = dateString.split('-').map((value) => Number(value));
  const targetParts: ZonedParts = {
    year: year || 1970,
    month: month || 1,
    day: day || 1,
    hour,
    minute,
    second: 0,
  };
  let candidateMs = partsAsUtcMs(targetParts);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const deltaMs = partsAsUtcMs(targetParts) - partsAsUtcMs(zonedParts(new Date(candidateMs), timezone));
    if (deltaMs === 0) return new Date(candidateMs).toISOString();
    candidateMs += deltaMs;
  }
  return new Date(candidateMs).toISOString();
}

export function parseAppointmentHours(values: unknown): Array<{ hour: number; minute: number; text: string }> {
  const source = Array.isArray(values) ? values : [];
  const seen = new Set<string>();
  const parsed: Array<{ hour: number; minute: number; text: string }> = [];
  for (const value of source) {
    const match = HOUR_PATTERN.exec(String(value).trim());
    if (!match) continue;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    const text = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    if (seen.has(text)) continue;
    seen.add(text);
    parsed.push({ hour, minute, text });
  }
  return parsed.sort((a, b) => (a.hour - b.hour) || (a.minute - b.minute));
}

function fitTitle(full: string, compact: string): string {
  return full.length <= SLOT_TITLE_MAX_LENGTH ? full : compact;
}

function slotLabels(dateString: string, time: string): LocalizedText {
  const weekday = weekdayIndex(dateString);
  const [, month = '1', day = '1'] = dateString.split('-');
  const dayNumber = String(Number(day));
  const monthIndex = Number(month) - 1;
  return {
    English: fitTitle(
      `${WEEKDAYS_EN[weekday]} ${dayNumber} ${MONTHS_EN[monthIndex]} ${time}`,
      `${WEEKDAYS_EN[weekday]} ${dayNumber}/${Number(month)} ${time}`,
    ),
    Arabic: fitTitle(
      `${WEEKDAYS_AR[weekday]} ${dayNumber} ${MONTHS_AR[monthIndex]} ${time}`,
      `${WEEKDAYS_AR[weekday]} ${dayNumber}/${Number(month)} ${time}`,
    ),
    Spanish: fitTitle(
      `${WEEKDAYS_ES[weekday]} ${dayNumber} ${MONTHS_ES[monthIndex]} ${time}`,
      `${WEEKDAYS_ES[weekday]} ${dayNumber}/${Number(month)} ${time}`,
    ),
    Catalan: fitTitle(
      `${WEEKDAYS_CA[weekday]} ${dayNumber} ${MONTHS_CA[monthIndex]} ${time}`,
      `${WEEKDAYS_CA[weekday]} ${dayNumber}/${Number(month)} ${time}`,
    ),
  };
}

function isBlackout(dateString: string, blackoutDays: string[]): boolean {
  const weekday = (WEEKDAYS_EN[weekdayIndex(dateString)] || '').toLocaleLowerCase();
  return blackoutDays.some((day) => String(day).trim().toLocaleLowerCase() === weekday);
}

/**
 * The next `days` non-blackout local days starting from tomorrow, one slot per
 * configured appointment hour, capped at `maxSlots`. Offers start tomorrow so
 * the set a lead sees does not depend on what time of day they replied.
 */
export function generateAppointmentSlots(input: {
  config: SlotSchedulingConfig;
  now?: Date;
  days?: number;
  maxSlots?: number;
  excludeStartsAt?: string[];
}): GeneratedSlot[] {
  const hours = parseAppointmentHours(input.config.appointmentHours);
  if (hours.length === 0) return [];
  const timezone = input.config.timezone || 'Africa/Cairo';
  const days = input.days ?? 3;
  const maxSlots = input.maxSlots ?? 9;
  const now = input.now ?? new Date();
  const excluded = new Set((input.excludeStartsAt || []).map((value) => new Date(value).toISOString()));

  const slots: GeneratedSlot[] = [];
  const dateString = localDate(timezone, now);
  let eligibleDays = 0;
  for (let offset = 1; offset <= MAX_LOOKAHEAD_DAYS && eligibleDays < days && slots.length < maxSlots; offset += 1) {
    const candidate = calendarDatePlusDays(dateString, offset);
    if (isBlackout(candidate, input.config.blackoutDays)) continue;
    eligibleDays += 1;
    for (const hour of hours) {
      if (slots.length >= maxSlots) break;
      const startsAt = zonedDateTimeToUtcIso(candidate, hour.hour, hour.minute, timezone);
      if (excluded.has(startsAt)) continue;
      slots.push({
        startsAt,
        localDate: candidate,
        localTime: hour.text,
        labels: slotLabels(candidate, hour.text),
      });
    }
  }
  return slots;
}

/** Rebuilds the row title for an already-persisted slot instant. */
export function formatSlotLabel(startsAt: string, timezone: string): LocalizedText {
  const parts = zonedParts(new Date(startsAt), timezone || 'Africa/Cairo');
  const dateString = [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-');
  const time = `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
  return slotLabels(dateString, time);
}
