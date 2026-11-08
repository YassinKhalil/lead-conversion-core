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
    temperature: 'hot' | 'warm' | 'cold';
    score: number;
    appointment: string;
    answers: { service: string; patientType: string; urgency: string; timePreference: string; coverage: string };
    factors: Array<{ key: string; points: number }>;
  };
}

const URL = '/public/demo/clinic/turn';

async function turn(app: App, payload: Record<string, unknown>): Promise<Turn> {
  const response = await app.inject({ method: 'POST', url: URL, payload });
  expect(response.statusCode).toBe(200);
  return response.json() as Turn;
}

/** Runs the questions up to (and including) the last answer; returns the turn that follows it. */
async function answerAll(app: App, language: RegExp, bookNow: RegExp): Promise<{ current: Turn; pick: (re: RegExp) => Promise<void> }> {
  let current = await turn(app, {});
  const pick = async (re: RegExp) => {
    const option = current.reply.options.find((o) => re.test(o.label));
    expect(option, `no option ${re} in ${JSON.stringify(current.reply.options)}`).toBeDefined();
    current = await turn(app, { state: current.state, optionId: option!.id });
  };
  await pick(language);
  await pick(/^(yes|أيوه)$/i);
  await pick(/cleaning|تنضيف/i);
  await pick(/new patient|مريض جديد/i);
  await pick(/as soon as possible|أقرب/i);
  await pick(/morning|الصبح/i);
  await pick(/insurance|تأمين/i);
  await pick(bookNow);
  return { get current() { return current; }, pick } as unknown as { current: Turn; pick: (re: RegExp) => Promise<void> };
}

describe('clinic demo route', () => {
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
    expect(first.reply.options.map((o) => o.id)).toEqual(['lang_en', 'lang_ar']);
    await app.close();
    vi.resetModules();
  });

  it('offers sample slots, books the one that is tapped, and shows the front desk the result', async () => {
    const app = await buildAppWithEnv({ DEMO_CHAT_ENABLED: 'true' });
    const flow = await answerAll(app, /english/i, /show times|أيوه، وريني/i);
    const offer = flow.current;
    expect(offer.done).toBe(false);
    expect(offer.reply.kind).toBe('list');
    expect(offer.reply.options.length).toBeGreaterThan(0);
    expect(offer.reply.options.every((o) => o.id.startsWith('demo-slot:') && o.label.length <= 24)).toBe(true);

    const booked = await turn(app, { state: offer.state, optionId: offer.reply.options[0]!.id });
    expect(booked.done).toBe(true);
    expect(booked.reply.text).toMatch(/^Booked ✅ Your appointment is on /);
    expect(booked.reply.text).not.toMatch(/\{\{/);
    expect(booked.summary).toMatchObject({
      temperature: 'hot',
      score: 100,
      answers: { service: 'Cleaning', patientType: 'New patient', urgency: 'As soon as possible', timePreference: 'Morning', coverage: 'Insurance' },
    });
    expect(booked.summary?.appointment).toBe(offer.reply.options[0]!.label);
    await app.close();
    vi.resetModules();
  });

  it('shows the slots in Arabic, never on a Friday, when the patient picks Arabic', async () => {
    const app = await buildAppWithEnv({ DEMO_CHAT_ENABLED: 'true' });
    const flow = await answerAll(app, /عرب|arab/i, /أيوه، وريني/i);
    expect(flow.current.reply.text).toBe('تمام 🙌 اختار الميعاد المناسب ليك.');
    expect(flow.current.reply.options.every((o) => !o.label.startsWith('الجمعة'))).toBe(true);
    expect(flow.current.reply.options[0]?.label).toMatch(/^(الأحد|الإثنين|الثلاثاء|الأربعاء|الخميس|السبت) /);
    await app.close();
    vi.resetModules();
  });

  it('re-shows the slots when the reply is not a slot, and refuses a slot it did not offer', async () => {
    const app = await buildAppWithEnv({ DEMO_CHAT_ENABLED: 'true' });
    const offer = (await answerAll(app, /english/i, /show times|أيوه، وريني/i)).current;
    const again = await turn(app, { state: offer.state, text: 'whenever' });
    expect(again.done).toBe(false);
    expect(again.reply.options.length).toBe(offer.reply.options.length);
    const forged = await turn(app, { state: offer.state, optionId: 'demo-slot:2030-01-01T00:00:00.000Z' });
    expect(forged.done).toBe(false);
    await app.close();
    vi.resetModules();
  });

  it('closes with a call-back and no appointment when the patient wants a call', async () => {
    const app = await buildAppWithEnv({ DEMO_CHAT_ENABLED: 'true' });
    const last = (await answerAll(app, /english/i, /call me|كلموني/i)).current;
    expect(last.done).toBe(true);
    expect(last.reply.text).toMatch(/team will contact you/);
    expect(last.summary?.appointment).toBe('');
    await app.close();
    vi.resetModules();
  });

  it('rejects tampered state', async () => {
    const app = await buildAppWithEnv({ DEMO_CHAT_ENABLED: 'true' });
    const first = await turn(app, {});
    const [body, mac] = first.state.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body!, 'base64url').toString()), turns: 0 })).toString('base64url');
    const response = await app.inject({ method: 'POST', url: URL, payload: { state: `${forged}.${mac}`, text: 'hi' } });
    expect(response.statusCode).toBe(400);
    await app.close();
    vi.resetModules();
  });
});
