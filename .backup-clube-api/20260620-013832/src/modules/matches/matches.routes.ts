// src/modules/matches/matches.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../shared/database/prisma';
import { requireApiKey } from '../../shared/plugins/api-key.plugin';

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

    const matches = await prisma.match.findMany({
      where: {
        ...(status && { status: status as any }),
        ...(competitionId && { competitionId }),
        ...(category && { competition: { category: { slug: category } } }),
      },
      include: matchInclude,
      orderBy: { date: 'asc' },
      take: limit ? Math.min(Number(limit), 100) : 20,
    });
    return reply.send(matches);
  });

  // GET /api/matches/next?category=principal&limit=5
  app.get('/matches/next', async (request, reply) => {
    const { category, limit } = request.query as { category?: string; limit?: string };
    const matches = await prisma.match.findMany({
      where: {
        status: 'SCHEDULED',
        date: { gte: new Date() },
        ...(category && { competition: { category: { slug: category } } }),
      },
      include: matchInclude,
      orderBy: { date: 'asc' },
      take: limit ? Math.min(Number(limit), 50) : 5,
    });
    return reply.send(matches);
  });

  // GET /api/matches/recent?category=principal&limit=5
  app.get('/matches/recent', async (request, reply) => {
    const { category, limit } = request.query as { category?: string; limit?: string };
    const matches = await prisma.match.findMany({
      where: {
        status: 'FINISHED',
        ...(category && { competition: { category: { slug: category } } }),
      },
      include: matchInclude,
      orderBy: { date: 'desc' },
      take: limit ? Math.min(Number(limit), 50) : 5,
    });
    return reply.send(matches);
  });
}

export async function matchesAdminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireApiKey);

  app.get('/matches', async (request, reply) => {
    const { page = '1', limit = '20' } = request.query as any;
    const take = Math.min(Number(limit) || 20, 100);
    const skip = (Number(page) - 1) * take;

    const [data, total] = await Promise.all([
      prisma.match.findMany({ include: matchInclude, orderBy: { date: 'desc' }, skip, take }),
      prisma.match.count(),
    ]);
    return reply.send({ data, total, page: Number(page), limit: take });
  });

  app.post('/matches', async (request, reply) => {
    const body = request.body as any;
    if (!body.competitionId || !body.opponentId || !body.date) {
      return reply.code(422).send({ error: 'Campos obrigatórios: competitionId, opponentId, date.' });
    }
    const match = await prisma.match.create({
      data: {
        competitionId: body.competitionId,
        opponentId: body.opponentId,
        date: new Date(body.date),
        venue: body.venue,
        isHome: body.isHome ?? true,
        status: body.status ?? 'SCHEDULED',
        homeScore: body.homeScore !== undefined ? Number(body.homeScore) : undefined,
        awayScore: body.awayScore !== undefined ? Number(body.awayScore) : undefined,
        round: body.round,
      },
      include: matchInclude,
    });
    return reply.code(201).send(match);
  });

  app.patch('/matches/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const match = await prisma.match.update({
      where: { id },
      data: {
        ...(body.competitionId && { competitionId: body.competitionId }),
        ...(body.opponentId && { opponentId: body.opponentId }),
        ...(body.date && { date: new Date(body.date) }),
        ...(body.venue !== undefined && { venue: body.venue }),
        ...(body.isHome !== undefined && { isHome: Boolean(body.isHome) }),
        ...(body.status && { status: body.status }),
        ...(body.homeScore !== undefined && { homeScore: body.homeScore === null ? null : Number(body.homeScore) }),
        ...(body.awayScore !== undefined && { awayScore: body.awayScore === null ? null : Number(body.awayScore) }),
        ...(body.round !== undefined && { round: body.round }),
      },
      include: matchInclude,
    });
    return reply.send(match);
  });

  app.delete('/matches/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.match.delete({ where: { id } });
    return reply.send({ message: 'Partida deletada.' });
  });
}
