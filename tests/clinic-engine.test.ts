import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { scoreClinicLead, CLINIC_SCORING_VERSION } from '../src/domain/clinic-scoring.js';
import { compileConfig, type CompileInput } from '../src/domain/compiler.js';
import { evaluateConversation } from '../src/domain/engine.js';
import { generateAppointmentSlots } from '../src/domain/appointment-slots.js';
import type { ConversationState } from '../src/domain/types.js';

const seed = JSON.parse(readFileSync(new URL('../config/seed-clinic.json', import.meta.url), 'utf8')) as CompileInput;
const config = compileConfig({ ...seed, now: '2026-10-05T00:00:00.000Z' });

function fresh(): ConversationState {
  return {
    clientRecordId: 'recCLIENT00000004', clientId: 'clinic_demo', phoneNormalized: '+34600000000',
    leadRecordId: 'recLEAD000000004', leadId: 'lead_demo', leadName: 'Marta', companyName: 'Clínica Demo',
    projectName: 'Clínica Demo Eixample', projectRecordId: 'recPROJECT000004', preferredLanguage: '',
    currentStage: '', currentQuestionKey: '', answers: {}, retryCount: 0, status: 'in_qualification',
    humanTakeover: false, stopFollowUp: false, closedStatus: '', appointmentStatus: '',
    assignedSalespersonRecordId: '', assignedSalespersonPhone: '',
    lastInboundAt: '2026-10-05T10:00:00.000Z', conversationWindowExpiresAt: '2026-10-06T10:00:00.000Z',
    conversationEngine: 'edge', stateAuthority: 'edge', configVersion: config.version, stateVersion: 0,
  };
}

function run(turns: Array<{ text?: string; option?: string }>) {
  let state = fresh();
  const decisions = [];
  for (const turn of turns) {
    const decision = evaluateConversation({
      state, config,
      ...(turn.text !== undefined ? { messageText: turn.text } : {}),
      ...(turn.option !== undefined ? { messageOptionId: turn.option } : {}),
    });
    decisions.push(decision);
    state = decision.nextState;
  }
  return decisions;
}

const optionId = (key: string, value: string) =>
  config.questions.find((q) => q.questionKey === key)!.options.find((o) => o.value === value)!.id;

const FLOW = (book: 'yes' | 'no', lang = 'lang_en') => [
  { text: 'hello' }, { option: lang }, { option: optionId('q_permission', 'yes') },
  { option: optionId('q_service', 'cleaning') }, { option: optionId('q_patient_type', 'new') },
  { option: optionId('q_urgency', 'asap') }, { option: optionId('q_time_pref', 'morning') },
  { option: optionId('q_coverage', 'insurance') }, { option: optionId('q_book_now', book) },
];

describe('clinic conversation', () => {
  it('compiles as the clinic industry in English and Arabic', () => {
    expect(config.industry).toBe('clinic');
    expect(config.languages).toEqual(['English', 'Arabic']);
    expect(config.questions.map((q) => q.questionKey)).toEqual([
      'q_permission', 'q_service', 'q_patient_type', 'q_urgency', 'q_time_pref', 'q_coverage', 'q_book_now',
    ]);
  });

  it('asks the dental booking questions in order, in English, and names the emergency route', () => {
    const d = run(FLOW('yes'));
    expect(d[1]?.text).toContain('local emergency number');
    expect(d[2]?.text).toBe('What is the visit for?');
    expect(d[2]?.interactiveOptions?.map((o) => o.label)).toEqual([
      'Consultation', 'Check-up', 'Cleaning', 'Filling', 'Whitening', 'Braces', 'Implants', 'Something else',
    ]);
    expect(d[4]?.text).toBe('How soon would you like to be seen?');
  });

  it('asks the same questions in Arabic', () => {
    const d = run(FLOW('yes', 'lang_ar'));
    expect(d[1]?.text).toContain('الطوارئ');
    expect(d[2]?.text).toBe('الزيارة لإيه؟');
    expect(d[2]?.interactiveOptions?.map((o) => o.label)).toContain('تنضيف أسنان');
    expect(d[4]?.text).toBe('عايز الميعاد إمتى؟');
    expect(d[8]?.replyKey).toBe('appointment_slot_offer');
  });

  it('keeps every WhatsApp title inside Meta limits', () => {
    for (const question of config.questions) {
      const limit = question.type === 'Buttons' ? 20 : 24;
      for (const option of question.options) {
        for (const label of Object.values(option.labels)) if (label) expect(label.length, label).toBeLessThanOrEqual(limit);
      }
      if (question.type === 'Buttons') expect(question.options.length).toBeLessThanOrEqual(3);
      if (question.type === 'List') expect(question.options.length).toBeLessThanOrEqual(10);
    }
  });

  it('offers appointment slots when the patient asks to see times', () => {
    const d = run(FLOW('yes'));
    const last = d[8]!;
    expect(last.replyKey).toBe('appointment_slot_offer');
    expect(last.nextState.currentStage).toBe('awaiting_appointment_slot');
    const completed = last.outboxEvents.find((e) => e.eventType === 'qualification_completed');
    expect(completed?.payload.qualification).toMatchObject({
      service: 'cleaning', patient_type: 'new', urgency: 'asap', time_preference: 'morning', coverage: 'insurance', book_now: 'yes',
    });
    expect(last.outboxEvents.some((e) => e.eventType === 'appointment_slot_offer_requested')).toBe(true);
  });

  it('closes with a call-back message when the patient does not want slots now', () => {
    const last = run(FLOW('no'))[8]!;
    expect(last.action).toBe('complete');
    expect(last.text).toBe('Thank you, Marta! Our team will contact you shortly to arrange your appointment.');
  });

  it('pauses when the patient says not now', () => {
    const d = run([{ text: 'hello' }, { option: 'lang_en' }, { option: optionId('q_permission', 'no') }]);
    expect(d[2]?.action).toBe('pause');
  });

  it('labels offered slots in English and Arabic, and skips a closed Friday', () => {
    const slots = generateAppointmentSlots({
      config: { timezone: 'Africa/Cairo', appointmentHours: ['10:00'], blackoutDays: ['Friday'] },
      now: new Date('2026-10-14T10:00:00Z'), days: 3, maxSlots: 3,
    });
    expect(slots.map((s) => s.labels.English)).toEqual(['Thursday 15 Oct 10:00', 'Saturday 17 Oct 10:00', 'Sunday 18 Oct 10:00']);
    expect(slots[0]?.labels.Arabic).toMatch(/^الخميس 15 /);
  });
});

describe('clinic scoring', () => {
  const base = { leadStatus: 'qualified', currentStage: 'qualified' };
  const answers = (over: Record<string, string>) => ({
    q_service: 'dental', q_patient_type: 'new', q_urgency: 'asap', q_time_pref: 'morning', q_coverage: 'insurance', q_book_now: 'yes', ...over,
  });

  it('puts an urgent new patient who asked for a slot at the top', () => {
    const result = scoreClinicLead({ ...base, answers: answers({}) });
    expect(result.scoringVersion).toBe(CLINIC_SCORING_VERSION);
    expect(result.score).toBe(100);
    expect(result.temperature).toBe('hot');
    expect(result.missingAnswers).toEqual([]);
  });

  it('ranks urgency above everything else', () => {
    const urgent = scoreClinicLead({ ...base, answers: answers({ q_patient_type: 'existing', q_book_now: 'no' }) });
    const flexible = scoreClinicLead({ ...base, answers: answers({ q_urgency: 'flexible' }) });
    expect(urgent.temperature).toBe('hot');
    expect(flexible.temperature).toBe('warm');
    expect(urgent.score).toBeGreaterThan(flexible.score);
  });

  it('is cold for a flexible existing patient who wants a call', () => {
    const result = scoreClinicLead({ ...base, answers: answers({ q_urgency: 'flexible', q_patient_type: 'existing', q_book_now: 'no', q_coverage: 'unsure' }) });
    expect(result.temperature).toBe('cold');
  });

  it('is deterministic and reports what is missing', () => {
    const input = { ...base, answers: { q_urgency: 'this_week' } };
    expect(scoreClinicLead(input).inputHash).toBe(scoreClinicLead(input).inputHash);
    expect(scoreClinicLead(input).missingAnswers).toContain('q_service');
  });
});
