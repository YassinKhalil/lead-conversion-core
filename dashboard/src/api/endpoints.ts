import { buildQuery, request } from './client';
import type {
  DashboardSummary,
  Lead,
  LeadDetail,
  LeadFilters,
  LeadPage,
  ManagedUser,
  Message,
  Notification,
  Project,
  AppointmentFilters,
  AppointmentPage,
  Reservation,
  ReservationFilters,
  ReservationPage,
  Role,
  Salesperson,
  User,
} from './types';

export async function login(input: { email: string; password: string; clientKey?: string }) {
  return request<{ ok: true; token: string; expiresAt: string; user: User }>('/api/auth/login', {
    method: 'POST',
    body: input,
  });
}

export async function me() {
  return request<{ ok: true; user: User; expiresAt: string }>('/api/auth/me');
}

export async function logout() {
  return request<{ ok: true; revoked: boolean }>('/api/auth/logout', { method: 'POST' });
}

export async function listLeads(filters: LeadFilters, page: { limit: number; offset: number }) {
  const query = buildQuery({
    status: filters.status,
    temperature: filters.temperature,
    source: filters.source,
    assigned_to: filters.assignedTo,
    q: filters.search,
    unacknowledged: filters.unacknowledged ? 'true' : undefined,
    sort: filters.sort ?? 'last_message_at',
    direction: filters.direction ?? 'desc',
    limit: page.limit,
    offset: page.offset,
  });
  return request<{ ok: true } & LeadPage>(`/api/leads${query}`);
}

export async function getLead(leadId: string) {
  return request<{ ok: true } & LeadDetail>(`/api/leads/${leadId}`);
}

export async function getMessages(leadId: string, page: { limit: number; offset: number }) {
  const query = buildQuery({ limit: page.limit, offset: page.offset });
  return request<{ ok: true; messages: Message[]; total: number; limit: number; offset: number }>(
    `/api/leads/${leadId}/messages${query}`,
  );
}

export async function acknowledgeLead(leadId: string) {
  return request<{ ok: true; leadAssignmentId: string; acknowledgedAt: string; slaJobsCancelled: number }>(
    `/api/leads/${leadId}/acknowledge`,
    { method: 'POST' },
  );
}

export async function takeoverLead(leadId: string, enabled: boolean) {
  return request<{ ok: true; humanTakeover: boolean }>(`/api/leads/${leadId}/takeover`, {
    method: 'POST',
    body: { enabled },
  });
}

export async function closeLead(leadId: string, reason: string) {
  return request<{ ok: true; status: string; closedStatus: string }>(`/api/leads/${leadId}/close`, {
    method: 'POST',
    body: { reason },
  });
}

export async function stopFollowUp(leadId: string, reason: string) {
  return request<{ ok: true; stopFollowUp: boolean; followupsCancelled: number }>(
    `/api/leads/${leadId}/stop-followup`,
    { method: 'POST', body: { reason } },
  );
}

export async function setLeadStage(leadId: string, stage: string) {
  return request<{ ok: true; pipelineStage: string; previousPipelineStage: string; changed: boolean }>(
    `/api/leads/${leadId}/stage`,
    { method: 'PATCH', body: { stage } },
  );
}

export async function replyToLead(
  leadId: string,
  input: {
    requestKey: string;
    payload: { kind: 'text'; text: string } | { kind: 'template'; templateName: string; languageCode: string };
  },
) {
  return request<{ ok: true; messageId: string; outboxCommandId: string; sessionWindowOpen: boolean }>(
    `/api/leads/${leadId}/reply`,
    { method: 'POST', body: input },
  );
}

export type { Lead, LeadDetail, LeadPage, Message, User };

// --- Management surfaces ---------------------------------------------------

export async function listSalespeople(includeInactive = true) {
  return request<{ ok: true; salespeople: Salesperson[] }>(
    `/api/salespeople${includeInactive ? '?include_inactive=true' : ''}`,
  );
}

export interface SalespersonInput {
  name: string;
  phoneE164: string;
  email: string;
  unitSpecialties: string[];
  locations: string[];
  languages: string[];
  priorityRank: number;
  capacityLimit: number;
  active: boolean;
}

export async function createSalesperson(input: SalespersonInput) {
  return request<{ ok: true; salesperson: Salesperson }>('/api/salespeople', { method: 'POST', body: input });
}

export async function updateSalesperson(salespersonId: string, input: Partial<Omit<SalespersonInput, 'phoneE164'>>) {
  return request<{ ok: true; salesperson: Salesperson }>(`/api/salespeople/${salespersonId}`, {
    method: 'PATCH',
    body: input,
  });
}

export async function listProjects(includeInactive = true) {
  return request<{ ok: true; projects: Project[] }>(
    `/api/projects${includeInactive ? '?include_inactive=true' : ''}`,
  );
}

export interface ProjectInput {
  projectName: string;
  active: boolean;
  startingPrice: number | null;
  maxPrice: number | null;
  unitTypes: string[];
  location: string;
  mapsUrl: string;
}

export async function createProject(input: ProjectInput) {
  return request<{ ok: true; project: Project }>('/api/projects', { method: 'POST', body: input });
}

export async function updateProject(projectId: string, input: Partial<ProjectInput>) {
  return request<{ ok: true; project: Project }>(`/api/projects/${projectId}`, { method: 'PATCH', body: input });
}

/** Replaces the whole eligible set; routing reads this join. */
export async function setProjectSalespeople(projectId: string, salespersonIds: string[]) {
  return request<{ ok: true; project: Project }>(`/api/projects/${projectId}/salespeople`, {
    method: 'PUT',
    body: { salespersonIds },
  });
}

export async function listUsers() {
  return request<{ ok: true; users: ManagedUser[] }>('/api/users');
}

export async function createUser(input: {
  email: string;
  password: string;
  name: string;
  role: Role;
  salespersonId: string | null;
}) {
  return request<{ ok: true; user: ManagedUser }>('/api/users', { method: 'POST', body: input });
}

export async function updateUser(
  userId: string,
  input: { name?: string; role?: Role; active?: boolean; salespersonId?: string | null },
) {
  return request<{ ok: true; user: ManagedUser }>(`/api/users/${userId}`, { method: 'PATCH', body: input });
}

export async function listNotifications(unreadOnly = false) {
  return request<{
    ok: true;
    notifications: Notification[];
    total: number;
    unreadCount: number;
  }>(`/api/notifications?limit=100${unreadOnly ? '&unread=true' : ''}`);
}

export async function markNotificationRead(notificationId: string) {
  return request<{ ok: true; notification: Notification }>(`/api/notifications/${notificationId}/read`, {
    method: 'POST',
  });
}

export async function markAllNotificationsRead() {
  return request<{ ok: true; updated: number }>('/api/notifications/read-all', { method: 'POST' });
}

export async function getSummary() {
  return request<{ ok: true; summary: DashboardSummary }>('/api/dashboard/summary');
}

export async function listReservations(filters: ReservationFilters, page: { limit: number; offset: number }) {
  const query = buildQuery({
    status: filters.status?.join(','),
    from: filters.from,
    to: filters.to,
    limit: page.limit,
    offset: page.offset,
  });
  return request<{ ok: true } & ReservationPage>(`/api/reservations${query}`);
}

export async function getReservation(reservationId: string) {
  return request<{ ok: true; reservation: Reservation }>(`/api/reservations/${reservationId}`);
}

export async function confirmReservation(reservationId: string, depositStatus?: 'pending' | 'paid' | 'waived') {
  return request<{ ok: true; reservation: Reservation; guestNotified: boolean }>(`/api/reservations/${reservationId}/confirm`, {
    method: 'POST',
    body: depositStatus ? { depositStatus } : {},
  });
}

export async function cancelReservation(reservationId: string) {
  return request<{ ok: true; reservation: Reservation; guestNotified: boolean }>(`/api/reservations/${reservationId}/cancel`, {
    method: 'POST',
  });
}

export async function setReservationStatus(reservationId: string, status: 'seated' | 'completed' | 'no_show') {
  return request<{ ok: true; reservation: Reservation }>(`/api/reservations/${reservationId}/status`, {
    method: 'POST',
    body: { status },
  });
}

export async function listAppointments(filters: AppointmentFilters, page: { limit: number; offset: number }) {
  const query = buildQuery({
    status: filters.status?.join(','),
    from: filters.from,
    to: filters.to,
    limit: page.limit,
    offset: page.offset,
  });
  return request<{ ok: true } & AppointmentPage>(`/api/appointments${query}`);
}
