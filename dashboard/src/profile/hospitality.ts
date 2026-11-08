import type { TenantProfile } from './types';

/**
 * Hospitality presentation. The backend has no hospitality configuration yet,
 * so the answer keys below (`q_party_size`, `q_date_shift`, `q_zone`,
 * `q_deposit`) are the contract a hospitality conversation config must use for
 * this view to show values. An answer under any other key still appears in the
 * conversation; it just is not one of the four facts. Confirm the keys against
 * the real config before launch (sites/CLAIMS.md, row 16).
 *
 * The pipeline stage values are a backend enum, so only their labels change.
 */
export const hospitality: TenantProfile = {
  vertical: 'hospitality',
  terms: {
    lead: 'Guest',
    leads: 'Guests',
    person: 'Host',
    people: 'Hosts',
    place: 'Venue',
    places: 'Venues',
    booked: 'Reservation',
    visit: 'Reservation',
    category: 'Zone',
    categories: 'Zones',
  },
  facts: [
    { label: 'Party size', kind: 'answer', key: 'q_party_size', numeric: true },
    { label: 'Date and shift', kind: 'answer', key: 'q_date_shift', numeric: false },
    { label: 'Zone', kind: 'answer', key: 'q_zone', numeric: false },
    { label: 'Deposit', kind: 'answer', key: 'q_deposit', numeric: false },
  ],
  summary: [
    { kind: 'answer', key: 'q_party_size', unit: ['guest', 'guests'] },
    { kind: 'answer', key: 'q_date_shift' },
    { kind: 'answer', key: 'q_zone' },
  ],
  qualificationTitle: 'Reservation details',
  qualificationEmptyDetail: 'Details appear here as the conversation works through the reservation sequence.',
  features: { openingLine: false, currency: false, reservations: true, appointments: false },
  list: {
    wantColumn: 'What they asked for',
    leadColumn: 'Guest',
    emptyAllTitle: 'No guests yet',
    emptyAllDetail:
      'Message your WhatsApp number or ring your venue line to watch the first one arrive. Each guest appears here as soon as their reservation conversation starts.',
    emptyMineTitle: 'No guests assigned to you',
    emptyMineDetail: 'A guest appears here when routing assigns them to you, and the queue puts the most urgent first.',
  },
  manage: {
    placesSubtitle: 'A guest is matched to a venue, and routing then picks from the hosts assigned to it.',
    placesEmptyDetail: 'Add the venues this group runs. Routing then chooses among the hosts assigned to each venue.',
    usersEmptyDetail:
      'Every person who signs in needs an account here. Hosts need one too: a host record on its own receives WhatsApp notifications but cannot open the dashboard.',
    roleHint: 'Hosts see only their own guests. Managers see the whole group. Admins add user management.',
    atRiskEmptyDetail:
      'Qualified guests appear here while they are waiting to be acknowledged. An empty table means the team is keeping up.',
  },
  questionLabels: {
    q_permission: 'Permission to ask',
    q_party_size: 'Party size',
    q_date_shift: 'Date and shift',
    q_zone: 'Zone',
    q_deposit: 'Deposit',
  },
  factorLabels: {
    base: 'Base score',
    qualified_state: 'Reached qualified',
  },
  stageLabels: {
    new: 'New',
    in_progress: 'In progress',
    site_visit_scheduled: 'Reservation booked',
    closed_won: 'Seated',
    closed_lost: 'Cancelled',
    ghosted: 'No response',
  },
  eventLabels: {
    'lead.intake_received': 'Guest enquiry received',
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
    'salesperson.lead_assignment_notification': 'New guest assigned',
    'salesperson.sla_assignment_reminder': 'SLA reminder',
    'salesperson.appointment_booked_notification': 'Reservation booked',
    'operator.sla_escalation': 'SLA escalation',
    'operator.daily_report': 'Daily report',
    'operator.routing_attention_required': 'Routing needs attention',
  },
};
