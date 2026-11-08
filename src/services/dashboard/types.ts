export type DashboardRole = 'admin' | 'manager' | 'salesperson';

export const dashboardRoles: readonly DashboardRole[] = ['admin', 'manager', 'salesperson'];

export interface DashboardUser {
  userId: string;
  clientId: string;
  salespersonId: string | null;
  email: string;
  name: string;
  role: DashboardRole;
  clientKey: string;
  /** Which product this tenant runs; the dashboard picks its vocabulary from it. */
  vertical: 'real_estate' | 'hospitality' | 'clinic';
  companyName: string;
  timezone: string;
  lastLoginAt: string | null;
}

export interface DashboardSession {
  sessionId: string;
  expiresAt: string;
  user: DashboardUser;
}

export interface DashboardLoginResult extends DashboardSession {
  token: string;
}

/**
 * Every dashboard query is scoped by these values inside the SQL WHERE clause.
 * `restrictToOwnLeads` is true only for the salesperson role, which sees leads
 * assigned to itself plus leads with no active assignment.
 */
export interface DashboardScope {
  clientId: string;
  salespersonId: string | null;
  restrictToOwnLeads: boolean;
}

export function scopeFor(user: DashboardUser): DashboardScope {
  return {
    clientId: user.clientId,
    salespersonId: user.salespersonId,
    restrictToOwnLeads: user.role === 'salesperson',
  };
}

export class DashboardHttpError extends Error {
  readonly statusCode: number;
  readonly details: Record<string, unknown>;

  constructor(statusCode: number, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'DashboardHttpError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function badRequest(message: string, details: Record<string, unknown> = {}): DashboardHttpError {
  return new DashboardHttpError(400, message, details);
}

export function unauthorized(message = 'unauthenticated'): DashboardHttpError {
  return new DashboardHttpError(401, message);
}

export function forbidden(message = 'forbidden'): DashboardHttpError {
  return new DashboardHttpError(403, message);
}

export function notFound(message: string): DashboardHttpError {
  return new DashboardHttpError(404, message);
}

export function conflict(message: string, details: Record<string, unknown> = {}): DashboardHttpError {
  return new DashboardHttpError(409, message, details);
}

export function tooManyRequests(message: string, retryAfterSeconds: number): DashboardHttpError {
  return new DashboardHttpError(429, message, { retryAfterSeconds });
}
