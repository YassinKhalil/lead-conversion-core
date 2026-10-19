import { readFileSync } from 'node:fs';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getEnv } from '../config/env.js';
import { compileConfig, type CompileInput } from '../domain/compiler.js';
import { evaluateConversation } from '../domain/engine.js';
import { describeDate } from '../domain/hospitality-format.js';
import { calendarDateIn, readDateShift } from '../domain/hospitality-normalization.js';
import { localized } from '../domain/language.js';
import { renderTemplate } from '../domain/render.js';
import type { CompiledConfig, ConversationState, Language } from '../domain/types.js';
import {
  DEMO_MAX_TEXT_LENGTH, DEMO_MAX_TURNS, sealDemoState, unsealDemoState, type DemoSignedState,
} from './demo-shared.js';
import { publicRateLimit } from './public-ingress.js';

/**
 * Website "try it now" demo for hospitality. Reached same-origin as
 * hospitality.kadensio.com/api/demo/turn, proxied by Caddy to this path.
 *
 * Stateless like the real-estate demo: only the pure engine runs, so a demo
 * chat cannot create a reservation, touch a floor plan or message a guest.
 * The sample venue below stands in for the tenant's venue and floor plan; the
 * reply wording is the production reservation message from the seed.
 */
export const HOSPITALITY_DEMO_ROUTE_PATH = '/public/demo/hospitality/turn';

const TIMEZONE = 'Europe/Madrid';
const VENUE = { name: 'Cal Demo Gràcia', depositThreshold: 8 };
const SHIFT_LABELS: Record<string, Record<'English' | 'Spanish' | 'Catalan', string>> = {
  lunch: { English: 'lunch', Spanish: 'comida', Catalan: 'dinar' },
  dinner: { English: 'dinner', Spanish: 'cena', Catalan: 'sopar' },
};
const SHIFT_ENGLISH: Record<string, string> = { lunch: 'Lunch', dinner: 'Dinner' };

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
    const seed = JSON.parse(readFileSync('./config/seed-hospitality.json', 'utf8')) as CompileInput;
    cachedConfig = compileConfig(seed);
  }
  return cachedConfig;
}

function initialState(config: CompiledConfig): ConversationState {
  return {
    clientRecordId: 'recDEMO000000002',
    clientId: 'venue_web_demo',
    phoneNormalized: '+10000000000',
    leadRecordId: 'recDEMOLEAD00002',
    leadId: 'lead_web_demo',
    leadName: '',
    companyName: VENUE.name,
    projectName: VENUE.name,
    projectRecordId: 'recDEMOVENUE0001',
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

function shiftLabel(shift: string, language: Language): string {
  const labels = SHIFT_LABELS[shift];
  return labels ? labels[language === 'Spanish' || language === 'Catalan' ? language : 'English'] : shift;
}

/**
 * What the venue sees and what the guest is told. The sample venue seats any
 * party on the requested day; groups past the deposit threshold are routed to
 * the venue to confirm, as in production.
 */
function buildReservation(config: CompiledConfig, state: ConversationState) {
  const language: Language = state.preferredLanguage || 'English';
  const answers = state.answers;
  const partySize = Number.parseInt(answers.q_party_size || '', 10);
  const dateShift = readDateShift(answers.q_date_shift || '');
  if (!dateShift || !Number.isInteger(partySize)) return null;

  const zoneQuestion = config.questions.find((q) => q.questionKey === 'q_zone');
  const zoneOption = zoneQuestion?.options.find((o) => o.value === answers.q_zone);
  const zone = zoneOption ? localized(zoneOption.labels, language) : answers.q_zone || '';
  const zoneEnglish = zoneOption ? localized(zoneOption.labels, 'English') : zone;

  const needsVenue = partySize >= VENUE.depositThreshold;
  const key = needsVenue ? 'reservation_requested' : 'reservation_confirmed';
  const template = config.messages[key]?.texts;
  const guestMessage = template
    ? renderTemplate(
        localized(template, language),
        { lead_name: '', company_name: VENUE.name, project_name: VENUE.name },
        language,
        {
          party_size: String(partySize),
          date: describeDate(dateShift.date, language),
          shift: shiftLabel(dateShift.shift, language),
          zone,
          // The sample venue has no map page; drop the line rather than invent a link.
          maps_url: 'maps.example/cal-demo',
        },
      ).replace(/\n?📍 maps\.example\/cal-demo/, '')
    : '';

  return {
    status: needsVenue ? 'requested' : 'confirmed',
    venue: VENUE.name,
    language,
    reservation: {
      partySize,
      date: describeDate(dateShift.date, 'English'),
      shift: SHIFT_ENGLISH[dateShift.shift] ?? dateShift.shift,
      zone: zoneEnglish,
    },
    deposit: needsVenue ? 'Possible. The venue confirms groups of ' + VENUE.depositThreshold + ' or more personally.' : 'Not required for a party this size.',
    nextStep: needsVenue
      ? 'The host replies to the guest to confirm the table and any deposit.'
      : 'Table held on the floor plan. A reminder goes to the guest the day before.',
    guestMessage,
  };
}

export async function hospitalityDemoRoutes(app: FastifyInstance): Promise<void> {
  app.post(HOSPITALITY_DEMO_ROUTE_PATH, { config: publicRateLimit() }, async (
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

    const decision = evaluateConversation({
      state: current.s,
      config,
      today: calendarDateIn(TIMEZONE, new Date()),
      ...(input.text !== undefined ? { messageText: input.text } : {}),
      ...(input.optionId !== undefined ? { messageOptionId: input.optionId } : {}),
    });

    const completed = decision.outboxEvents.some((event) => event.eventType === 'qualification_completed');
    const paused = decision.action === 'pause';
    const summary = completed ? buildReservation(config, decision.nextState) : null;
    const next: DemoSignedState = { s: decision.nextState, turns: current.turns + 1 };

    return {
      ok: true,
      state: sealDemoState(next),
      reply: {
        // On completion the guest sees the booking message, as in production.
        text: summary?.guestMessage || decision.text,
        kind: completed ? 'text' : decision.messageKind,
        options: completed ? [] : (decision.interactiveOptions ?? []),
      },
      done: completed || paused,
      ...(summary ? { summary } : {}),
    };
  });
}
