// src/modules/categories/categories.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../shared/database/prisma';
import { requireApiKey } from '../../shared/plugins/api-key.plugin';
import slugify from 'slugify';

function toSlug(name: string): string {
  return slugify(name, { lower: true, strict: true, locale: 'pt', trim: true });
}

export async function categoriesPublicRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/categories
  app.get('/categories', async (_req, reply) => {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
    return reply.send(categories);
  });

  // GET /api/categories/:slug
  app.get('/categories/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const category = await prisma.category.findUnique({ where: { slug } });
    if (!category) return reply.code(404).send({ error: 'Categoria não encontrada.' });
    return reply.send(category);
  });
}

export async function categoriesAdminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireApiKey);

  // GET /api/admin/categories — inclui inativas
  app.get('/categories', async (_req, reply) => {
    const categories = await prisma.category.findMany({ orderBy: { order: 'asc' } });
    return reply.send(categories);
  });

  // POST /api/admin/categories
  app.post('/categories', async (request, reply) => {
    const body = request.body as any;
    if (!body.name) return reply.code(422).send({ error: 'O campo "name" é obrigatório.' });

    const category = await prisma.category.create({
      data: {
        name: body.name.trim(),
        slug: toSlug(body.name),
        gender: body.gender ?? 'MALE',
        modality: body.modality ?? 'FOOTBALL',
        order: body.order ?? 0,
      },
    });
    return reply.code(201).send(category);
  });

  // PATCH /api/admin/categories/:id
  app.patch('/categories/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name.trim(), slug: toSlug(body.name) }),
        ...(body.gender && { gender: body.gender }),
        ...(body.modality && { modality: body.modality }),
        ...(body.order !== undefined && { order: Number(body.order) }),
        ...(body.isActive !== undefined && { isActive: Boolean(body.isActive) }),
      },
    });
    return reply.send(category);
  });

  // DELETE /api/admin/categories/:id
  app.delete('/categories/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.category.delete({ where: { id } });
    return reply.send({ message: 'Categoria deletada.' });
  });
}
