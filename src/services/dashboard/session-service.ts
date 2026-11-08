import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { getEnv } from '../../config/env.js';
import { pool, type Db } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { AuditRepository } from '../../infrastructure/runtime.js';
import { burnDecoyVerification, verifyPassword } from './password.js';
import {
  type DashboardLoginResult,
  type DashboardRole,
  type DashboardSession,
  type DashboardUser,
  tooManyRequests,
  unauthorized,
} from './types.js';


const TOKEN_BYTES = 32;

// Bounds the argon2 work a single unauthenticated request can trigger when
// several tenants happen to share an email address.
const MAX_LOGIN_CANDIDATES = 5;

interface UserRow {
  user_id: string;
  client_id: string;
  salesperson_id: string | null;
  email: string;
  name: string;
  role: DashboardRole;
  client_key: string;
  vertical: 'real_estate' | 'hospitality' | 'clinic';
  company_name: string;
  timezone: string;
  last_login_at: Date | null;
}

const USER_SELECT = `
  u.user_id, u.client_id, u.salesperson_id, u.email, u.name, u.role,
  u.last_login_at, c.client_key, c.vertical, c.company_name, c.timezone
`;

function toUser(row: UserRow): DashboardUser {
  return {
    userId: row.user_id,
    clientId: row.client_id,
    salespersonId: row.salesperson_id,
    email: row.email,
    name: row.name,
    role: row.role,
    clientKey: row.client_key,
    vertical: row.vertical,
    companyName: row.company_name,
    timezone: row.timezone,
    lastLoginAt: row.last_login_at ? row.last_login_at.toISOString() : null,
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase();
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function hashesMatch(received: string, expected: string): boolean {
  const a = Buffer.from(received, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface LoginInput {
  email: string;
  password: string;
  clientKey?: string;
  ipAddress: string;
  userAgent: string;
}

export class DashboardSessionService {
  constructor(
    private readonly audit = new AuditRepository(),
    private readonly env = getEnv(),
  ) {}

  get sessionTtlMs(): number {
    return this.env.DASHBOARD_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
  }

  async login(input: LoginInput): Promise<DashboardLoginResult> {
    const email = normalizeEmail(input.email);
    const throttleKeys = [
      `ip:${input.ipAddress}`,
      `email:${createHash('sha256').update(email).digest('hex')}`,
    ];
    for (const key of throttleKeys) {
      const attempt = await this.consumeAttempt(key);
      if (!attempt.allowed) {
        throw tooManyRequests('login_rate_limited', attempt.retryAfterSeconds);
      }
    }

    const candidates = await pool.query<UserRow & { password_hash: string }>(
      `SELECT ${USER_SELECT}, u.password_hash
       FROM app.users u
       JOIN app.clients c ON c.client_id = u.client_id
       WHERE u.email = $1
         AND u.active
         AND c.active
         AND ($2 = '' OR c.client_key = $2)
       ORDER BY u.created_at, u.user_id
       LIMIT $3`,
      [email, input.clientKey ? input.clientKey.trim() : '', MAX_LOGIN_CANDIDATES],
    );

    let matched: UserRow | undefined;
    for (const row of candidates.rows) {
      if (await verifyPassword(row.password_hash, input.password)) {
        matched = row;
        break;
      }
    }
    if (!matched) {
      if (candidates.rows.length === 0) await burnDecoyVerification(input.password);
      throw unauthorized('invalid_credentials');
    }

    const user = toUser(matched);
    const token = randomBytes(TOKEN_BYTES).toString('hex');
    const expiresAt = new Date(Date.now() + this.sessionTtlMs).toISOString();
    return withTransaction(async (client) => {
      const session = await client.query<{ session_id: string; expires_at: Date }>(
        `INSERT INTO app.sessions (user_id, token_hash, expires_at, user_agent, ip_address)
         VALUES ($1, $2, $3::timestamptz, $4, $5)
         RETURNING session_id, expires_at`,
        [user.userId, hashToken(token), expiresAt, input.userAgent.slice(0, 500), input.ipAddress.slice(0, 100)],
      );
      const sessionId = session.rows[0]?.session_id;
      if (!sessionId) throw new Error('dashboard_session_not_created');
      await client.query('UPDATE app.users SET last_login_at = now(), updated_at = now() WHERE user_id = $1', [
        user.userId,
      ]);
      await this.audit.record(client, {
        eventType: 'dashboard.login_succeeded',
        actorType: 'operator',
        actorId: user.userId,
        aggregateType: 'user',
        aggregateId: user.userId,
        payload: { role: user.role, sessionId, clientId: user.clientId },
      });
      await this.resetAttempts(client, throttleKeys);
      return {
        token,
        sessionId,
        expiresAt: (session.rows[0]?.expires_at ?? new Date(expiresAt)).toISOString(),
        user: { ...user, lastLoginAt: new Date().toISOString() },
      };
    });
  }

  async resolve(token: string): Promise<DashboardSession | null> {
    if (!token) return null;
    const tokenHash = hashToken(token);
    const result = await pool.query<UserRow & { session_id: string; token_hash: string; expires_at: Date }>(
      `SELECT ${USER_SELECT}, s.session_id, s.token_hash, s.expires_at
       FROM app.sessions s
       JOIN app.users u ON u.user_id = s.user_id
       JOIN app.clients c ON c.client_id = u.client_id
       WHERE s.token_hash = $1
         AND s.revoked_at IS NULL
         AND s.expires_at > now()
         AND u.active
         AND c.active`,
      [tokenHash],
    );
    const row = result.rows[0];
    if (!row) return null;
    // Defence in depth: the row was found by an indexed lookup, so confirm the
    // stored digest really equals the presented one without an early-exit compare.
    if (!hashesMatch(tokenHash, row.token_hash)) return null;
    return {
      sessionId: row.session_id,
      expiresAt: row.expires_at.toISOString(),
      user: toUser(row),
    };
  }

  async refresh(sessionId: string): Promise<DashboardSession | null> {
    const expiresAt = new Date(Date.now() + this.sessionTtlMs).toISOString();
    const result = await pool.query<UserRow & { session_id: string; expires_at: Date }>(
      `WITH extended AS (
         UPDATE app.sessions
         SET expires_at = $2::timestamptz
         WHERE session_id = $1
           AND revoked_at IS NULL
           AND expires_at > now()
         RETURNING session_id, user_id, expires_at
       )
       SELECT ${USER_SELECT}, extended.session_id, extended.expires_at
       FROM extended
       JOIN app.users u ON u.user_id = extended.user_id
       JOIN app.clients c ON c.client_id = u.client_id
       WHERE u.active AND c.active`,
      [sessionId, expiresAt],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      sessionId: row.session_id,
      expiresAt: row.expires_at.toISOString(),
      user: toUser(row),
    };
  }

  async revoke(sessionId: string, actorId: string): Promise<boolean> {
    return withTransaction(async (client) => {
      const result = await client.query<{ session_id: string }>(
        `UPDATE app.sessions
         SET revoked_at = now()
         WHERE session_id = $1 AND revoked_at IS NULL
         RETURNING session_id`,
        [sessionId],
      );
      const revoked = Boolean(result.rows[0]);
      if (revoked) {
        await this.audit.record(client, {
          eventType: 'dashboard.logout',
          actorType: 'operator',
          actorId,
          aggregateType: 'session',
          aggregateId: sessionId,
          payload: { sessionId },
        });
      }
      return revoked;
    });
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const result = await pool.query<{ session_id: string }>(
      `UPDATE app.sessions
       SET revoked_at = now()
       WHERE user_id = $1 AND revoked_at IS NULL
       RETURNING session_id`,
      [userId],
    );
    return result.rowCount ?? result.rows.length;
  }

  private async consumeAttempt(key: string): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const windowSeconds = Math.ceil(this.env.DASHBOARD_LOGIN_RATE_LIMIT_WINDOW_MS / 1000);
    const result = await pool.query<{ attempt_count: number; retry_after_seconds: number }>(
      `INSERT INTO app.login_attempts (attempt_key, window_started_at, attempt_count)
       VALUES ($1, now(), 1)
       ON CONFLICT (attempt_key) DO UPDATE SET
         window_started_at = CASE
           WHEN app.login_attempts.window_started_at <= now() - make_interval(secs => $2)
           THEN now() ELSE app.login_attempts.window_started_at END,
         attempt_count = CASE
           WHEN app.login_attempts.window_started_at <= now() - make_interval(secs => $2)
           THEN 1 ELSE app.login_attempts.attempt_count + 1 END,
         updated_at = now()
       RETURNING attempt_count,
                 GREATEST(0, ceil(extract(epoch FROM (window_started_at + make_interval(secs => $2)) - now())))::int
                   AS retry_after_seconds`,
      [key, windowSeconds],
    );
    const row = result.rows[0];
    if (!row) throw new Error('login_attempt_not_recorded');
    return {
      allowed: row.attempt_count <= this.env.DASHBOARD_LOGIN_RATE_LIMIT_MAX,
      retryAfterSeconds: row.retry_after_seconds,
    };
  }

  private async resetAttempts(client: Db, keys: string[]): Promise<void> {
    await client.query('DELETE FROM app.login_attempts WHERE attempt_key = ANY($1::text[])', [keys]);
  }
}
