import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { APPOINTMENT_STATUSES, type DashboardAppointmentService } from '../../services/dashboard/appointment-service.js';
import { scopeFor } from '../../services/dashboard/types.js';
import { parseOrThrow, requireUser } from './context.js';

const csv = z
  .union([z.string(), z.array(z.string())])
  .transform((value) => (Array.isArray(value) ? value : value.split(',')).map((entry) => entry.trim()).filter(Boolean));

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const listQuerySchema = z.object({
  status: csv.pipe(z.array(z.enum(APPOINTMENT_STATUSES))).optional(),
  from: day.optional(),
  to: day.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});

/** Appointments for a clinic tenant's front desk. Scoped exactly as leads are. */
export async function dashboardAppointmentRoutes(
  app: FastifyInstance,
  deps: { appointments: DashboardAppointmentService },
): Promise<void> {
  app.get('/api/appointments', async (request: FastifyRequest) => {
    const user = requireUser(request);
    const query = parseOrThrow(listQuerySchema, request.query);
    const page = await deps.appointments.list(scopeFor(user), {
      ...(query.status ? { status: query.status } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
      limit: query.limit,
      offset: query.offset,
    });
    return { ok: true, ...page };
  });
}
