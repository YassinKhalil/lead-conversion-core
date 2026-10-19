import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .transform((value: 'true' | 'false') => value === 'true');

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  EDGE_HOST: z.string().default('0.0.0.0'),
  EDGE_PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z.string().default('info'),
  DATABASE_URL: z.string().min(1),
  EDGE_SHARED_SECRET: z.string().min(16),
  EDGE_INTERNAL_SECRET: z.string().min(16),
  WORKER_NAME: z.string().optional().default(''),
  WORKER_KIND: z.literal('runtime').default('runtime'),
  RUNTIME_WORKER_ENABLED: booleanString.default('false'),
  RUNTIME_WORKER_IDLE_SLEEP_MS: z.coerce.number().int().positive().default(250),
  DIRECT_META_WEBHOOK_ENABLED: booleanString.default('false'),
  DIRECT_LEAD_INGRESS_ENABLED: booleanString.default('false'),
  DIRECT_META_SEND_ENABLED: booleanString.default('false'),
  META_WA_ACCESS_TOKEN: z.string().optional().default(''),
  META_WA_PHONE_NUMBER_ID: z.string().optional().default(''),
  META_APPROVED_TEMPLATE_NAMES: z.string().optional().default(''),
  META_DEFAULT_TEMPLATE_LANGUAGE: z.string().min(2).max(10).default('ar'),
  META_APP_SECRET: z.string().optional().default(''),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional().default(''),
  META_STATUS_PROCESSOR_ENABLED: booleanString.default('false'),
  GRAPH_API_VERSION: z.string().default('v25.0'),
  GOOGLE_CALENDAR_ENABLED: booleanString.default('false'),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_REFRESH_TOKEN: z.string().optional().default(''),
  PUBLIC_INGRESS_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  PUBLIC_INGRESS_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  DASHBOARD_API_ENABLED: booleanString.default('false'),
  DASHBOARD_SESSION_TTL_DAYS: z.coerce.number().int().positive().max(365).default(30),
  DASHBOARD_SESSION_COOKIE_NAME: z.string().min(1).default('lcc_session'),
  DASHBOARD_SESSION_COOKIE_SECURE: booleanString.default('true'),
  INBOUND_LEAD_CAPTURE_ENABLED: booleanString.default('true'),
  INBOUND_LEAD_CAPTURE_PHONE_LIMIT: z.coerce.number().int().positive().default(3),
  INBOUND_LEAD_CAPTURE_CLIENT_LIMIT: z.coerce.number().int().positive().default(60),
  INBOUND_LEAD_CAPTURE_WINDOW_MS: z.coerce.number().int().positive().default(3_600_000),
  DASHBOARD_LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  DASHBOARD_LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  DEMO_CHAT_ENABLED: booleanString.default('false'),
  WAITLIST_SIGNUP_ENABLED: booleanString.default('false'),
  WAITLIST_SIGNUP_IP_LIMIT: z.coerce.number().int().positive().default(5),
  WAITLIST_SIGNUP_IP_WINDOW_MS: z.coerce.number().int().positive().default(3_600_000),
  WAITLIST_SIGNUP_EMAIL_LIMIT: z.coerce.number().int().positive().default(3),
  WAITLIST_SIGNUP_EMAIL_WINDOW_MS: z.coerce.number().int().positive().default(86_400_000),
  WAITLIST_SIGNUP_MESSAGE_MAX_LENGTH: z.coerce.number().int().positive().max(10_000).default(2_000),
  SEED_CONFIG_PATH: z.string().default('./config/seed-real-estate.json'),
});

const schema = baseSchema.superRefine((env, ctx) => {
  function requireConfigured(
    condition: boolean,
    field: keyof z.infer<typeof baseSchema>,
    message: string,
    minLength = 1,
  ): void {
    if (!condition) return;
    const value = String(env[field] || '').trim();
    if (value.length >= minLength) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [field],
      message,
    });
  }

  requireConfigured(env.DIRECT_META_WEBHOOK_ENABLED, 'META_WEBHOOK_VERIFY_TOKEN', 'META_WEBHOOK_VERIFY_TOKEN is required when DIRECT_META_WEBHOOK_ENABLED=true');
  requireConfigured(env.DIRECT_META_WEBHOOK_ENABLED || env.DIRECT_LEAD_INGRESS_ENABLED, 'META_APP_SECRET', 'META_APP_SECRET is required when direct Meta or Facebook ingress is enabled');

  if ((env.DIRECT_META_WEBHOOK_ENABLED || env.DIRECT_LEAD_INGRESS_ENABLED) && !env.RUNTIME_WORKER_ENABLED) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['RUNTIME_WORKER_ENABLED'],
      message: 'RUNTIME_WORKER_ENABLED must be true when direct ingress routes are enabled',
    });
  }

  if (env.DIRECT_META_WEBHOOK_ENABLED && !env.META_STATUS_PROCESSOR_ENABLED) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['META_STATUS_PROCESSOR_ENABLED'],
      message: 'META_STATUS_PROCESSOR_ENABLED must be true when DIRECT_META_WEBHOOK_ENABLED=true',
    });
  }

  requireConfigured(env.DIRECT_META_SEND_ENABLED, 'META_WA_ACCESS_TOKEN', 'META_WA_ACCESS_TOKEN is required when DIRECT_META_SEND_ENABLED=true');
  requireConfigured(env.DIRECT_META_SEND_ENABLED, 'META_WA_PHONE_NUMBER_ID', 'META_WA_PHONE_NUMBER_ID is required when DIRECT_META_SEND_ENABLED=true');

  requireConfigured(env.GOOGLE_CALENDAR_ENABLED, 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_ID is required when GOOGLE_CALENDAR_ENABLED=true');
  requireConfigured(env.GOOGLE_CALENDAR_ENABLED, 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET is required when GOOGLE_CALENDAR_ENABLED=true');
  requireConfigured(env.GOOGLE_CALENDAR_ENABLED, 'GOOGLE_REFRESH_TOKEN', 'GOOGLE_REFRESH_TOKEN is required when GOOGLE_CALENDAR_ENABLED=true');
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function parseEnv(input: NodeJS.ProcessEnv): Env {
  return schema.parse(input);
}

export function getEnv(): Env {
  if (!cached) {
    cached = parseEnv(process.env);
  }
  return cached;
}
