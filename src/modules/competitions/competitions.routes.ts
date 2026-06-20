// src/modules/competitions/competitions.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../shared/database/prisma';
import { requireApiKey } from '../../shared/plugins/api-key.plugin';

export async function competitionsPublicRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/competitions?category=sub-20
  app.get('/competitions', async (request, reply) => {
    const { category } = request.query as { category?: string };
    const competitions = await prisma.competition.findMany({
      where: {
        isActive: true,
        ...(category && { category: { slug: category } }),
      },
      include: { category: { select: { name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(competitions);
  });
}

export async function competitionsAdminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireApiKey);

  app.get('/competitions', async (_req, reply) => {
    const competitions = await prisma.competition.findMany({
      include: { category: { select: { name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(competitions);
  });

  app.post('/competitions', async (request, reply) => {
    const body = request.body as any;
    if (!body.name || !body.season || !body.categoryId) {
      return reply.code(422).send({ error: 'Campos obrigatórios: name, season, categoryId.' });
    }
    const competition = await prisma.competition.create({
      data: { name: body.name.trim(), season: String(body.season), categoryId: body.categoryId },
    });
    return reply.code(201).send(competition);
  });

  app.patch('/competitions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const competition = await prisma.competition.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name.trim() }),
        ...(body.season && { season: String(body.season) }),
        ...(body.isActive !== undefined && { isActive: Boolean(body.isActive) }),
      },
    });
    return reply.send(competition);
  });

  app.delete('/competitions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.competition.delete({ where: { id } });
    return reply.send({ message: 'Competição deletada.' });
  });
}
