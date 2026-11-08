import type { TenantProfile } from './types';

/**
 * Dental clinic presentation: appointment booking. The answer keys below
 * (`q_service`, `q_patient_type`, `q_urgency`, `q_time_pref`, `q_coverage`,
 * `q_book_now`) are the contract config/seed-clinic.json uses, and the stored
 * values are configuration values (`this_week`), so `valueLabels` turns them
 * into words. Health information is never asked for: the conversation collects
 * what the front desk needs to book, not why the patient is coming.
 *
 * The pipeline stage values are a backend enum, so only their labels change.
 */
export const clinic: TenantProfile = {
  vertical: 'clinic',
  terms: {
    lead: 'Patient',
    leads: 'Patients',
    person: 'Coordinator',
    people: 'Coordinators',
    place: 'Clinic',
    places: 'Clinics',
    booked: 'Appointment',
    visit: 'Appointment',
    category: 'Service',
    categories: 'Services',
  },
  facts: [
    { label: 'Treatment', kind: 'answer', key: 'q_service', numeric: false },
    { label: 'Patient', kind: 'answer', key: 'q_patient_type', numeric: false },
    { label: 'How soon', kind: 'answer', key: 'q_urgency', numeric: false },
    { label: 'Time of day', kind: 'answer', key: 'q_time_pref', numeric: false },
  ],
  summary: [
    { kind: 'answer', key: 'q_service' },
    { kind: 'answer', key: 'q_patient_type' },
    { kind: 'answer', key: 'q_urgency' },
    { kind: 'answer', key: 'q_time_pref' },
  ],
  qualificationTitle: 'Booking details',
  qualificationEmptyDetail: 'Details appear here as the conversation works through the booking questions.',
  features: { openingLine: false, currency: false, reservations: false, appointments: true },
  list: {
    wantColumn: 'What they asked for',
    leadColumn: 'Patient',
    emptyAllTitle: 'No patients yet',
    emptyAllDetail:
      'Message your WhatsApp number to watch the first one arrive. Each patient appears here as soon as their booking conversation starts.',
    emptyMineTitle: 'No patients assigned to you',
    emptyMineDetail: 'A patient appears here when routing assigns them to you, and the queue puts the most urgent first.',
  },
  manage: {
    placesSubtitle: 'A patient is matched to a clinic, and routing then picks from the coordinators assigned to it.',
    placesEmptyDetail: 'Add the clinics this group runs. Routing then chooses among the coordinators assigned to each clinic.',
    usersEmptyDetail:
      'Every person who signs in needs an account here. Coordinators need one too: a coordinator record on its own receives WhatsApp notifications but cannot open the dashboard.',
    roleHint: 'Coordinators see only their own patients. Managers see the whole group. Admins add user management.',
    atRiskEmptyDetail:
      'Patients who finished the questions appear here while they are waiting to be acknowledged. An empty table means the team is keeping up.',
  },
  questionLabels: {
    q_permission: 'Permission to ask',
    q_service: 'Treatment',
    q_patient_type: 'Patient',
    q_urgency: 'How soon',
    q_time_pref: 'Time of day',
    q_coverage: 'Payment',
    q_book_now: 'Slot offered',
  },
  valueLabels: {
    q_service: {
      consultation: 'Consultation',
      checkup: 'Check-up',
      cleaning: 'Cleaning',
      filling: 'Filling',
      whitening: 'Whitening',
      braces: 'Braces',
      implants: 'Implants',
      other: 'Something else',
    },
    q_patient_type: { new: 'New patient', existing: 'Existing patient' },
    q_urgency: { asap: 'As soon as possible', this_week: 'This week', flexible: 'Flexible' },
    q_time_pref: { morning: 'Morning', afternoon: 'Afternoon', any: 'Either' },
    q_coverage: { private: 'Private', insurance: 'Insurance', unsure: 'Not sure' },
    q_book_now: { yes: 'Yes', no: 'No, call them' },
  },
  factorLabels: {
    base: 'Base score',
    urgency: 'How soon',
    patient_type: 'Patient type',
    book_now: 'Asked for a slot',
    service_present: 'Visit type given',
    coverage_known: 'Payment known',
    qualified_state: 'Reached qualified',
  },
  stageLabels: {
    new: 'New',
    in_progress: 'In progress',
    site_visit_scheduled: 'Appointment booked',
    closed_won: 'Attended',
    closed_lost: 'Cancelled',
    ghosted: 'No response',
  },
  eventLabels: {
    'lead.intake_received': 'Patient enquiry received',
    'message.send_requested': 'Outbound message queued',
    'sla.scheduled': 'SLA timer scheduled',
    'sla.cancelled': 'SLA timer cancelled',
    'sla.sent': 'SLA reminder sent',
    'followup.scheduled': 'Follow-up scheduled',
    'followup.cancelled': 'Follow-up cancelled',
    'dashboard.assignment_acknowledged': 'Assignment acknowledged',
    'dashboard.lead_closed': 'Enquiry closed',
    'dashboard.followups_stopped': 'Follow-ups stopped',
    'dashboard.human_takeover_enabled': 'Human took over',
    'dashboard.human_takeover_disabled': 'Handed back to the engine',
    'salesperson.lead_assignment_notification': 'New patient assigned',
    'salesperson.sla_assignment_reminder': 'SLA reminder',
    'salesperson.appointment_booked_notification': 'Appointment booked',
    'operator.sla_escalation': 'SLA escalation',
    'operator.daily_report': 'Daily report',
    'operator.routing_attention_required': 'Routing needs attention',
  },
};
