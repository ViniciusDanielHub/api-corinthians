// src/app.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';

import { registerErrorHandler } from './shared/plugins/error-handler.plugin';

import { teamPublicRoutes, teamAdminRoutes } from './modules/team/team.routes';
import { categoriesPublicRoutes, categoriesAdminRoutes } from './modules/categories/categories.routes';
import { competitionsPublicRoutes, competitionsAdminRoutes } from './modules/competitions/competitions.routes';
import { opponentsPublicRoutes, opponentsAdminRoutes } from './modules/opponents/opponents.routes';
import { matchesPublicRoutes, matchesAdminRoutes } from './modules/matches/matches.routes';
import { standingsPublicRoutes, standingsAdminRoutes } from './modules/standings/standings.routes';
import { squadPublicRoutes, squadAdminRoutes } from './modules/squad/squad.routes';
import { movementsPublicRoutes, movementsAdminRoutes } from './modules/movements/movements.routes';

import { transferClubsPublicRoutes, transferClubsAdminRoutes } from './modules/transfer-clubs/transfer-clubs.routes';
import { financeAdminRoutes } from './modules/finance/finance.routes';


export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      ...(process.env.NODE_ENV !== 'production' && {
        transport: { target: 'pino-pretty', options: { colorize: true } },
      }),
    },
  });

  // ── Plugins globais ────────────────────────────────────────────────────────
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(compress);
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  if (!process.env.CORS_ORIGIN && process.env.NODE_ENV === 'production') {
    app.log.warn(
      'CORS_ORIGIN não definida em produção — a API está aceitando requisições de QUALQUER origem. ' +
      'Defina CORS_ORIGIN no .env com os domínios autorizados, separados por vírgula.',
    );
  }
  await app.register(multipart, {
    limits: {
      fieldNameSize: 100,   // tamanho máx. do nome de cada campo de texto
      fieldSize: 10_000,    // tamanho máx. de cada campo de texto (bytes)
      fields: 30,           // número máx. de campos de texto no formulário
      files: 1,             // só fazemos upload de 1 imagem por requisição
      // fileSize fica por conta do MAX_SIZE_BYTES em upload.plugin.ts
    },
  });
  await app.register(rateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX) || 200,
    timeWindow: '1 minute',
  });

  // ── Health check ───────────────────────────────────────────────────────────
  app.get('/api/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

  if (!process.env.JWT_SECRET?.trim()) {
    app.log.warn(
      'JWT_SECRET não definida — TODAS as rotas /api/admin/* vão retornar 503 até que ' +
      'essa variável seja configurada no .env (deve ser o mesmo segredo usado pelo sports-news-api).',
    );
  }

  // ── Rotas públicas (leitura, sem autenticação) ────────────────────────────
  await app.register(teamPublicRoutes, { prefix: '/api' });
  await app.register(categoriesPublicRoutes, { prefix: '/api' });
  await app.register(competitionsPublicRoutes, { prefix: '/api' });
  await app.register(opponentsPublicRoutes, { prefix: '/api' });
  await app.register(matchesPublicRoutes, { prefix: '/api' });
  await app.register(standingsPublicRoutes, { prefix: '/api' });
  await app.register(squadPublicRoutes, { prefix: '/api' });
  await app.register(movementsPublicRoutes, { prefix: '/api' });

  // ── Rotas admin (escrita, exigem x-api-key) ───────────────────────────────
  await app.register(teamAdminRoutes, { prefix: '/api/admin' });
  await app.register(categoriesAdminRoutes, { prefix: '/api/admin' });
  await app.register(competitionsAdminRoutes, { prefix: '/api/admin' });
  await app.register(opponentsAdminRoutes, { prefix: '/api/admin' });
  await app.register(matchesAdminRoutes, { prefix: '/api/admin' });
  await app.register(standingsAdminRoutes, { prefix: '/api/admin' });
  await app.register(squadAdminRoutes, { prefix: '/api/admin' });
  await app.register(movementsAdminRoutes, { prefix: '/api/admin' });
  await app.register(transferClubsPublicRoutes, { prefix: '/api' });
  await app.register(transferClubsAdminRoutes, { prefix: '/api/admin' });
  await app.register(financeAdminRoutes, { prefix: '/api/admin' });

  // ── Handlers globais de erro ───────────────────────────────────────────────
  registerErrorHandler(app);

  return app;
}