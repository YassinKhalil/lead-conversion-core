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
    status: 'confirmed' | 'requested';
    reservation: { partySize: number; date: string; shift: string; zone: string };
    guestMessage: string;
    deposit: string;
  };
}

const URL = '/public/demo/hospitality/turn';

async function turn(app: App, payload: Record<string, unknown>): Promise<Turn> {
  const response = await app.inject({ method: 'POST', url: URL, payload });
  expect(response.statusCode).toBe(200);
  return response.json() as Turn;
}

async function book(app: App, language: RegExp, party: string, when: string, zone: RegExp): Promise<Turn> {
  let current = await turn(app, {});
  const pick = async (re: RegExp) => {
    const option = current.reply.options.find((o) => re.test(o.label));
    expect(option, `no option ${re} in ${JSON.stringify(current.reply.options)}`).toBeDefined();
    current = await turn(app, { state: current.state, optionId: option!.id });
  };
  await pick(language);
  await pick(/^(yes|sí)$/i);
  current = await turn(app, { state: current.state, text: party });
  current = await turn(app, { state: current.state, text: when });
  await pick(zone);
  return current;
}

describe('hospitality demo route', () => {
  it('fails closed until DEMO_CHAT_ENABLED is true', async () => {
    const app = await buildAppWithEnv({ DEMO_CHAT_ENABLED: 'false' });
    const response = await app.inject({ method: 'POST', url: URL, payload: {} });
    expect(response.statusCode).toBe(503);
    await app.close();
    vi.resetModules();
  });

  it('opens with the language buttons', async () => {
    const app = await buildAppWithEnv({ DEMO_CHAT_ENABLED: 'true' });
    const first = await turn(app, {});
    expect(first.reply.options.map((o) => o.id)).toEqual(['lang_es', 'lang_ca', 'lang_en']);
    await app.close();
    vi.resetModules();
  });

  it('books a table in English and shows the host the reservation', async () => {
    const app = await buildAppWithEnv({ DEMO_CHAT_ENABLED: 'true' });
    const last = await book(app, /english/i, 'four of us', 'Friday dinner', /terrace/i);
    expect(last.done).toBe(true);
    expect(last.summary?.status).toBe('confirmed');
    expect(last.summary?.reservation).toMatchObject({ partySize: 4, shift: 'Dinner', zone: 'Terrace' });
    expect(last.reply.text).toMatch(/Booked/);
    expect(last.reply.text).not.toMatch(/\{\{|maps\.example/);
    await app.close();
    vi.resetModules();
  });

  it('answers in Spanish when the guest picks Spanish', async () => {
    const app = await buildAppWithEnv({ DEMO_CHAT_ENABLED: 'true' });
    const last = await book(app, /espa/i, 'somos cuatro', 'el viernes cena', /terraza/i);
    expect(last.summary?.status).toBe('confirmed');
    expect(last.reply.text).toMatch(/Reservado/);
    await app.close();
    vi.resetModules();
  });

  it('routes a large group to the venue instead of confirming', async () => {
    const app = await buildAppWithEnv({ DEMO_CHAT_ENABLED: 'true' });
    const last = await book(app, /english/i, '10 people', 'Saturday lunch', /inside/i);
    expect(last.summary?.status).toBe('requested');
    expect(last.reply.text).toMatch(/venue confirms personally/);
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
    const response = await app.inject({ method: 'POST', url: URL, payload: { state: `${forged}.${mac}`, text: 'hi' } });
    expect(response.statusCode).toBe(400);
    await app.close();
    vi.resetModules();
  });
});
