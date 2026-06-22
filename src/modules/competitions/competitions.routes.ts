// src/modules/competitions/competitions.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../shared/database/prisma';
import { requireAdminAuth } from '../../shared/plugins/admin-auth.plugin';
import { Validator } from '../../shared/validation';

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
  app.addHook('preHandler', requireAdminAuth);

  app.get('/competitions', async (_req, reply) => {
    const competitions = await prisma.competition.findMany({
      include: { category: { select: { name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(competitions);
  });

  app.post('/competitions', async (request, reply) => {
    const body = request.body as any;

    new Validator()
      .required('name', body?.name, 'nome')
      .string('name', body?.name, { min: 2, max: 120, label: 'nome' })
      .required('season', body?.season, 'temporada')
      .string('season', body?.season, { min: 4, max: 20, label: 'temporada' })
      .required('categoryId', body?.categoryId, 'categoria')
      .throw();

    // Verifica se a categoria existe
    const category = await prisma.category.findUnique({ where: { id: body.categoryId } });
    if (!category) {
      return reply.code(422).send({
        error: `Categoria com ID "${body.categoryId}" não encontrada.`,
        field: 'categoryId',
        hint: 'Use GET /api/admin/categories para listar as categorias disponíveis.',
      });
    }

    // Verifica unicidade [categoryId + name + season]
    const conflict = await prisma.competition.findFirst({
      where: {
        categoryId: body.categoryId,
        name: body.name.trim(),
        season: String(body.season),
      },
    });
    if (conflict) {
      return reply.code(409).send({
        error: `Já existe uma competição "${body.name.trim()}" na temporada "${body.season}" para a categoria "${category.name}".`,
        hint: 'Altere o nome ou a temporada, ou reutilize a competição existente.',
        existingId: conflict.id,
      });
    }

    const competition = await prisma.competition.create({
      data: {
        name: body.name.trim(),
        season: String(body.season),
        categoryId: body.categoryId,
      },
    });
    return reply.code(201).send(competition);
  });

  app.patch('/competitions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    if (!body || Object.keys(body).length === 0) {
      return reply.code(422).send({
        error: 'Nenhum campo enviado para atualização.',
        hint: 'Envie ao menos um campo: name, season ou isActive.',
      });
    }

    new Validator()
      .string('name', body.name, { min: 2, max: 120, label: 'nome' })
      .string('season', body.season, { min: 4, max: 20, label: 'temporada' })
      .boolean('isActive', body.isActive, 'ativo')
      .throw();

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

    const matchesCount = await prisma.match.count({ where: { competitionId: id } });
    if (matchesCount > 0) {
      return reply.code(409).send({
        error: 'Não é possível deletar esta competição pois ela possui partidas vinculadas.',
        dependents: { matches: matchesCount },
        hint: 'Desative a competição (isActive: false) ou remova as partidas antes de deletar.',
      });
    }

    await prisma.competition.delete({ where: { id } });
    return reply.send({ message: 'Competição deletada com sucesso.' });
  });
}