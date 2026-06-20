// src/app.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';

import { registerErrorHandler } from './shared/plugins/error-handler.plugin';

import { teamPublicRoutes, teamAdminRoutes } from './modules/team/team.routes';
import { categoriesPublicRoutes, categoriesAdminRoutes } from './modules/categories/categories.routes';
import { competitionsPublicRoutes, competitionsAdminRoutes } from './modules/competitions/competitions.routes';
import { opponentsPublicRoutes, opponentsAdminRoutes } from './modules/opponents/opponents.routes';
import { matchesPublicRoutes, matchesAdminRoutes } from './modules/matches/matches.routes';
import { standingsPublicRoutes, standingsAdminRoutes } from './modules/standings/standings.routes';
import { squadPublicRoutes, squadAdminRoutes } from './modules/squad/squad.routes';

export async function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
    trustProxy: true,
  });

  await app.register(helmet, { global: true });

  await app.register(compress, {
    global: true,
    threshold: 1024,
    encodings: ['br', 'gzip', 'deflate'],
  });

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',').map((o) => o.trim()).filter(Boolean);

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`Origem não permitida pelo CORS: ${origin}`), false);
    },
    credentials: true,
  });

  await app.register(rateLimit, {
    global: true,
    max: 600,
    timeWindow: '15 minutes',
    errorResponseBuilder: () => ({ error: 'Muitas requisições, tente novamente em alguns minutos.' }),
  });

  // ─── Multipart (upload de logos/fotos) ─────────────────────
  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 },
  });

  registerErrorHandler(app);

  app.get('/api/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  }));

  await app.register(async (instance: FastifyInstance) => {
    await instance.register(teamPublicRoutes);
    await instance.register(categoriesPublicRoutes);
    await instance.register(competitionsPublicRoutes);
    await instance.register(opponentsPublicRoutes);
    await instance.register(matchesPublicRoutes);
    await instance.register(standingsPublicRoutes);
    await instance.register(squadPublicRoutes);
  }, { prefix: '/api' });

  await app.register(async (instance: FastifyInstance) => {
    await instance.register(teamAdminRoutes);
    await instance.register(categoriesAdminRoutes);
    await instance.register(competitionsAdminRoutes);
    await instance.register(opponentsAdminRoutes);
    await instance.register(matchesAdminRoutes);
    await instance.register(standingsAdminRoutes);
    await instance.register(squadAdminRoutes);
  }, { prefix: '/api/admin' });

  return app;
}