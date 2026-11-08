import { describe, expect, it } from 'vitest';
import type { Lead, Role } from '../dashboard/src/api/types.js';
import { eventLabel, factorLabel, PIPELINE_STAGES, questionLabel, stageLabel, valueLabel } from '../dashboard/src/leads/labels.js';
import { fourFacts, indexAnswerMap, summaryLine } from '../dashboard/src/leads/qualification.js';
import { rowSummary } from '../dashboard/src/leads/queue.js';
import { navFor } from '../dashboard/src/nav/routes.js';
import { clinic, hospitality, PROFILES, realEstate, resolveProfile } from '../dashboard/src/profile/index.js';
import { words } from '../dashboard/src/profile/words.js';

const values = (o: object): string[] => Object.values(o) as string[];
const allText = (p: typeof realEstate): string[] => [
  ...values(p.terms),
  ...p.facts.map((f) => f.label),
  p.qualificationTitle,
  p.qualificationEmptyDetail,
  ...values(p.list),
  ...values(p.manage),
  ...values(p.questionLabels),
  ...values(p.factorLabels),
  ...values(p.stageLabels),
  ...values(p.eventLabels),
];

describe('real estate profile is the dashboard as it was', () => {
  it('keeps every label the app used before profiles existed', () => {
    expect(questionLabel('q_budget')).toBe('Budget');
    expect(questionLabel('q_unit_type')).toBe('Unit type');
    expect(questionLabel('q_permission')).toBe('Permission to ask');
    expect(questionLabel('q_site_visit')).toBe('Site visit');
    expect(questionLabel('q_something_new')).toBe('Something new');
    expect(factorLabel('location_present')).toBe('Location given');
    expect(factorLabel('qualified_state')).toBe('Reached qualified');
    expect(factorLabel('mystery')).toBe('Mystery');
    expect(stageLabel('site_visit_scheduled')).toBe('Site visit scheduled');
    expect(stageLabel(undefined)).toBe('New');
    expect(stageLabel('')).toBe('New');
    expect(eventLabel('lead.intake_received')).toBe('Lead received');
    expect(eventLabel('salesperson.appointment_booked_notification')).toBe('Viewing booked');
    expect(eventLabel('dashboard.human_takeover_enabled')).toBe('Human took over');
    expect(eventLabel('x.some_event')).toBe('Some event');
  });

  it('keeps the navigation labels per role', () => {
    const labels = (role: Role) => navFor(role).map((i) => i.label);
    expect(labels('salesperson')).toEqual(['Queue', 'Notifications']);
    expect(labels('manager')).toEqual(['Overview', 'Leads', 'Salespeople', 'Projects', 'Notifications']);
    expect(labels('admin')).toEqual(['Overview', 'Leads', 'Salespeople', 'Projects', 'Users', 'Notifications']);
  });

  it('shows the same four facts and summary line', () => {
    const answers = indexAnswerMap({
      q_unit_type: 'Apartment',
      q_location: 'New Cairo',
      q_budget: '3000000-5000000',
      q_payment_plan: 'Installments',
      q_timeline: 'Within 3 months',
    });
    expect(fourFacts(answers, 'EGP')).toEqual([
      { label: 'Budget', value: '3M – 5M EGP', numeric: true },
      { label: 'Unit', value: 'Apartment', numeric: false },
      { label: 'Location', value: 'New Cairo', numeric: false },
      { label: 'Timeline', value: 'Within 3 months', numeric: false },
    ]);
    expect(summaryLine(answers)).toBe('Apartment · New Cairo · 3M+ · Installments · Within 3 months');
  });
});

describe('hospitality profile re-labels without changing behaviour', () => {
  const answers = indexAnswerMap({ q_party_size: '4', q_date_shift: 'Friday, dinner', q_zone: 'Terrace', q_deposit: 'Not required' });

  it('swaps the four facts and the summary line', () => {
    expect(fourFacts(answers, 'EGP', hospitality)).toEqual([
      { label: 'Party size', value: '4', numeric: true },
      { label: 'Date and shift', value: 'Friday, dinner', numeric: false },
      { label: 'Zone', value: 'Terrace', numeric: false },
      { label: 'Deposit', value: 'Not required', numeric: false },
    ]);
    expect(summaryLine(answers, hospitality)).toBe('4 guests · Friday, dinner · Terrace');
    expect(summaryLine(indexAnswerMap({ q_party_size: '1' }), hospitality)).toBe('1 guest');
    expect(summaryLine(indexAnswerMap({ q_party_size: 'a few' }), hospitality)).toBe('a few');
  });

  it('never shows a currency, even when one is passed', () => {
    expect(fourFacts(indexAnswerMap({ q_budget: '3000000-5000000' }), 'AED', hospitality).every((f) => !f.value.includes('AED'))).toBe(true);
  });

  it('labels navigation, stages and events in its own words', () => {
    expect(navFor('manager', hospitality).map((i) => i.label)).toEqual(['Overview', 'Guests', 'Hosts', 'Venues', 'Reservations', 'Notifications']);
    expect(stageLabel('closed_won', hospitality)).toBe('Seated');
    expect(eventLabel('salesperson.appointment_booked_notification', hospitality)).toBe('Reservation booked');
    expect(questionLabel('q_party_size', hospitality)).toBe('Party size');
  });

  it('keeps routes, roles and stage values identical across profiles, plus the one screen only hospitality has', () => {
    const shape = (p: typeof realEstate) => navFor('admin', p).map((i) => `${i.href}:${i.roles.join('|')}`);
    expect(shape(hospitality).filter((entry) => !entry.startsWith('/reservations:'))).toEqual(shape(realEstate));
    expect(shape(hospitality).filter((entry) => entry.startsWith('/reservations:'))).toHaveLength(1);
    expect(Object.keys(hospitality.stageLabels)).toEqual([...PIPELINE_STAGES]);
  });

  it('falls back to the project line when a guest has no answers yet', () => {
    const lead = { qualificationAnswers: {}, project: { projectName: 'Casa Mar', location: 'Barcelona' }, status: 'new', currentStage: '' } as unknown as Lead;
    expect(rowSummary(lead, hospitality)).toBe('Casa Mar · Barcelona');
  });
});

describe('clinic profile re-labels without changing behaviour', () => {
  const answers = indexAnswerMap({ q_service: 'cleaning', q_patient_type: 'new', q_urgency: 'this_week', q_time_pref: 'morning' });

  it('turns stored answer values into words in the four facts and the summary line', () => {
    expect(fourFacts(answers, 'EGP', clinic)).toEqual([
      { label: 'Treatment', value: 'Cleaning', numeric: false },
      { label: 'Patient', value: 'New patient', numeric: false },
      { label: 'How soon', value: 'This week', numeric: false },
      { label: 'Time of day', value: 'Morning', numeric: false },
    ]);
    expect(summaryLine(answers, clinic)).toBe('Cleaning · New patient · This week · Morning');
    expect(valueLabel('q_urgency', 'something_else', clinic)).toBe('something_else');
    expect(valueLabel('q_urgency', 'asap')).toBe('asap');
  });

  it('labels navigation, stages and events in its own words, with the appointments screen', () => {
    expect(navFor('manager', clinic).map((i) => i.label)).toEqual(['Overview', 'Patients', 'Coordinators', 'Clinics', 'Appointments', 'Notifications']);
    expect(stageLabel('site_visit_scheduled', clinic)).toBe('Appointment booked');
    expect(eventLabel('salesperson.appointment_booked_notification', clinic)).toBe('Appointment booked');
    expect(questionLabel('q_urgency', clinic)).toBe('How soon');
    expect(factorLabel('urgency', clinic)).toBe('How soon');
  });

  it('keeps routes, roles and stage values identical across profiles, plus the one screen only clinics have', () => {
    const shape = (p: typeof realEstate) => navFor('admin', p).map((i) => `${i.href}:${i.roles.join('|')}`);
    expect(shape(clinic).filter((entry) => !entry.startsWith('/appointments:'))).toEqual(shape(realEstate));
    expect(shape(clinic).filter((entry) => entry.startsWith('/appointments:'))).toHaveLength(1);
    expect(Object.keys(clinic.stageLabels)).toEqual([...PIPELINE_STAGES]);
  });

  it('only clinics get the appointments screen, only hospitality the reservations screen', () => {
    expect(Object.values(PROFILES).map((p) => [p.vertical, p.features.appointments, p.features.reservations])).toEqual([
      ['real_estate', false, false], ['hospitality', false, true], ['clinic', true, false],
    ]);
  });
});

describe('profiles are complete and do not leak into each other', () => {
  it('define the same keys, so a screen cannot meet a missing label', () => {
    for (const p of Object.values(PROFILES)) {
      expect(Object.keys(p.terms)).toEqual(Object.keys(realEstate.terms));
      expect(Object.keys(p.list)).toEqual(Object.keys(realEstate.list));
      expect(Object.keys(p.manage)).toEqual(Object.keys(realEstate.manage));
      expect(Object.keys(p.eventLabels)).toEqual(Object.keys(realEstate.eventLabels));
      expect(Object.keys(p.stageLabels)).toEqual(Object.keys(realEstate.stageLabels));
      expect(p.facts).toHaveLength(4);
    }
  });

  it('keeps real estate words out of hospitality', () => {
    const banned = /\b(leads?|budget|unit|units|viewings?|brokers?|brokerage|salespeople|salesperson|projects?|site visit|developments?)\b/i;
    for (const text of allText(hospitality)) expect(text, text).not.toMatch(banned);
  });

  it('keeps hospitality words out of real estate', () => {
    const banned = /\b(guests?|reservations?|venues?|hosts?|party size|zones?|seated|restaurants?)\b/i;
    for (const text of allText(realEstate)) expect(text, text).not.toMatch(banned);
  });

  it('keeps real estate and hospitality words out of the clinic', () => {
    const banned = /\b(leads?|budget|unit|units|viewings?|brokers?|brokerage|salespeople|salesperson|projects?|site visit|developments?|guests?|reservations?|venues?|hosts?|party size|zones?|seated|restaurants?)\b/i;
    for (const text of [...allText(clinic), ...Object.values(clinic.valueLabels ?? {}).flatMap(values)]) expect(text, text).not.toMatch(banned);
  });

  it('keeps clinic words out of the other profiles', () => {
    const banned = /\b(patients?|clinics?|coordinators?|appointments?|attended)\b/i;
    for (const p of [realEstate, hospitality]) for (const text of allText(p)) expect(text, text).not.toMatch(banned);
  });

  it('has no key for the panels that must look the same in every vertical', () => {
    for (const p of Object.values(PROFILES)) {
      expect(Object.keys(p).filter((k) => /chat|audio|handoff|takeover|temperature|urgency/i.test(k))).toEqual([]);
    }
  });
});

describe('resolveProfile', () => {
  it('is real estate for every tenant today', () => {
    expect(resolveProfile({ clientKey: 'anything' })).toBe(realEstate);
    expect(resolveProfile(null)).toBe(realEstate);
    expect(resolveProfile(undefined)).toBe(realEstate);
  });

  it('resolves the clinic from the vertical the API sends', () => {
    expect(resolveProfile({ clientKey: 'x', vertical: 'clinic' })).toBe(clinic);
    expect(resolveProfile({ clientKey: 'x' }, 'clinic')).toBe(clinic);
  });

  it('prefers an override, then a vertical from the API', () => {
    expect(resolveProfile({ clientKey: 'x', vertical: 'hospitality' })).toBe(hospitality);
    expect(resolveProfile({ clientKey: 'x', vertical: 'hospitality' }, 'real_estate')).toBe(realEstate);
    expect(resolveProfile({ clientKey: 'x' }, 'hospitality')).toBe(hospitality);
  });

  it('ignores a value it does not know instead of failing', () => {
    expect(resolveProfile({ clientKey: 'x', vertical: 'dentistry' }, 'banking')).toBe(realEstate);
    expect(resolveProfile({ clientKey: 'toString', vertical: '__proto__' })).toBe(realEstate);
  });
});

describe('words', () => {
  it('reads exactly as the plain sentence for real estate', () => {
    expect(words('Routing only ever assigns {leads} to someone listed here.', realEstate.terms)).toBe('Routing only ever assigns leads to someone listed here.');
    expect(words('Add {person}', realEstate.terms)).toBe('Add salesperson');
    expect(words('Routing scores a match against the {lead}\'s answer.', realEstate.terms)).toBe("Routing scores a match against the lead's answer.");
    expect(words('{Categories} and {categories}', realEstate.terms)).toBe('Unit types and unit types');
  });

  it('swaps in the hospitality nouns', () => {
    expect(words('Routing only ever assigns {leads} to someone listed here.', hospitality.terms)).toBe('Routing only ever assigns guests to someone listed here.');
    expect(words('Add {person} and a {place}', hospitality.terms)).toBe('Add host and a venue');
    expect(words('{Categories}', hospitality.terms)).toBe('Zones');
  });

  it('leaves an unknown token alone', () => {
    expect(words('Keep {this} as it is', hospitality.terms)).toBe('Keep {this} as it is');
  });
});
