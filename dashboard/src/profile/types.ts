/**
 * Tenant profile: the presentation layer for one vertical.
 *
 * Frontend only. The backend is one multi-tenant engine; it stores generic
 * leads, answers keyed by question key, scores and assignments, and it is not
 * told which vertical a tenant is in. A profile maps those generic records to
 * the words and columns a tenant's team expects. Nothing here changes what is
 * stored, sent or scored.
 *
 * Not in a profile, on purpose: the conversation panel, the handoff control,
 * the temperature badge and the queue's urgency ordering. They render the same
 * in every vertical and take no profile.
 */

export type VerticalId = 'real_estate' | 'hospitality' | 'clinic';

/** Nouns used in headings, navigation and empty states. */
export interface Terms {
  lead: string;
  leads: string;
  person: string;
  people: string;
  place: string;
  places: string;
  /** What a booked slot is called: a viewing, a reservation. */
  booked: string;
  /** The appointment a buyer or guest arranges: a site visit, a reservation. */
  visit: string;
  /** What routing matches people on: a unit type, a zone. */
  category: string;
  categories: string;
}

/** One of the four facts shown before someone acts on a lead. */
export interface FactSpec {
  label: string;
  /** `budget` is read through the budget normaliser; `answer` is a plain answer key. */
  kind: 'budget' | 'answer';
  key: string;
  numeric: boolean;
}

/** One part of the one-line queue summary, in order. */
/** `unit` is [singular, plural], appended to a bare number so "12" reads as "12 guests". */
export type SummaryPart = { kind: 'budget' } | { kind: 'answer'; key: string; unit?: [string, string] };

export interface ListCopy {
  /** Column header for the line that says what the lead asked for. */
  wantColumn: string;
  leadColumn: string;
  emptyAllDetail: string;
  emptyMineTitle: string;
  emptyMineDetail: string;
  emptyAllTitle: string;
}

/** Longer sentences on the management screens that name the vertical's nouns. */
export interface ManageCopy {
  placesSubtitle: string;
  placesEmptyDetail: string;
  usersEmptyDetail: string;
  roleHint: string;
  atRiskEmptyDetail: string;
}

export interface TenantProfile {
  vertical: VerticalId;
  terms: Terms;
  facts: FactSpec[];
  summary: SummaryPart[];
  qualificationTitle: string;
  qualificationEmptyDetail: string;
  /** The scripted call-prep line and the budget currency only make sense for real estate; the reservations screen only for hospitality; the appointments screen only for clinics. */
  features: { openingLine: boolean; currency: boolean; reservations: boolean; appointments: boolean };
  list: ListCopy;
  manage: ManageCopy;
  questionLabels: Record<string, string>;
  /**
   * Readable text for a stored answer value, by question key. A value with no
   * entry is shown as stored. Needed where an answer is a configuration value
   * (`this_week`) rather than words a person typed.
   */
  valueLabels?: Record<string, Record<string, string>>;
  factorLabels: Record<string, string>;
  stageLabels: Record<string, string>;
  eventLabels: Record<string, string>;
}
