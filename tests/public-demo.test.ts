import { describe, expect, it, vi } from 'vitest';

const baseEnv = {
  NODE_ENV: 'test',
  // Dead port: any attempt by the demo route to reach Postgres would fail the run.
  DATABASE_URL: 'postgresql://127.0.0.1:1/disabled_demo_test',
  EDGE_SHARED_SECRET: 'test_shared_secret_123456',
  EDGE_INTERNAL_SECRET: 'test_internal_secret_123456',
  RUNTIME_WORKER_ENABLED: 'false',
  META_STATUS_PROCESSOR_ENABLED: 'false',
  DIRECT_META_WEBHOOK_ENABLED: 'false',
  DIRECT_LEAD_INGRESS_ENABLED: 'false',
  META_APP_SECRET: 'test_meta_app_secret_123456',
  META_WEBHOOK_VERIFY_TOKEN: 'test_meta_verify_token_123456',
};

async function buildAppWithEnv(overrides: Record<string, string> = {}) {
  vi.resetModules();
  Object.assign(process.env, baseEnv, overrides);
  const { buildApp } = await import('../src/app.js');
  return buildApp();
}

type App = Awaited<ReturnType<typeof buildAppWithEnv>>;
interface Turn {
  ok: boolean;
  state: string;
  reply: { text: string; kind: string; options: Array<{ id: string; label: string }> };
  done: boolean;
  summary?: {
    temperature: 'cold' | 'warm' | 'hot';
    score: number;
    answers: Record<string, string>;
    factors: Array<{ key: string; points: number }>;
  };
}

async function turn(app: App, payload: Record<string, unknown>): Promise<Turn> {
  const response = await app.inject({ method: 'POST', url: '/public/demo/turn', payload });
  expect(response.statusCode).toBe(200);
  return response.json() as Turn;
}

/** Answers every question like a buyer would: pick the option whose label matches, else type text. */
async function runConversation(app: App, choices: Array<RegExp | string>): Promise<Turn> {
  let current = await turn(app, {});
  for (const choice of choices) {
    const payload: Record<string, unknown> = { state: current.state };
    if (typeof choice === 'string') {
      payload.text = choice;
    } else {
      const option = current.reply.options.find((o) => choice.test(o.label));
      expect(option, `no option matching ${choice} in ${JSON.stringify(current.reply.options)}`).toBeDefined();
      payload.optionId = option!.id;
    }
    current = await turn(app, payload);
  }
  return current;
}

describe('public demo route', () => {
  it('fails closed until DEMO_CHAT_ENABLED is true', async () => {
    const app = await buildAppWithEnv({ DEMO_CHAT_ENABLED: 'false' });
    const response = await app.inject({ method: 'POST', url: '/public/demo/turn', payload: {} });
    expect(response.statusCode).toBe(503);
    await app.close();
    vi.resetModules();
  });

  it('opens with the permission question and never touches the database', async () => {
    const app = await buildAppWithEnv({ DEMO_CHAT_ENABLED: 'true' });
    const first = await turn(app, {});
    expect(first.done).toBe(false);
    expect(first.reply.text).toMatch(/quick questions/i);
    expect(first.reply.options.length).toBeGreaterThan(0);
    await app.close();
    vi.resetModules();
  });

  it('scores a ready buyer as hot with the answers an agent would see', async () => {
    const app = await buildAppWithEnv({ DEMO_CHAT_ENABLED: 'true' });
    const last = await runConversation(app, [
      /yes/i, 'New Cairo', /villa/i, /over 10m/i, /cash/i, /as soon/i, /investment/i, /yes/i,
    ]);
    expect(last.done).toBe(true);
    expect(last.summary?.temperature).toBe('hot');
    expect(last.summary?.answers.location).toBe('New Cairo');
    expect(last.summary?.answers.unitType).toBe('Villa');
    expect(last.reply.text).not.toBe('');
    await app.close();
    vi.resetModules();
  });

  it('does not score a browsing buyer as hot', async () => {
    const app = await buildAppWithEnv({ DEMO_CHAT_ENABLED: 'true' });
    const last = await runConversation(app, [
      /yes/i, 'Sheikh Zayed', /apartment/i, /under 3m/i, /installments/i, '100000', /exploring/i, /to live/i, /not now/i,
    ]);
    expect(last.summary?.temperature).not.toBe('hot');
    expect(last.summary!.score).toBeLessThan(75);
    await app.close();
    vi.resetModules();
  });

  it('rejects tampered state', async () => {
    const app = await buildAppWithEnv({ DEMO_CHAT_ENABLED: 'true' });
    const first = await turn(app, {});
    const [body, mac] = first.state.split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(body!, 'base64url').toString()), turns: 0 }),
    ).toString('base64url');
    const response = await app.inject({
      method: 'POST',
      url: '/public/demo/turn',
      payload: { state: `${forged}.${mac}`, text: 'hi' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('invalid_demo_state');
    await app.close();
    vi.resetModules();
  });

  it('rejects oversized text and unknown fields', async () => {
    const app = await buildAppWithEnv({ DEMO_CHAT_ENABLED: 'true' });
    const first = await turn(app, {});
    const big = await app.inject({
      method: 'POST', url: '/public/demo/turn', payload: { state: first.state, text: 'x'.repeat(301) },
    });
    expect(big.statusCode).toBe(400);
    const extra = await app.inject({
      method: 'POST', url: '/public/demo/turn', payload: { state: first.state, text: 'a', phone: '1' },
    });
    expect(extra.statusCode).toBe(400);
    await app.close();
    vi.resetModules();
  });
});
