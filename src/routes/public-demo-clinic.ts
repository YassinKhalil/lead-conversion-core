import { readFileSync } from 'node:fs';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getEnv } from '../config/env.js';
import { generateAppointmentSlots } from '../domain/appointment-slots.js';
import { scoreClinicLead } from '../domain/clinic-scoring.js';
import { compileConfig, type CompileInput } from '../domain/compiler.js';
import { APPOINTMENT_SLOT_STAGE, evaluateConversation } from '../domain/engine.js';
import { localized } from '../domain/language.js';
import { renderTemplate } from '../domain/render.js';
import type { CompiledConfig, ConversationState, Language } from '../domain/types.js';
import {
  DEMO_MAX_TEXT_LENGTH, DEMO_MAX_TURNS, sealDemoState, unsealDemoState, type DemoSignedState,
} from './demo-shared.js';
import { publicRateLimit } from './public-ingress.js';

/**
 * Website "try it now" demo for dental clinics. Reached same-origin as
 * clinic.kadensio.com/api/demo/turn, proxied by Caddy to this path.
 *
 * Stateless like the other demos: only the pure engine and scorer run, so a
 * demo chat cannot create a lead, book a real slot or message anyone. The
 * sample clinic offers fixed hours, closed on Fridays; live, slots come from the clinic's
 * own hours and blackout days. The wording is the production seed's.
 */
export const CLINIC_DEMO_ROUTE_PATH = '/public/demo/clinic/turn';

const CLINIC = { name: 'Demo Dental Clinic', timezone: 'Africa/Cairo' };
const SLOT_PREFIX = 'demo-slot:';

const bodySchema = z
  .object({
    state: z.string().max(8_000).optional(),
    text: z.string().max(DEMO_MAX_TEXT_LENGTH).optional(),
    optionId: z.string().max(100).optional(),
  })
  .strict();

let cachedConfig: CompiledConfig | undefined;
function demoConfig(): CompiledConfig {
  if (!cachedConfig) {
    const seed = JSON.parse(readFileSync('./config/seed-clinic.json', 'utf8')) as CompileInput;
    cachedConfig = compileConfig(seed);
  }
  return cachedConfig;
}

function initialState(config: CompiledConfig): ConversationState {
  return {
    clientRecordId: 'recDEMO000000003',
    clientId: 'clinic_web_demo',
    phoneNormalized: '+10000000000',
    leadRecordId: 'recDEMOLEAD00003',
    leadId: 'lead_web_demo',
    leadName: '',
    companyName: CLINIC.name,
    projectName: CLINIC.name,
    projectRecordId: 'recDEMOCLINIC0001',
    preferredLanguage: '',
    currentStage: '',
    currentQuestionKey: '',
    answers: {},
    retryCount: 0,
    status: 'contacted',
    humanTakeover: false,
    stopFollowUp: false,
    closedStatus: '',
    appointmentStatus: '',
    assignedSalespersonRecordId: '',
    assignedSalespersonPhone: '',
    lastInboundAt: new Date().toISOString(),
    conversationWindowExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    conversationEngine: 'legacy',
    stateAuthority: 'legacy',
    configVersion: config.version,
    stateVersion: 0,
  };
}

/** The next weekday slots of the sample clinic. Fixed, so the same set can be re-derived to validate a tap. */
function sampleSlots(now = new Date()) {
  return generateAppointmentSlots({
    config: { timezone: CLINIC.timezone, appointmentHours: ['10:00', '13:00', '17:00'], blackoutDays: ['Friday'] },
    now,
    days: 2,
    maxSlots: 6,
  });
}

const NEXT_STEP: Record<'hot' | 'warm' | 'cold', string> = {
  hot: 'Call today. This patient wants to be seen soon and has asked for a slot.',
  warm: 'Confirm the appointment within the day and check the cover or payment.',
  cold: 'Offer the next free slots. There is no rush on this one.',
};

const optionLabel = (config: CompiledConfig, questionKey: string, value: string): string => {
  const option = config.questions.find((q) => q.questionKey === questionKey)?.options.find((o) => o.value === value);
  return option ? localized(option.labels, 'English') : value;
};

function buildSummary(config: CompiledConfig, state: ConversationState, slotLabel: string) {
  const answers = state.answers;
  const score = scoreClinicLead({ leadStatus: 'qualified', currentStage: 'qualified', answers });
  return {
    temperature: score.temperature,
    score: score.score,
    clinic: CLINIC.name,
    language: state.preferredLanguage || 'English',
    nextStep: NEXT_STEP[score.temperature],
    appointment: slotLabel,
    answers: {
      service: optionLabel(config, 'q_service', answers.q_service || ''),
      patientType: optionLabel(config, 'q_patient_type', answers.q_patient_type || ''),
      urgency: optionLabel(config, 'q_urgency', answers.q_urgency || ''),
      timePreference: optionLabel(config, 'q_time_pref', answers.q_time_pref || ''),
      coverage: optionLabel(config, 'q_coverage', answers.q_coverage || ''),
    },
    factors: score.factors
      .filter((factor) => factor.points > 0)
      .map(({ key, points, value, reason }) => ({ key, points, value, reason })),
  };
}

function messageText(config: CompiledConfig, key: string, language: Language, extra: Record<string, string> = {}): string {
  const texts = config.messages[key]?.texts;
  return texts ? renderTemplate(localized(texts, language), { lead_name: '', company_name: CLINIC.name, project_name: CLINIC.name }, language, extra) : '';
}

export async function clinicDemoRoutes(app: FastifyInstance): Promise<void> {
  app.post(CLINIC_DEMO_ROUTE_PATH, { config: publicRateLimit() }, async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    if (!getEnv().DEMO_CHAT_ENABLED) {
      reply.code(503);
      return { ok: false, error: 'demo_disabled' };
    }
    const parsed = bodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      reply.code(400);
      return { ok: false, error: 'invalid_demo_request' };
    }
    const { state: token, text, optionId } = parsed.data;
    const config = demoConfig();

    let current: DemoSignedState;
    let input: { text?: string; optionId?: string };
    if (!token) {
      current = { s: initialState(config), turns: 0 };
      input = { text: 'hello' };
    } else {
      const opened = unsealDemoState(token);
      if (!opened) {
        reply.code(400);
        return { ok: false, error: 'invalid_demo_state' };
      }
      current = opened;
      if (current.turns >= DEMO_MAX_TURNS) {
        reply.code(429);
        return { ok: false, error: 'demo_turn_limit' };
      }
      if (text === undefined && optionId === undefined) {
        reply.code(400);
        return { ok: false, error: 'invalid_demo_request' };
      }
      input = {
        ...(text !== undefined ? { text } : {}),
        ...(optionId !== undefined ? { optionId } : {}),
      };
    }

    const language: Language = current.s.preferredLanguage || 'English';
    const slotOptions = (): Array<{ id: string; label: string }> =>
      sampleSlots().map((slot) => ({ id: `${SLOT_PREFIX}${slot.startsAt}`, label: localized(slot.labels, language) }));

    // The patient is looking at the slot list: a tap books it, anything else shows the list again.
    if (current.s.currentStage === APPOINTMENT_SLOT_STAGE) {
      const picked = input.optionId?.startsWith(SLOT_PREFIX)
        ? sampleSlots().find((slot) => `${SLOT_PREFIX}${slot.startsAt}` === input.optionId)
        : undefined;
      const next: DemoSignedState = { s: current.s, turns: current.turns + 1 };
      if (!picked) {
        return {
          ok: true,
          state: sealDemoState(next),
          reply: { text: messageText(config, 'appointment_slot_offer', language), kind: 'list', options: slotOptions() },
          done: false,
        };
      }
      const label = localized(picked.labels, language);
      const booked: ConversationState = { ...current.s, currentStage: 'qualified', status: 'qualified', appointmentStatus: 'booked' };
      return {
        ok: true,
        state: sealDemoState({ s: booked, turns: current.turns + 1 }),
        reply: { text: messageText(config, 'appointment_booked_ack', language, { slot: label }), kind: 'text', options: [] },
        done: true,
        summary: buildSummary(config, booked, localized(picked.labels, 'English')),
      };
    }

    const decision = evaluateConversation({
      state: current.s,
      config,
      ...(input.text !== undefined ? { messageText: input.text } : {}),
      ...(input.optionId !== undefined ? { messageOptionId: input.optionId } : {}),
    });

    const completed = decision.outboxEvents.some((event) => event.eventType === 'qualification_completed');
    const offersSlots = decision.replyKey === 'appointment_slot_offer';
    const paused = decision.action === 'pause';
    const next: DemoSignedState = { s: decision.nextState, turns: current.turns + 1 };
    const finished = (completed && !offersSlots) || paused;
    const nextLanguage: Language = decision.nextState.preferredLanguage || language;

    return {
      ok: true,
      state: sealDemoState(next),
      reply: offersSlots
        ? {
            text: messageText(config, 'appointment_slot_offer', nextLanguage),
            kind: 'list',
            options: sampleSlots().map((slot) => ({ id: `${SLOT_PREFIX}${slot.startsAt}`, label: localized(slot.labels, nextLanguage) })),
          }
        : {
            text: decision.text,
            kind: finished ? 'text' : decision.messageKind,
            options: finished ? [] : (decision.interactiveOptions ?? []),
          },
      done: finished,
      ...(completed && !offersSlots && !paused ? { summary: buildSummary(config, decision.nextState, '') } : {}),
    };
  });
}
