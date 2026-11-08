import type { TenantProfile } from './types';

/**
 * The dashboard as it shipped before profiles existed. Every string here is the
 * string the app used before, and tests/dashboard-profiles.test.ts holds it to
 * that, so a real-estate tenant sees no change.
 */
export const realEstate: TenantProfile = {
  vertical: 'real_estate',
  terms: {
    lead: 'Lead',
    leads: 'Leads',
    person: 'Salesperson',
    people: 'Salespeople',
    place: 'Project',
    places: 'Projects',
    booked: 'Viewing',
    visit: 'Site visit',
    category: 'Unit type',
    categories: 'Unit types',
  },
  facts: [
    { label: 'Budget', kind: 'budget', key: 'q_budget', numeric: true },
    { label: 'Unit', kind: 'answer', key: 'q_unit_type', numeric: false },
    { label: 'Location', kind: 'answer', key: 'q_location', numeric: false },
    { label: 'Timeline', kind: 'answer', key: 'q_timeline', numeric: false },
  ],
  summary: [
    { kind: 'answer', key: 'q_unit_type' },
    { kind: 'answer', key: 'q_location' },
    { kind: 'budget' },
    { kind: 'answer', key: 'q_payment_plan' },
    { kind: 'answer', key: 'q_timeline' },
  ],
  qualificationTitle: 'Qualification',
  qualificationEmptyDetail: 'Answers appear here as the WhatsApp conversation progresses through the nine questions.',
  features: { openingLine: true, currency: true, reservations: false, appointments: false },
  list: {
    wantColumn: 'What they want',
    leadColumn: 'Lead',
    emptyAllTitle: 'No leads yet',
    emptyAllDetail:
      'Message your WhatsApp number from a personal phone to watch the first one arrive. Leads also come from the website form and Facebook lead ads, and each appears here as soon as its qualification conversation starts.',
    emptyMineTitle: 'No leads assigned to you',
    emptyMineDetail: 'A lead appears here when routing assigns it to you, and the queue sorts it by score.',
  },
  manage: {
    placesSubtitle: 'A lead is matched to a project, and routing then picks from the salespeople assigned to it.',
    placesEmptyDetail:
      'Add the developments this brokerage sells. Leads are matched to a project by budget and unit type, and routing then chooses among the salespeople assigned to it.',
    usersEmptyDetail:
      'Every person who signs in needs an account here. Salespeople need one too: a salesperson record on its own receives WhatsApp notifications but cannot open the dashboard.',
    roleHint: 'Salespeople see only their own leads. Managers see the whole client. Admins add user management.',
    atRiskEmptyDetail:
      'Qualified leads appear here while they are waiting to be acknowledged. An empty table means the team is keeping up.',
  },
  questionLabels: {
    q_permission: 'Permission to ask',
    q_location: 'Location',
    q_unit_type: 'Unit type',
    q_budget: 'Budget',
    q_payment_plan: 'Payment plan',
    q_down_payment: 'Down payment',
    q_timeline: 'Timeline',
    q_purpose: 'Purpose',
    q_site_visit: 'Site visit',
  },
  factorLabels: {
    base: 'Base score',
    budget: 'Budget',
    timeline: 'Timeline',
    site_visit: 'Site visit',
    payment_plan: 'Payment plan',
    purpose: 'Purpose',
    unit_type: 'Unit type',
    location_present: 'Location given',
    qualified_state: 'Reached qualified',
  },
  stageLabels: {
    new: 'New',
    in_progress: 'In progress',
    site_visit_scheduled: 'Site visit scheduled',
    closed_won: 'Closed won',
    closed_lost: 'Closed lost',
    ghosted: 'Ghosted',
  },
  eventLabels: {
    'lead.intake_received': 'Lead received',
    'message.send_requested': 'Outbound message queued',
    'sla.scheduled': 'SLA timer scheduled',
    'sla.cancelled': 'SLA timer cancelled',
    'sla.sent': 'SLA reminder sent',
    'followup.scheduled': 'Follow-up scheduled',
    'followup.cancelled': 'Follow-up cancelled',
    'dashboard.assignment_acknowledged': 'Assignment acknowledged',
    'dashboard.lead_closed': 'Lead closed',
    'dashboard.followups_stopped': 'Follow-ups stopped',
    'dashboard.human_takeover_enabled': 'Human took over',
    'dashboard.human_takeover_disabled': 'Handed back to the engine',
    'salesperson.lead_assignment_notification': 'New lead assigned',
    'salesperson.sla_assignment_reminder': 'SLA reminder',
    'salesperson.appointment_booked_notification': 'Viewing booked',
    'operator.sla_escalation': 'SLA escalation',
    'operator.daily_report': 'Daily report',
    'operator.routing_attention_required': 'Routing needs attention',
  },
};
