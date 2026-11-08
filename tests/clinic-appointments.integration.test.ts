import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { describePostgres } from './helpers/postgres.js';

const describePg = describePostgres(['initdb', 'pg_ctl', 'createdb', 'psql']);
const PASSWORD = 'correct-horse-battery-staple-9';

describePg('clinic: vertical, scoring and appointments API, with real PostgreSQL', () => {
  const root = mkdtempSync(join(tmpdir(), 'lead-core-clinic.'));
  const dataDir = join(root, 'data');
  // One port range per test file: 56_500 runtime, 57_500 health, 58_300 hospitality flow, 58_500 config-seed,
  // 59_500 notification-outbox, 60_500 dashboard-api, 61_700 reservations API, 62_500 this file.
  const port = 62_500 + Math.floor(Math.random() * 500);
  const dbName = 'lead_core_clinic_test';
  const databaseUrl = `postgresql://127.0.0.1:${port}/${dbName}`;

  let db: typeof import('../src/db/pool.js');
  let app: Awaited<ReturnType<typeof import('../src/app.js').buildApp>>;
  let users: InstanceType<typeof import('../src/services/dashboard/user-service.js').DashboardUserService>;

  async function seedClinic(key: string) {
    const client = await db.pool.query<{ client_id: string }>(
      `INSERT INTO app.clients (client_key, company_name, timezone, vertical, manager_phone_e164)
       VALUES ($1, $2, 'Europe/Madrid', 'clinic', '+34600000000') RETURNING client_id`,
      [key, `Clinic ${key}`],
    );
    const clientId = client.rows[0]!.client_id;
    const coordinators = await db.pool.query<{ salesperson_id: string }>(
      `INSERT INTO app.salespeople (client_id, name, phone_e164) VALUES ($1, 'Coordinator A', $2), ($1, 'Coordinator B', $3) RETURNING salesperson_id`,
      [clientId, `+3461${key.length}000001`, `+3461${key.length}000002`],
    );
    const [coordA, coordB] = coordinators.rows.map((r) => r.salesperson_id) as [string, string];

    async function appointment(n: number, coordinator: string, answers: Record<string, string>, status = 'booked') {
      const contact = await db.pool.query<{ contact_id: string }>(
        `INSERT INTO app.contacts (client_id, name, phone_e164) VALUES ($1, $2, $3) RETURNING contact_id`,
        [clientId, `Patient ${n}`, `+3460${key.length}00000${n}`],
      );
      const lead = await db.pool.query<{ lead_id: string }>(
        `INSERT INTO app.leads (client_id, contact_id, provider, provider_external_id, source, status, current_stage)
         VALUES ($1, $2, 'whatsapp', $3, 'whatsapp_direct_inbound', 'qualified', 'qualified') RETURNING lead_id`,
        [clientId, contact.rows[0]!.contact_id, `${key}-${n}`],
      );
      const leadId = lead.rows[0]!.lead_id;
      await db.pool.query(`INSERT INTO app.lead_assignments (lead_id, salesperson_id, routing_version) VALUES ($1, $2, 'real_estate_v1')`, [leadId, coordinator]);
      const session = await db.pool.query<{ qualification_session_id: string }>(
        `INSERT INTO app.qualification_sessions (lead_id, status) VALUES ($1, 'completed') RETURNING qualification_session_id`, [leadId]);
      for (const [questionKey, value] of Object.entries(answers)) {
        await db.pool.query(
          `INSERT INTO app.qualification_answers (qualification_session_id, question_key, normalized_value, raw_value, parser_source) VALUES ($1, $2, $3, $3, 'option_id')`,
          [session.rows[0]!.qualification_session_id, questionKey, value]);
      }
      const row = await db.pool.query<{ appointment_id: string }>(
        `INSERT INTO app.appointments (lead_id, status, starts_at, ends_at, timezone, idempotency_key)
         VALUES ($1, $2, now() + ($3::int || ' days')::interval, now() + ($3::int || ' days')::interval + interval '1 hour', 'Europe/Madrid', $4)
         RETURNING appointment_id`,
        [leadId, status, n, `${key}-appt-${n}`]);
      return { leadId, appointmentId: row.rows[0]!.appointment_id };
    }

    const a = await appointment(1, coordA, { q_service: 'dental', q_patient_type: 'new', q_urgency: 'asap' });
    const b = await appointment(2, coordA, { q_service: 'physio', q_patient_type: 'existing', q_urgency: 'flexible' }, 'cancelled');
    const c = await appointment(3, coordB, { q_service: 'general' });
    const emails = { manager: `manager@${key}.test`, coordA: `coorda@${key}.test` };
    await users.create({ clientId, email: emails.manager, password: PASSWORD, name: 'Manager', role: 'manager', salespersonId: null, actorId: 'test' });
    await users.create({ clientId, email: emails.coordA, password: PASSWORD, name: 'Coordinator A', role: 'salesperson', salespersonId: coordA, actorId: 'test' });
    return { clientId, a, b, c, emails };
  }

  async function login(email: string): Promise<Record<string, string>> {
    const response = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: PASSWORD } });
    expect(response.statusCode, response.body).toBe(200);
    return { authorization: `Bearer ${response.json().token as string}` };
  }

  beforeAll(async () => {
    execFileSync('initdb', ['-D', dataDir, '-A', 'trust', '--no-locale'], { stdio: 'ignore' });
    execFileSync('pg_ctl', ['-D', dataDir, '-o', `-p ${port} -k ${root}`, '-l', join(root, 'postgres.log'), 'start'], { stdio: 'ignore' });
    execFileSync('createdb', ['-h', '127.0.0.1', '-p', String(port), dbName], { stdio: 'ignore' });
    const env = { ...process.env, DATABASE_URL: databaseUrl, EDGE_SHARED_SECRET: 'test_shared_secret_123456', EDGE_INTERNAL_SECRET: 'test_internal_secret_123456' };
    execFileSync('npm', ['run', 'migrate'], { env, stdio: 'ignore' });

    vi.resetModules();
    process.env.DATABASE_URL = databaseUrl;
    process.env.EDGE_SHARED_SECRET = env.EDGE_SHARED_SECRET;
    process.env.EDGE_INTERNAL_SECRET = env.EDGE_INTERNAL_SECRET;
    process.env.DASHBOARD_API_ENABLED = 'true';
    process.env.DASHBOARD_SESSION_COOKIE_SECURE = 'false';
    process.env.DASHBOARD_LOGIN_RATE_LIMIT_MAX = '50';

    db = await import('../src/db/pool.js');
    const appModule = await import('../src/app.js');
    const userModule = await import('../src/services/dashboard/user-service.js');
    users = new userModule.DashboardUserService();
    app = await appModule.buildApp();
    await app.ready();
  }, 60_000);

  beforeEach(async () => {
    await db.pool.query(`
      TRUNCATE edge_client_channels, app.sessions, app.users, app.login_attempts, app.notifications, app.lead_assignments, app.messages,
               app.leads, app.contacts, app.projects, app.salespeople, app.conversations, app.clients,
               runtime.outbox_commands, runtime.scheduled_jobs, audit.events
      RESTART IDENTITY CASCADE
    `);
  });

  afterAll(async () => {
    try {
      await app?.close();
      if (db) await db.closePool();
    } finally {
      try {
        execFileSync('pg_ctl', ['-D', dataDir, 'stop'], { stdio: 'ignore' });
      } catch {
        // Cleanup continues even if the cluster is already gone.
      }
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('accepts the clinic vertical, still rejects an unknown one, and tells the dashboard which one it is', async () => {
    const seed = await seedClinic('bcnclinic');
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: await login(seed.emails.manager) });
    expect(me.json().user.vertical).toBe('clinic');
    await expect(
      db.pool.query(`INSERT INTO app.clients (client_key, company_name, vertical) VALUES ('x', 'X', 'dentistry')`),
    ).rejects.toThrow(/clients_vertical_check/);
  });

  it('scores a clinic lead with the clinic rules and a real-estate lead with the real-estate rules', async () => {
    const seed = await seedClinic('bcnclinic');
    const { LeadScoringService } = await import('../src/services/lead-scoring-service.js');
    const scorer = new LeadScoringService();
    const clinicScore = await scorer.scoreLead(db.pool, {
      leadId: seed.a.leadId,
      answers: { q_service: 'dental', q_patient_type: 'new', q_urgency: 'asap', q_time_pref: 'morning', q_coverage: 'insurance', q_book_now: 'yes' },
    });
    expect(clinicScore).toMatchObject({ score: 100, temperature: 'hot' });
    const run = await db.pool.query(`SELECT scoring_version FROM app.score_runs WHERE score_run_id=$1`, [clinicScore.scoreRunId]);
    expect(run.rows[0].scoring_version).toBe('clinic_v1');

    const realEstate = await db.pool.query<{ client_id: string }>(
      `INSERT INTO app.clients (client_key, company_name, timezone) VALUES ('brokerage', 'Brokerage', 'Africa/Cairo') RETURNING client_id`);
    const contact = await db.pool.query<{ contact_id: string }>(`INSERT INTO app.contacts (client_id, name, phone_e164) VALUES ($1, 'Buyer', '+201000000001') RETURNING contact_id`, [realEstate.rows[0]!.client_id]);
    const lead = await db.pool.query<{ lead_id: string }>(
      `INSERT INTO app.leads (client_id, contact_id, provider, provider_external_id, status, current_stage) VALUES ($1, $2, 'whatsapp', 'b-1', 'qualified', 'qualified') RETURNING lead_id`,
      [realEstate.rows[0]!.client_id, contact.rows[0]!.contact_id]);
    const reScore = await scorer.scoreLead(db.pool, { leadId: lead.rows[0]!.lead_id, answers: { q_budget_max: '6000000' } });
    const reRun = await db.pool.query(`SELECT scoring_version FROM app.score_runs WHERE score_run_id=$1`, [reScore.scoreRunId]);
    expect(reRun.rows[0].scoring_version).toBe('real_estate_v1');
  });

  it('lets a manager see every appointment, with the patient, service and coordinator', async () => {
    const seed = await seedClinic('bcnclinic');
    const res = await app.inject({ method: 'GET', url: '/api/appointments', headers: await login(seed.emails.manager) });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(3);
    expect(body.appointments[0]).toMatchObject({
      patientName: 'Patient 1', service: 'dental', patientType: 'new', urgency: 'asap', coordinatorName: 'Coordinator A', status: 'booked', timezone: 'Europe/Madrid',
    });
    expect(body.appointments[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.appointments.map((a: { patientName: string }) => a.patientName)).toEqual(['Patient 1', 'Patient 2', 'Patient 3']);
  });

  it('shows a coordinator only the appointments of their own patients', async () => {
    const seed = await seedClinic('bcnclinic');
    const res = await app.inject({ method: 'GET', url: '/api/appointments', headers: await login(seed.emails.coordA) });
    expect(res.json().appointments.map((a: { appointmentId: string }) => a.appointmentId)).toEqual([seed.a.appointmentId, seed.b.appointmentId]);
  });

  it("never leaks another clinic's appointments", async () => {
    const mine = await seedClinic('bcnclinic');
    const theirs = await seedClinic('madridclinic');
    const res = await app.inject({ method: 'GET', url: '/api/appointments', headers: await login(mine.emails.manager) });
    const ids = res.json().appointments.map((a: { appointmentId: string }) => a.appointmentId);
    expect(ids).not.toContain(theirs.a.appointmentId);
    expect(res.json().total).toBe(3);
  });

  it('filters by status and by the clinic-local date range, and requires a session', async () => {
    const seed = await seedClinic('bcnclinic');
    const headers = await login(seed.emails.manager);
    const cancelled = await app.inject({ method: 'GET', url: '/api/appointments?status=cancelled', headers });
    expect(cancelled.json().appointments).toHaveLength(1);
    const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });
    const range = await app.inject({ method: 'GET', url: `/api/appointments?from=${day(2)}&to=${day(2)}`, headers });
    expect(range.json().appointments.map((a: { patientName: string }) => a.patientName)).toEqual(['Patient 2']);
    expect((await app.inject({ method: 'GET', url: '/api/appointments?status=banana', headers })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/api/appointments' })).statusCode).toBe(401);
  });

  describe('provisioning a tenant from a spec', () => {
    const spec = async () => JSON.parse(await (await import('node:fs/promises')).readFile('docs/examples/clinic-tenant.example.json', 'utf8')) as Record<string, unknown>;

    it('creates the clinic, its hours, coordinator, channel and a published config with its own services', async () => {
      const { provisionClinicTenant } = await import('../scripts/provision-clinic-tenant.js');
      const result = await provisionClinicTenant(await spec());
      const client = await db.pool.query(
        `SELECT vertical, timezone, appointment_hours, appointment_blackout_days FROM app.clients WHERE client_id=$1`, [result.clientId]);
      expect(client.rows[0]).toMatchObject({
        vertical: 'clinic', timezone: 'Africa/Cairo',
        appointment_hours: ['10:00', '11:30', '13:00', '16:00', '17:30', '19:00'], appointment_blackout_days: ['Friday'],
      });
      const people = await db.pool.query(`SELECT name FROM app.salespeople WHERE client_id=$1`, [result.clientId]);
      expect(people.rows).toEqual([{ name: 'Mona' }]);
      const config = await db.pool.query(`SELECT config_json FROM configuration.versions WHERE version_key=$1`, [result.versionKey]);
      const services = config.rows[0].config_json.questions.find((q: { questionKey: string }) => q.questionKey === 'q_service').options;
      expect(services.map((o: { value: string }) => o.value)).toEqual(['consultation', 'checkup', 'cleaning', 'filling', 'whitening', 'braces', 'implants', 'other']);
      expect(config.rows[0].config_json.industry).toBe('clinic');
    });

    it('is safe to run again with an edited spec', async () => {
      const { provisionClinicTenant } = await import('../scripts/provision-clinic-tenant.js');
      const first = await spec();
      await provisionClinicTenant(first);
      await provisionClinicTenant({ ...first, appointmentHours: ['10:00'] });
      const clients = await db.pool.query(`SELECT appointment_hours FROM app.clients WHERE client_key='demo-dental'`);
      expect(clients.rows).toEqual([{ appointment_hours: ['10:00'] }]);
      expect((await db.pool.query(`SELECT 1 FROM app.projects`)).rowCount).toBe(1);
      expect((await db.pool.query(`SELECT 1 FROM app.salespeople`)).rowCount).toBe(1);
    });

    it('rejects a spec the conversation cannot carry', async () => {
      const { specSchema } = await import('../scripts/provision-clinic-tenant.js');
      const base = await spec();
      expect(() => specSchema.parse({ ...base, services: [] })).toThrow();
      expect(() => specSchema.parse({ ...base, appointmentHours: ['25:00'] })).toThrow();
      const long = [{ key: 'x', labels: { English: 'A service name that is far too long' } }];
      expect(() => specSchema.parse({ ...base, services: long })).toThrow();
    });
  });
});
