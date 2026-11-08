export type Role = 'admin' | 'manager' | 'salesperson';

export interface User {
  userId: string;
  clientId: string;
  salespersonId: string | null;
  email: string;
  name: string;
  role: Role;
  clientKey: string;
  /** Sent by the API; the tenant profile resolves from it before falling back to `clientKey`. */
  vertical?: string;
  companyName: string;
  timezone: string;
  lastLoginAt: string | null;
}

export interface Contact {
  contactId: string;
  name: string;
  phoneE164: string;
  email: string;
}

export interface LeadProject {
  projectId: string;
  projectName: string;
  location: string;
}

export interface LeadAssignment {
  leadAssignmentId: string;
  salespersonId: string;
  salespersonName: string;
  salespersonPhoneE164: string;
  status: string;
  assignedAt: string;
  acknowledgedAt: string | null;
}

export interface LeadScoreSummary {
  scoreRunId: string;
  score: number;
  temperature: string;
  scoringVersion: string;
  createdAt: string;
}

export interface Lead {
  leadId: string;
  clientId: string;
  status: string;
  currentStage: string;
  temperature: string;
  leadScore: number | null;
  source: string;
  provider: string;
  stopFollowUp: boolean;
  closedStatus: string;
  /** Sales pipeline stage, independent of the engine's `status`. */
  pipelineStage: string;
  /** 'English', 'Arabic', or '' when the conversation never settled on one. */
  preferredLanguage: string;
  /** Latest qualification session's answers, keyed by question. */
  qualificationAnswers: Record<string, string>;
  firstReceivedAt: string | null;
  firstContactedAt: string | null;
  lastMessageAt: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  sessionWindowExpiresAt: string | null;
  sessionWindowOpen: boolean;
  humanTakeover: boolean;
  messageCount: number;
  createdAt: string;
  contact: Contact;
  project: LeadProject | null;
  assignment: LeadAssignment | null;
  latestScore: LeadScoreSummary | null;
}

export interface LeadPage {
  leads: Lead[];
  total: number;
  limit: number;
  offset: number;
}

export interface QualificationAnswer {
  questionKey: string;
  order: number;
  answered: boolean;
  normalizedValue: string;
  rawValue: string;
  parserSource: string;
  answeredAt: string | null;
}

export interface ScoreFactor {
  key: string;
  value: unknown;
  points: number;
  reason: string;
}

export interface ScoreRun {
  scoreRunId: string;
  scoringVersion: string;
  score: number;
  temperature: string;
  factors: ScoreFactor[];
  missingAnswers: string[];
  createdAt: string;
}

export interface RoutingCandidate {
  salespersonId: string;
  name: string;
  rank: number;
  score: number;
  phoneE164: string;
  unitMatch: boolean;
  languageMatch: boolean;
  locationMatch: boolean;
  priorityRank: number;
  activeAssignmentCount: number;
  selected: boolean;
}

export interface RoutingRun {
  routingRunId: string;
  routingVersion: string;
  outcome: string;
  selectedSalespersonId: string | null;
  candidates: RoutingCandidate[];
  reasons: Record<string, unknown>;
  createdAt: string;
}

export interface Message {
  messageId: string;
  direction: 'inbound' | 'outbound' | string;
  channel: string;
  messageText: string;
  messageType: string;
  state: string;
  fromAddress: string;
  providerMessageId: string;
  createdAt: string;
}

export interface AssignmentHistoryItem {
  leadAssignmentId: string;
  salespersonId: string;
  salespersonName: string;
  salespersonPhoneE164: string;
  status: string;
  routingVersion: string;
  assignedAt: string;
  acknowledgedAt: string | null;
  closedAt: string | null;
}

export interface ActivityItem {
  auditEventId: string;
  eventType: string;
  actorType: string;
  actorId: string;
  aggregateType: string;
  aggregateId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface LeadDetail {
  lead: Lead;
  qualification: {
    qualificationSessionId: string | null;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
    answers: QualificationAnswer[];
  };
  latestScoreRun: ScoreRun | null;
  latestRoutingRun: RoutingRun | null;
  assignments: AssignmentHistoryItem[];
  messages: Message[];
  activity: ActivityItem[];
}

export interface LeadFilters {
  status?: string[];
  temperature?: string[];
  assignedTo?: 'me' | 'unassigned' | string;
  source?: string[];
  search?: string;
  unacknowledged?: boolean;
  sort?: 'created_at' | 'lead_score' | 'last_message_at';
  direction?: 'asc' | 'desc';
}

export interface Salesperson {
  salespersonId: string;
  name: string;
  phoneE164: string;
  email: string;
  active: boolean;
  unitSpecialties: string[];
  locations: string[];
  languages: string[];
  priorityRank: number;
  capacityLimit: number;
  activeAssignmentCount: number;
  unacknowledgedAssignmentCount: number;
  overdueAssignmentCount: number;
  acknowledgedCount: number;
  avgAcknowledgementSeconds: number | null;
  createdAt: string;
}

export interface Project {
  projectId: string;
  projectName: string;
  active: boolean;
  startingPrice: number | null;
  maxPrice: number | null;
  unitTypes: string[];
  location: string;
  mapsUrl: string;
  salespersonIds: string[];
  createdAt: string;
}

export interface ManagedUser {
  userId: string;
  clientId: string;
  salespersonId: string | null;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Notification {
  notificationId: string;
  notificationType: string;
  recipientType: string;
  recipientId: string | null;
  priority: string;
  payload: Record<string, unknown>;
  leadId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface PeriodMetrics {
  newLeads: number;
  qualifiedLeads: number;
  closedLeads: number;
  assignedUnacknowledged: number;
  acknowledged: number;
  replied: number;
  conversionRate: number;
}

export interface ResponseTimeMetrics {
  avgFirstContactSeconds: number | null;
  medianFirstContactSeconds: number | null;
  p90FirstContactSeconds: number | null;
  slowestFirstContactSeconds: number | null;
  avgAcknowledgementSeconds: number | null;
  medianAcknowledgementSeconds: number | null;
  p90AcknowledgementSeconds: number | null;
  slowestAcknowledgementSeconds: number | null;
  pendingAcknowledgements: number;
  oldestPendingAcknowledgementSeconds: number | null;
}

export type PeriodKey = 'today' | 'week' | 'month';

export interface DashboardSummary {
  timezone: string;
  generatedAt: string;
  periods: Record<PeriodKey, PeriodMetrics>;
  previousPeriods: Record<PeriodKey, PeriodMetrics>;
  responseTime: ResponseTimeMetrics;
  leadsByTemperature: { temperature: string; count: number }[];
  leadsBySource: { source: string; count: number }[];
}

export type AppointmentStatus = 'pending' | 'booked' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';

/** One appointment as `GET /api/appointments` returns it. Service, patient type and urgency are stored values. */
export interface Appointment {
  appointmentId: string;
  leadId: string;
  patientName: string;
  patientPhone: string;
  /** YYYY-MM-DD in the appointment's own timezone. */
  date: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: AppointmentStatus | string;
  service: string;
  patientType: string;
  urgency: string;
  coordinatorName: string;
  createdAt: string;
}

export interface AppointmentPage {
  appointments: Appointment[];
  total: number;
  limit: number;
  offset: number;
}

export interface AppointmentFilters {
  status?: AppointmentStatus[];
  from?: string;
  to?: string;
}

export type ReservationStatus = 'requested' | 'confirmed' | 'cancelled' | 'no_show' | 'seated' | 'completed';

/** One reservation as `GET /api/reservations` returns it. Labels are the venue's English ones. */
export interface Reservation {
  reservationId: string;
  leadId: string | null;
  guestName: string;
  guestPhone: string;
  venueId: string;
  venueName: string;
  partySize: number;
  /** YYYY-MM-DD in the venue's calendar. */
  serviceDate: string;
  shift: string;
  zone: string;
  startsAt: string;
  status: ReservationStatus;
  depositRequired: boolean;
  depositStatus: 'none' | 'pending' | 'paid' | 'waived' | string;
  provider: string;
  language: string;
  notes: string;
  hostId: string | null;
  hostName: string;
  createdAt: string;
}

export interface ReservationPage {
  reservations: Reservation[];
  total: number;
  limit: number;
  offset: number;
}

export interface ReservationFilters {
  status?: ReservationStatus[];
  from?: string;
  to?: string;
}
