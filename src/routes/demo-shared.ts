import { createHmac, timingSafeEqual } from 'node:crypto';
import { getEnv } from '../config/env.js';
import type { ConversationState } from '../domain/types.js';

/**
 * Helpers shared by the website demo routes. Pure: no database, no provider.
 * The conversation state travels with the browser, HMAC-signed so it cannot be
 * edited into something the engine never produced.
 */
export const DEMO_MAX_TURNS = 30;
export const DEMO_MAX_TEXT_LENGTH = 300;

export interface DemoSignedState {
  s: ConversationState;
  turns: number;
}

function signingKey(): Buffer {
  return createHmac('sha256', getEnv().EDGE_INTERNAL_SECRET).update('kadensio-demo-state-v1').digest();
}

export function sealDemoState(payload: DemoSignedState): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const mac = createHmac('sha256', signingKey()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export function unsealDemoState(token: string): DemoSignedState | null {
  const [body, mac, extra] = token.split('.');
  if (!body || !mac || extra !== undefined) return null;
  const expected = createHmac('sha256', signingKey()).update(body).digest();
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as DemoSignedState;
  } catch {
    return null;
  }
}
