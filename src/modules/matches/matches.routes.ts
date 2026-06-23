// src/modules/matches/matches.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../shared/database/prisma';
import { requireAdminAuth } from '../../shared/plugins/admin-auth.plugin';
import { Validator, sanitizePagination, VALID_MATCH_STATUSES } from '../../shared/validation';

const matchInclude = {
  opponent: { select: { id: true, name: true, logoUrl: true } },
  competition: {
    select: { id: true, name: true, season: true, category: { select: { name: true, slug: true } } },
  },
} as const;

export async function matchesPublicRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/matches?category=sub-20&status=SCHEDULED&limit=10
  app.get('/matches', async (request, reply) => {
    const { category, status, competitionId, limit } = request.query as {
      category?: string; status?: string; competitionId?: string; limit?: string;
    };

    if (status) {
      new Validator()
        .oneOf('status', status, VALID_MATCH_STATUSES, 'status da partida')
        .throw();
    }

    const take = limit ? Math.min(Math.max(Number(limit) || 20, 1), 100) : 20;

    const matches = await prisma.match.findMany({
      where: {
        ...(status && { status: status as any }),
        ...(competitionId && { competitionId }),
        ...(category && { competition: { category: { slug: category } } }),
      },
      include: matchInclude,
      orderBy: { date: 'asc' },
      take,
    });
    return reply.send(matches);
  });

  // GET /api/matches/next?category=principal&limit=5
  app.get('/matches/next', async (request, reply) => {
    const { category, limit } = request.query as { category?: string; limit?: string };
    const take = limit ? Math.min(Math.max(Number(limit) || 5, 1), 50) : 5;

    const matches = await prisma.match.findMany({
      where: {
        status: 'SCHEDULED',
        date: { gte: new Date() },
        ...(category && { competition: { category: { slug: category } } }),
      },
      include: matchInclude,
      orderBy: { date: 'asc' },
      take,
    });
    return reply.send(matches);
  });

  // GET /api/matches/recent?category=principal&limit=5
  app.get('/matches/recent', async (request, reply) => {
    const { category, limit } = request.query as { category?: string; limit?: string };
    const take = limit ? Math.min(Math.max(Number(limit) || 5, 1), 50) : 5;

    const matches = await prisma.match.findMany({
      where: {
        status: 'FINISHED',
        ...(category && { competition: { category: { slug: category } } }),
      },
      include: matchInclude,
      orderBy: { date: 'desc' },
      take,
    });
    return reply.send(matches);
  });
}

export async function matchesAdminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAdminAuth);

  app.get('/matches', async (request, reply) => {
    const { page, limit } = request.query as any;
    const { skip, take, page: p } = sanitizePagination(page, limit, 100);

    const [data, total] = await Promise.all([
      prisma.match.findMany({ include: matchInclude, orderBy: { date: 'desc' }, skip, take }),
      prisma.match.count(),
    ]);
    return reply.send({ data, total, page: p, limit: take });
  });

  app.post('/matches', async (request, reply) => {
    const body = request.body as any;

    new Validator()
      .required('competitionId', body?.competitionId, 'competição')
      .required('opponentId', body?.opponentId, 'adversário')
      .required('date', body?.date, 'data')
      .isoDate('date', body?.date, 'data')
      .oneOf('status', body?.status, VALID_MATCH_STATUSES, 'status')
      .string('venue', body?.venue, { max: 120, label: 'local' })
      .string('round', body?.round, { max: 60, label: 'rodada' })
      .boolean('isHome', body?.isHome, 'mandante')
      .integer('homeScore', body?.homeScore, { min: 0, max: 99, label: 'gols do mandante' })
      .integer('awayScore', body?.awayScore, { min: 0, max: 99, label: 'gols do visitante' })
      .throw();

    // Valida que placar só pode ser informado para partidas finalizadas
    const status = body.status ?? 'SCHEDULED';
    const hasScore = body.homeScore !== undefined || body.awayScore !== undefined;
    if (hasScore && !['FINISHED', 'IN_PLAY'].includes(status)) {
      return reply.code(422).send({
        error: 'Placar só pode ser informado para partidas com status FINISHED ou IN_PLAY.',
        received: { status, homeScore: body.homeScore, awayScore: body.awayScore },
      });
    }

    // Verifica existência de competição e adversário em paralelo
    const [competition, opponent] = await Promise.all([
      prisma.competition.findUnique({ where: { id: body.competitionId } }),
      prisma.opponent.findUnique({ where: { id: body.opponentId } }),
    ]);

    const errors = [];
    if (!competition) {
      errors.push({
        field: 'competitionId',
        message: `Competição com ID "${body.competitionId}" não encontrada.`,
        hint: 'Use GET /api/admin/competitions para listar as competições.',
      });
    }
    if (!opponent) {
      errors.push({
        field: 'opponentId',
        message: `Adversário com ID "${body.opponentId}" não encontrado.`,
        hint: 'Use GET /api/admin/opponents para listar os adversários ou crie um novo.',
      });
    }
    if (errors.length > 0) {
      return reply.code(422).send({ error: 'Referências inválidas.', details: errors });
    }

    const match = await prisma.match.create({
      data: {
        competitionId: body.competitionId,
        opponentId: body.opponentId,
        date: new Date(body.date),
        venue: body.venue?.trim() ?? null,
        isHome: body.isHome ?? true,
        status: body.status ?? 'SCHEDULED',
        homeScore: body.homeScore !== undefined ? Number(body.homeScore) : null,
        awayScore: body.awayScore !== undefined ? Number(body.awayScore) : null,
        round: body.round?.trim() ?? null,
      },
      include: matchInclude,
    });
    return reply.code(201).send(match);
  });

  app.patch('/matches/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    if (!body || Object.keys(body).length === 0) {
      return reply.code(422).send({
        error: 'Nenhum campo enviado para atualização.',
        hint: 'Envie ao menos um campo válido.',
      });
    }

    new Validator()
      .isoDate('date', body.date, 'data')
      .oneOf('status', body.status, VALID_MATCH_STATUSES, 'status')
      .string('venue', body.venue, { max: 120, label: 'local' })
      .string('round', body.round, { max: 60, label: 'rodada' })
      .boolean('isHome', body.isHome, 'mandante')
      .integer('homeScore', body.homeScore, { min: 0, max: 99, label: 'gols do mandante' })
      .integer('awayScore', body.awayScore, { min: 0, max: 99, label: 'gols do visitante' })
      .throw();

    // Se estiver atualizando placar, valida status atual ou novo
    const hasScore = body.homeScore !== undefined || body.awayScore !== undefined;
    if (hasScore) {
      const current = await prisma.match.findUnique({ where: { id }, select: { status: true } });
      const effectiveStatus = body.status ?? current?.status;
      if (effectiveStatus && !['FINISHED', 'IN_PLAY'].includes(effectiveStatus)) {
        return reply.code(422).send({
          error: `Placar não pode ser definido para partidas com status "${effectiveStatus}". Use FINISHED ou IN_PLAY.`,
        });
      }
    }

    // Verifica existência de competição/adversário se estiverem sendo trocados
    // (mesma checagem feita no POST — sem isso, o erro só apareceria como uma
    // violação de FK genérica do Prisma em vez de uma mensagem clara)
    const refErrors: { field: string; message: string; hint?: string }[] = [];
    if (body.competitionId) {
      const competition = await prisma.competition.findUnique({ where: { id: body.competitionId } });
      if (!competition) {
        refErrors.push({
          field: 'competitionId',
          message: `Competição com ID "${body.competitionId}" não encontrada.`,
          hint: 'Use GET /api/admin/competitions para listar as competições.',
        });
      }
    }
    if (body.opponentId) {
      const opponent = await prisma.opponent.findUnique({ where: { id: body.opponentId } });
      if (!opponent) {
        refErrors.push({
          field: 'opponentId',
          message: `Adversário com ID "${body.opponentId}" não encontrado.`,
          hint: 'Use GET /api/admin/opponents para listar os adversários.',
        });
      }
    }
    if (refErrors.length > 0) {
      return reply.code(422).send({ error: 'Referências inválidas.', details: refErrors });
    }

    const match = await prisma.match.update({
      where: { id },
      data: {
        ...(body.competitionId && { competitionId: body.competitionId }),
        ...(body.opponentId && { opponentId: body.opponentId }),
        ...(body.date && { date: new Date(body.date) }),
        ...(body.venue !== undefined && { venue: body.venue?.trim() ?? null }),
        ...(body.isHome !== undefined && { isHome: Boolean(body.isHome) }),
        ...(body.status && { status: body.status }),
        ...(body.homeScore !== undefined && {
          homeScore: body.homeScore === null ? null : Number(body.homeScore),
        }),
        ...(body.awayScore !== undefined && {
          awayScore: body.awayScore === null ? null : Number(body.awayScore),
        }),
        ...(body.round !== undefined && { round: body.round?.trim() ?? null }),
      },
      include: matchInclude,
    });
    return reply.send(match);
  });

  app.delete('/matches/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.match.delete({ where: { id } });
    return reply.send({ message: 'Partida deletada com sucesso.' });
  });
}