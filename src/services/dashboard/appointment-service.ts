import { pool } from '../../db/pool.js';
import { leadVisibilitySql, QueryParams } from './sql.js';
import type { DashboardScope } from './types.js';

export const APPOINTMENT_STATUSES = ['pending', 'booked', 'confirmed', 'cancelled', 'completed', 'no_show'] as const;

export interface AppointmentListFilters {
  status?: string[];
  from?: string; // YYYY-MM-DD in the appointment's own timezone, inclusive
  to?: string;
  limit: number;
  offset: number;
}

export interface AppointmentItem {
  appointmentId: string;
  leadId: string;
  patientName: string;
  patientPhone: string;
  /** YYYY-MM-DD in the appointment's timezone. */
  date: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: string;
  service: string;
  patientType: string;
  urgency: string;
  coordinatorName: string;
  createdAt: string;
}

interface Row {
  appointment_id: string;
  lead_id: string;
  patient_name: string;
  patient_phone: string;
  local_date: string;
  starts_at: Date;
  ends_at: Date;
  timezone: string;
  status: string;
  service: string | null;
  patient_type: string | null;
  urgency: string | null;
  coordinator_name: string | null;
  created_at: Date;
  total_count: string;
}

/** The answer a patient gave to one question, from their latest qualification session. */
const answer = (key: string) => `(
  SELECT qa.normalized_value
  FROM app.qualification_sessions qs
  JOIN app.qualification_answers qa ON qa.qualification_session_id = qs.qualification_session_id
  WHERE qs.lead_id = a.lead_id AND qa.question_key = '${key}'
  ORDER BY qs.started_at DESC
  LIMIT 1
)`;

/**
 * Appointments for a clinic's front desk. Read only: a booking is made by the
 * patient on WhatsApp, and changing one goes through the lead's conversation.
 * Scoped exactly as leads are.
 */
export class DashboardAppointmentService {
  async list(
    scope: DashboardScope,
    filters: AppointmentListFilters,
  ): Promise<{ appointments: AppointmentItem[]; total: number; limit: number; offset: number }> {
    const params = new QueryParams();
    const where = [`(${leadVisibilitySql('l', scope, params)})`];
    if (filters.status?.length) where.push(`a.status = ANY(${params.bind(filters.status)}::text[])`);
    if (filters.from) where.push(`(a.starts_at AT TIME ZONE a.timezone)::date >= ${params.bind(filters.from)}::date`);
    if (filters.to) where.push(`(a.starts_at AT TIME ZONE a.timezone)::date <= ${params.bind(filters.to)}::date`);
    const limit = params.bind(filters.limit);
    const offset = params.bind(filters.offset);
    const result = await pool.query<Row>(
      `SELECT a.appointment_id, a.lead_id, ct.name AS patient_name, ct.phone_e164 AS patient_phone,
              to_char((a.starts_at AT TIME ZONE a.timezone)::date, 'YYYY-MM-DD') AS local_date,
              a.starts_at, a.ends_at, a.timezone, a.status,
              ${answer('q_service')} AS service, ${answer('q_patient_type')} AS patient_type, ${answer('q_urgency')} AS urgency,
              sp.name AS coordinator_name, a.created_at,
              count(*) OVER ()::text AS total_count
       FROM app.appointments a
       JOIN app.leads l ON l.lead_id = a.lead_id
       JOIN app.contacts ct ON ct.contact_id = l.contact_id
       LEFT JOIN app.lead_assignments la ON la.lead_id = a.lead_id AND la.status = 'assigned'
       LEFT JOIN app.salespeople sp ON sp.salesperson_id = la.salesperson_id
       WHERE ${where.join(' AND ')}
       ORDER BY a.starts_at, a.created_at
       LIMIT ${limit} OFFSET ${offset}`,
      params.list(),
    );
    return {
      appointments: result.rows.map((row) => ({
        appointmentId: row.appointment_id,
        leadId: row.lead_id,
        patientName: row.patient_name,
        patientPhone: row.patient_phone,
        date: row.local_date,
        startsAt: row.starts_at.toISOString(),
        endsAt: row.ends_at.toISOString(),
        timezone: row.timezone,
        status: row.status,
        service: row.service ?? '',
        patientType: row.patient_type ?? '',
        urgency: row.urgency ?? '',
        coordinatorName: row.coordinator_name ?? '',
        createdAt: row.created_at.toISOString(),
      })),
      total: Number(result.rows[0]?.total_count ?? 0),
      limit: filters.limit,
      offset: filters.offset,
    };
  }
}
