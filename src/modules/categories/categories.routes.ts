// src/modules/categories/categories.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../shared/database/prisma';
import { requireAdminAuth } from '../../shared/plugins/admin-auth.plugin';
import { Validator, VALID_GENDERS, VALID_MODALITIES } from '../../shared/validation';
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

    if (!slug || slug.trim() === '') {
      return reply.code(400).send({ error: 'O parâmetro "slug" não pode ser vazio.' });
    }

    const category = await prisma.category.findUnique({ where: { slug } });
    if (!category) {
      return reply.code(404).send({
        error: `Categoria com slug "${slug}" não encontrada.`,
        hint: 'Use GET /api/categories para listar as categorias disponíveis.',
      });
    }
    return reply.send(category);
  });
}

export async function categoriesAdminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAdminAuth);

  // GET /api/admin/categories — inclui inativas
  app.get('/categories', async (_req, reply) => {
    const categories = await prisma.category.findMany({ orderBy: { order: 'asc' } });
    return reply.send(categories);
  });

  // POST /api/admin/categories
  app.post('/categories', async (request, reply) => {
    const body = request.body as any;

    new Validator()
      .required('name', body?.name, 'nome')
      .string('name', body?.name, { min: 2, max: 80, label: 'nome' })
      .oneOf('gender', body?.gender, VALID_GENDERS, 'gênero')
      .oneOf('modality', body?.modality, VALID_MODALITIES, 'modalidade')
      .integer('order', body?.order, { min: 0, max: 9999, label: 'ordem' })
      .throw();

    const slug = toSlug(body.name);

    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) {
      return reply.code(409).send({
        error: `Já existe uma categoria com o nome "${body.name.trim()}" (slug: "${slug}").`,
        hint: 'Escolha um nome diferente ou reative a categoria existente.',
        existingId: existing.id,
      });
    }

    const category = await prisma.category.create({
      data: {
        name: body.name.trim(),
        slug,
        gender: body.gender ?? 'MALE',
        modality: body.modality ?? 'FOOTBALL',
        order: body.order !== undefined ? Number(body.order) : 0,
      },
    });
    return reply.code(201).send(category);
  });

  // PATCH /api/admin/categories/:id
  app.patch('/categories/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    if (!body || Object.keys(body).length === 0) {
      return reply.code(422).send({
        error: 'Nenhum campo enviado para atualização.',
        hint: 'Envie ao menos um campo: name, gender, modality, order ou isActive.',
      });
    }

    new Validator()
      .string('name', body.name, { min: 2, max: 80, label: 'nome' })
      .oneOf('gender', body.gender, VALID_GENDERS, 'gênero')
      .oneOf('modality', body.modality, VALID_MODALITIES, 'modalidade')
      .integer('order', body.order, { min: 0, max: 9999, label: 'ordem' })
      .boolean('isActive', body.isActive, 'ativo')
      .throw();

    // Garante que o novo nome não conflita com outra categoria
    if (body.name) {
      const newSlug = toSlug(body.name);
      const conflict = await prisma.category.findFirst({
        where: { slug: newSlug, NOT: { id } },
      });
      if (conflict) {
        return reply.code(409).send({
          error: `Já existe outra categoria com o nome "${body.name.trim()}" (slug: "${newSlug}").`,
          conflictId: conflict.id,
        });
      }
    }

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

    // Avisa sobre dependências antes de tentar deletar (FK CASCADE)
    const [competitionsCount, squadCount] = await Promise.all([
      prisma.competition.count({ where: { categoryId: id } }),
      prisma.squadMember.count({ where: { categoryId: id } }),
    ]);

    if (competitionsCount > 0 || squadCount > 0) {
      return reply.code(409).send({
        error: 'Não é possível deletar esta categoria pois ela possui registros dependentes.',
        dependents: {
          competitions: competitionsCount,
          squadMembers: squadCount,
        },
        hint: 'Desative a categoria (isActive: false) ou remova os registros dependentes antes de deletar.',
      });
    }

    await prisma.category.delete({ where: { id } });
    return reply.send({ message: 'Categoria deletada com sucesso.' });
  });
}