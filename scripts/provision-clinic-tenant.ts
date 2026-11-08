import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import type { CompileInput } from '../src/domain/compiler.js';
import { LANGUAGES } from '../src/domain/language.js';

/**
 * Creates (or updates) a clinic tenant from one JSON spec: the client, its
 * clinic location, the dental services a patient can ask for, appointment hours,
 * coordinators, the WhatsApp number, and a published conversation config whose
 * service list is this clinic's.
 *
 *   npm run tenant:clinic -- --spec path/to/tenant.json
 *   npm run tenant:clinic -- --spec path/to/tenant.json --validate-only
 *
 * Re-running with an edited spec updates in place. Nothing is deleted. Dashboard
 * logins are created separately with `npm run user:create`.
 */

const labels = z.record(z.enum(['English', 'Arabic', 'Spanish', 'Catalan']), z.string().min(1).max(24)).refine((v) => Boolean(v.English), {
  message: 'English label is required (it is the fallback)',
});
const key = z.string().regex(/^[a-z][a-z0-9_]{0,30}$/);
const hour = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const weekday = z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);

export const specSchema = z.object({
  clientKey: z.string().regex(/^[a-z0-9][a-z0-9-]{1,60}$/),
  clientRecordId: z.string().regex(/^[A-Za-z0-9_-]{6,40}$/),
  companyName: z.string().min(1).max(200),
  timezone: z.string().min(3).max(60).refine((tz) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, { message: 'unknown timezone' }),
  managerPhoneE164: z.string().regex(/^\+\d{6,15}$/).default(''),
  whatsapp: z.object({ phoneNumberId: z.string().min(1).max(100), directSendEnabled: z.boolean().default(false) }),
  languages: z.array(z.enum(LANGUAGES as unknown as [string, ...string[]])).min(1).max(3),
  clinic: z.object({ name: z.string().min(1).max(200), location: z.string().max(200).default(''), mapsUrl: z.string().max(2000).default('') }),
  // The "what is the visit for?" list. WhatsApp lists hold ten rows, a row title 24 characters.
  services: z.array(z.object({ key, labels })).min(1).max(10),
  // Local clock times offered as slots, and the weekdays the clinic is closed.
  appointmentHours: z.array(hour).min(1).max(12),
  closedDays: z.array(weekday).max(6).default(['Saturday', 'Sunday']),
  coordinators: z.array(z.object({ name: z.string().min(1).max(200), phoneE164: z.string().regex(/^\+\d{6,15}$/) })).min(1).max(50),
}).superRefine((spec, ctx) => {
  if (new Set(spec.services.map((s) => s.key)).size !== spec.services.length) ctx.addIssue({ code: 'custom', message: 'duplicate service key' });
});

export type ClinicTenantSpec = z.infer<typeof specSchema>;

export interface ProvisionResult {
  clientId: string;
  projectId: string;
  versionKey: string;
}

/** The seed config with the service list replaced by this clinic's and its languages. */
export function buildConfig(spec: ClinicTenantSpec, seedPath: string): CompileInput {
  const seed = JSON.parse(readFileSync(seedPath, 'utf8')) as CompileInput & { languages?: string[] };
  const serviceQuestion = seed.questions.find((q) => q.fields['Question Key'] === 'q_service');
  if (!serviceQuestion) throw new Error('seed has no q_service question');
  const others = seed.options.filter((o) => !(Array.isArray(o.fields.Question) && o.fields.Question.includes(serviceQuestion.id)));
  const serviceOptions = spec.services.map((service, index) => ({
    id: `recCS${spec.clientKey.replace(/[^a-z0-9]/gi, '').slice(0, 6)}${String(index).padStart(4, '0')}`,
    fields: {
      Question: [serviceQuestion.id],
      'Option Key': `service_${service.key}`,
      Value: service.key,
      Order: index + 1,
      Active: true,
      English: service.labels.English,
      Arabic: service.labels.Arabic ?? service.labels.English,
      ...(service.labels.Spanish ? { Spanish: service.labels.Spanish } : {}),
      ...(service.labels.Catalan ? { Catalan: service.labels.Catalan } : {}),
    },
  }));
  return { ...seed, languages: spec.languages as CompileInput['languages'], options: [...others, ...serviceOptions] } as CompileInput;
}

export async function provisionClinicTenant(rawSpec: unknown, seedPath = resolve('config/seed-clinic.json')): Promise<ProvisionResult> {
  const spec = specSchema.parse(rawSpec);
  const [{ withTransaction }, { VersionedConfigService }] = await Promise.all([
    import('../src/db/transaction.js'),
    import('../src/configuration/versioned-config-service.js'),
  ]);

  const dir = mkdtempSync(join(tmpdir(), 'clinic-config.'));
  let published: { versionKey: string };
  try {
    const path = join(dir, 'config.json');
    writeFileSync(path, JSON.stringify(buildConfig(spec, seedPath)));
    published = await new VersionedConfigService().publish({ sourcePath: path, clientRecordId: spec.clientRecordId, publishedBy: 'provision-clinic-tenant' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  return withTransaction(async (db) => {
    const client = await db.query<{ client_id: string }>(
      `INSERT INTO app.clients (client_key, legacy_airtable_id, company_name, manager_phone_e164, timezone, vertical, appointment_hours, appointment_blackout_days)
       VALUES ($1, $2, $3, $4, $5, 'clinic', $6::jsonb, $7::text[])
       ON CONFLICT (client_key) DO UPDATE SET
         legacy_airtable_id=EXCLUDED.legacy_airtable_id, company_name=EXCLUDED.company_name,
         manager_phone_e164=EXCLUDED.manager_phone_e164, timezone=EXCLUDED.timezone, vertical='clinic',
         appointment_hours=EXCLUDED.appointment_hours, appointment_blackout_days=EXCLUDED.appointment_blackout_days, updated_at=now()
       RETURNING client_id`,
      [spec.clientKey, spec.clientRecordId, spec.companyName, spec.managerPhoneE164, spec.timezone,
        JSON.stringify(spec.appointmentHours), spec.closedDays],
    );
    const clientId = client.rows[0]!.client_id;

    // A clinic location is a project; reuse it by name so re-running does not duplicate it.
    const existing = await db.query<{ project_id: string }>(
      `SELECT project_id FROM app.projects WHERE client_id=$1 AND project_name=$2`, [clientId, spec.clinic.name]);
    const projectId = existing.rows[0]?.project_id
      ?? (await db.query<{ project_id: string }>(
        `INSERT INTO app.projects (client_id, project_name, location, maps_url) VALUES ($1, $2, $3, $4) RETURNING project_id`,
        [clientId, spec.clinic.name, spec.clinic.location, spec.clinic.mapsUrl])).rows[0]!.project_id;
    await db.query(`UPDATE app.projects SET location=$2, maps_url=$3, active=true, updated_at=now() WHERE project_id=$1`, [projectId, spec.clinic.location, spec.clinic.mapsUrl]);

    for (const coordinator of spec.coordinators) {
      const sp = await db.query<{ salesperson_id: string }>(
        `INSERT INTO app.salespeople (client_id, name, phone_e164, languages) VALUES ($1, $2, $3, $4::text[])
         ON CONFLICT (client_id, phone_e164) DO UPDATE SET name=EXCLUDED.name, active=true, updated_at=now()
         RETURNING salesperson_id`,
        [clientId, coordinator.name, coordinator.phoneE164, spec.languages],
      );
      await db.query(
        `INSERT INTO app.salesperson_projects (salesperson_id, project_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [sp.rows[0]!.salesperson_id, projectId],
      );
    }

    await db.query(
      `INSERT INTO edge_client_channels (phone_number_id, client_record_id, client_id, company_name, active, config_version, direct_send_enabled, graph_phone_number_id)
       VALUES ($1, $2, $3, $4, true, $5, $6, $1)
       ON CONFLICT (phone_number_id) DO UPDATE SET client_record_id=EXCLUDED.client_record_id, client_id=EXCLUDED.client_id,
         company_name=EXCLUDED.company_name, active=true, config_version=EXCLUDED.config_version,
         direct_send_enabled=EXCLUDED.direct_send_enabled, graph_phone_number_id=EXCLUDED.graph_phone_number_id, updated_at=now()`,
      [spec.whatsapp.phoneNumberId, spec.clientRecordId, clientId, spec.companyName, published.versionKey, spec.whatsapp.directSendEnabled],
    );
    return { clientId, projectId, versionKey: published.versionKey };
  });
}

function parseArgs(argv: string[]): { spec: string; validateOnly: boolean } {
  let spec = '';
  let validateOnly = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? '';
    if (arg === '--validate-only') validateOnly = true;
    else if (arg === '--spec' && argv[i + 1]) spec = argv[++i] ?? '';
    else throw new Error(`Unknown argument: ${arg}\nUsage: npm run tenant:clinic -- --spec <file.json> [--validate-only]`);
  }
  if (!spec || /[\u0000-\u001f\u007f]/.test(spec)) throw new Error('--spec <file.json> is required');
  return { spec, validateOnly };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { spec, validateOnly } = parseArgs(process.argv.slice(2));
  const raw = JSON.parse(readFileSync(spec, 'utf8')) as unknown;
  if (validateOnly) {
    specSchema.parse(raw);
    console.log('Spec is valid.');
  } else {
    const result = await provisionClinicTenant(raw);
    console.log(JSON.stringify(result, null, 2));
    const { closePool } = await import('../src/db/pool.js');
    await closePool();
  }
}
