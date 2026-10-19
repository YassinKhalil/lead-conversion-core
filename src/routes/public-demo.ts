import { readFileSync } from 'node:fs';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getEnv } from '../config/env.js';
import { compileConfig, type CompileInput } from '../domain/compiler.js';
import { evaluateConversation } from '../domain/engine.js';
import { scoreRealEstateLead } from '../domain/lead-scoring.js';
import type { CompiledConfig, ConversationState } from '../domain/types.js';
import { DEMO_MAX_TEXT_LENGTH, DEMO_MAX_TURNS, sealDemoState, unsealDemoState, type DemoSignedState } from './demo-shared.js';
import { publicRateLimit } from './public-ingress.js';

/**
 * Website "try it now" demo. Reached same-origin as /api/demo/turn, proxied by
 * Caddy to this path.
 *
 * Stateless by construction: it imports only the pure engine and scorer, never
 * a service, the database, the outbox or a messaging provider, so a demo chat
 * cannot create a lead, notify a salesperson or send a WhatsApp message. The
 * conversation state travels with the browser, HMAC-signed so it cannot be
 * edited into something the engine never produced.
 */
export const DEMO_ROUTE_PATH = '/public/demo/turn';

const CLOSING_TEXT =
  'Perfect, thank you 🙏 Our property consultant will contact you shortly with all the details that suit you.';

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
    const seed = JSON.parse(readFileSync('./config/seed-real-estate.json', 'utf8')) as CompileInput;
    cachedConfig = compileConfig(seed);
  }
  return cachedConfig;
}

function initialState(config: CompiledConfig): ConversationState {
  return {
    clientRecordId: 'recDEMO000000001',
    clientId: 'client_web_demo',
    phoneNormalized: '+10000000000',
    leadRecordId: 'recDEMOLEAD00001',
    leadId: 'lead_web_demo',
    leadName: 'there',
    companyName: 'Demo Realty',
    projectName: 'Palm Heights',
    projectRecordId: 'recDEMOPROJECT01',
    preferredLanguage: 'English',
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

const NEXT_STEP: Record<'hot' | 'warm' | 'cold', string> = {
  hot: 'Call within minutes. This buyer is ready and has a clear budget and timeline.',
  warm: 'Call today and confirm the timeline and budget. Interest is real but not urgent.',
  cold: 'Add to nurture. Follow up with new launches that match their answers.',
};

function buildSummary(answers: Record<string, string>) {
  const score = scoreRealEstateLead({ leadStatus: 'qualified', currentStage: 'qualified', answers });
  return {
    temperature: score.temperature,
    score: score.score,
    nextStep: NEXT_STEP[score.temperature],
    answers: {
      location: answers.q_location || '',
      unitType: answers.q_unit_type || '',
      budgetMin: answers.q_budget_min || '',
      budgetMax: answers.q_budget_max || '',
      paymentPlan: answers.q_payment_plan || '',
      downPayment: answers.q_down_payment || '',
      timeline: answers.q_timeline || '',
      purpose: answers.q_purpose || '',
      siteVisit: answers.q_site_visit || '',
    },
    factors: score.factors
      .filter((factor) => factor.points > 0)
      .map(({ key, points, value, reason }) => ({ key, points, value, reason })),
  };
}

export async function demoRoutes(app: FastifyInstance): Promise<void> {
  app.post(DEMO_ROUTE_PATH, { config: publicRateLimit() }, async (
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
      ...(input.text !== undefined ? { messageText: input.text } : {}),
      ...(input.optionId !== undefined ? { messageOptionId: input.optionId } : {}),
    });

    const completed = decision.outboxEvents.some((event) => event.eventType === 'qualification_completed');
    const paused = decision.action === 'pause';
    const next: DemoSignedState = { s: decision.nextState, turns: current.turns + 1 };

    return {
      ok: true,
      state: sealDemoState(next),
      reply: {
        text: decision.text || (completed ? CLOSING_TEXT : ''),
        kind: completed ? 'text' : decision.messageKind,
        options: completed ? [] : (decision.interactiveOptions ?? []),
      },
      done: completed || paused,
      ...(completed ? { summary: buildSummary(decision.nextState.answers) } : {}),
    };
  });
}
