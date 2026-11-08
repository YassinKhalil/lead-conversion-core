import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { DashboardDirectoryService } from '../../services/dashboard/directory-service.js';
import { DashboardLeadActionService } from '../../services/dashboard/lead-action-service.js';
import { DashboardLeadDetailService } from '../../services/dashboard/lead-detail-service.js';
import { DashboardLeadListService } from '../../services/dashboard/lead-list-service.js';
import { DashboardNotificationService } from '../../services/dashboard/notification-service.js';
import { DashboardReservationService } from '../../services/dashboard/reservation-service.js';
import { DashboardAppointmentService } from '../../services/dashboard/appointment-service.js';
import { DashboardSessionService } from '../../services/dashboard/session-service.js';
import { dashboardEventBus } from '../../services/dashboard/stream-service.js';
import { DashboardSummaryService } from '../../services/dashboard/summary-service.js';
import { DashboardUserService } from '../../services/dashboard/user-service.js';
import { dashboardAuthRoutes } from './auth.js';
import { createAuthHook, sendDashboardError } from './context.js';
import { dashboardDirectoryRoutes } from './directory.js';
import { dashboardLeadRoutes } from './leads.js';
import { dashboardNotificationRoutes } from './notifications.js';
import { dashboardAppointmentRoutes } from './appointments.js';
import { dashboardReservationRoutes } from './reservations.js';
import { dashboardStreamRoutes } from './stream.js';
import { dashboardSummaryRoutes } from './summary.js';
import { dashboardTemplateRoutes } from './templates.js';
import { dashboardUserRoutes } from './users.js';

/**
 * Session-authenticated dashboard API. Registered as one encapsulated plugin so
 * the auth hook and the error serialiser apply to these routes only and leave
 * the machine-to-machine surface untouched.
 */
export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  const sessions = new DashboardSessionService();
  const users = new DashboardUserService();
  const list = new DashboardLeadListService();
  const detail = new DashboardLeadDetailService(list);
  const actions = new DashboardLeadActionService(list);
  const notifications = new DashboardNotificationService();
  const directory = new DashboardDirectoryService();
  const summary = new DashboardSummaryService();
  const reservations = new DashboardReservationService();
  const appointments = new DashboardAppointmentService();

  app.decorateRequest('dashboardSession', null);
  app.addHook('preHandler', createAuthHook(sessions));
  app.setErrorHandler((error, request: FastifyRequest, reply: FastifyReply) =>
    sendDashboardError(error, request, reply),
  );

  await dashboardAuthRoutes(app, { sessions, users });
  await dashboardUserRoutes(app, { users });
  await dashboardLeadRoutes(app, { list, detail, actions });
  await dashboardReservationRoutes(app, { reservations, actions });
  await dashboardAppointmentRoutes(app, { appointments });
  await dashboardNotificationRoutes(app, { notifications });
  await dashboardDirectoryRoutes(app, { directory });
  await dashboardSummaryRoutes(app, { summary });
  await dashboardTemplateRoutes(app);
  await dashboardStreamRoutes(app, { events: dashboardEventBus, sessions });

  app.addHook('onClose', async () => {
    await dashboardEventBus.close();
  });
}
