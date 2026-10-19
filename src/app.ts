import { PassThrough } from 'node:stream';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { getEnv } from './config/env.js';
import { logger } from './config/logger.js';
import { dashboardRoutes } from './routes/dashboard/index.js';
import { handleRequestError } from './routes/error-handler.js';
import { healthRoutes } from './routes/health.js';
import { internalRoutes } from './routes/internal.js';
import { leadIngressRoutes } from './routes/lead-ingress.js';
import { metaWebhookRoutes } from './routes/meta-webhooks.js';
import { demoRoutes } from './routes/public-demo.js';
import { hospitalityDemoRoutes } from './routes/public-demo-hospitality.js';
import { waitlistRoutes } from './routes/waitlist.js';

function requiresRawWebhookBody(method: string, url: string): boolean {
  if (method !== 'POST') return false;
  return url.startsWith('/webhooks/meta/whatsapp') || url.startsWith('/webhooks/leads/facebook');
}

export async function buildApp() {
  const env = getEnv();
  const app = Fastify({
    loggerInstance: logger,
    bodyLimit: 1_000_000,
    requestIdHeader: 'x-request-id',
    // Who is allowed to set X-Forwarded-For. Without this, `request.ip` is the
    // proxy's own address for every public request and every IP-keyed limit
    // collapses into a single shared counter.
    //
    // Loopback alone was not enough. The API runs in a container behind Caddy
    // on the host, so requests arrive from the Docker bridge gateway, not from
    // 127.0.0.1. That address was untrusted, so it became `request.ip` and the
    // forwarded header was ignored — in production the waitlist rate-limit key
    // was `waitlist:ip:172.21.0.1` for every visitor.
    //
    // The whole 172.16.0.0/12 private range is trusted rather than the one
    // observed gateway, because recreating the container can move the bridge
    // to a different address in that range and silently reintroduce the bug.
    // Nothing outside the host can reach the container's published port.
    //
    // Still resolves the client only while every hop in front is inside the
    // trusted set. A chain that leaves the box and comes back resolves to the
    // returning hop instead — see the waitlist wiring tests.
    trustProxy: ['127.0.0.1', '172.16.0.0/12'],
  });

  app.addHook('preParsing', (request, _reply, payload, done) => {
    if (!requiresRawWebhookBody(request.method, request.url)) {
      done(null, payload);
      return;
    }
    const replay = new PassThrough();
    const chunks: Buffer[] = [];
    payload.on('data', (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(buffer);
      replay.write(buffer);
    });
    payload.on('end', () => {
      Object.assign(request, { rawBody: Buffer.concat(chunks) });
      replay.end();
    });
    payload.on('error', (error: Error) => replay.destroy(error));
    done(null, replay);
  });

  await app.register(rateLimit, {
    global: false,
    max: env.PUBLIC_INGRESS_RATE_LIMIT_MAX,
    timeWindow: env.PUBLIC_INGRESS_RATE_LIMIT_WINDOW_MS,
  });

  await app.register(healthRoutes);
  await app.register(internalRoutes);
  await app.register(leadIngressRoutes);
  await app.register(metaWebhookRoutes);
  await app.register(waitlistRoutes);
  await app.register(demoRoutes);
  await app.register(hospitalityDemoRoutes);
  if (env.DASHBOARD_API_ENABLED) {
    await app.register(dashboardRoutes);
  }

  app.setErrorHandler(handleRequestError);

  return app;
}
