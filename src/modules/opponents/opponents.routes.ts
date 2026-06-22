// src/modules/opponents/opponents.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../shared/database/prisma';
import { requireAdminAuth } from '../../shared/plugins/admin-auth.plugin';
import { createUploadHandler } from '../../shared/plugins/upload.plugin';
import { deleteImageSafe } from '../../shared/services/cloudinary';
import { Validator } from '../../shared/validation';

const uploadOpponentLogo = createUploadHandler('opponents');

export async function opponentsPublicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/opponents', async (_req, reply) => {
    const opponents = await prisma.opponent.findMany({ orderBy: { name: 'asc' } });
    return reply.send(opponents);
  });
}

export async function opponentsAdminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAdminAuth);

  // POST /api/admin/opponents
  app.post('/opponents', { preHandler: [uploadOpponentLogo] }, async (request, reply) => {
    const body = request.body as any;
    const uploadedFile = (request as any).uploadedFile as { path: string } | undefined;

    new Validator()
      .required('name', body?.name, 'nome do adversário')
      .string('name', body?.name, { min: 2, max: 100, label: 'nome do adversário' })
      .throw();

    const opponent = await prisma.opponent.upsert({
      where: { name: body.name.trim() },
      update: { ...(uploadedFile && { logoUrl: uploadedFile.path }) },
      create: { name: body.name.trim(), logoUrl: uploadedFile?.path ?? null },
    });
    return reply.code(201).send(opponent);
  });

  app.patch('/opponents/:id', { preHandler: [uploadOpponentLogo] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const uploadedFile = (request as any).uploadedFile as { path: string } | undefined;

    const hasFields = body && Object.keys(body).length > 0;
    if (!hasFields && !uploadedFile) {
      return reply.code(422).send({
        error: 'Nenhum campo enviado para atualização.',
        hint: 'Envie "name" no corpo ou um arquivo de logo.',
      });
    }

    if (body?.name) {
      new Validator()
        .string('name', body.name, { min: 2, max: 100, label: 'nome do adversário' })
        .throw();

      // Verifica conflito de nome com outro adversário
      const conflict = await prisma.opponent.findFirst({
        where: { name: body.name.trim(), NOT: { id } },
      });
      if (conflict) {
        return reply.code(409).send({
          error: `Já existe um adversário com o nome "${body.name.trim()}".`,
          conflictId: conflict.id,
        });
      }
    }

    if (uploadedFile) {
      const existing = await prisma.opponent.findUnique({ where: { id } });
      if (existing?.logoUrl) await deleteImageSafe(existing.logoUrl);
    }

    const opponent = await prisma.opponent.update({
      where: { id },
      data: {
        ...(body?.name && { name: body.name.trim() }),
        ...(uploadedFile && { logoUrl: uploadedFile.path }),
      },
    });
    return reply.send(opponent);
  });

  app.delete('/opponents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const matchesCount = await prisma.match.count({ where: { opponentId: id } });
    if (matchesCount > 0) {
      return reply.code(409).send({
        error: 'Não é possível deletar este adversário pois ele possui partidas vinculadas.',
        dependents: { matches: matchesCount },
        hint: 'Remova as partidas vinculadas antes de deletar o adversário.',
      });
    }

    const opponent = await prisma.opponent.findUnique({ where: { id } });
    if (opponent?.logoUrl) await deleteImageSafe(opponent.logoUrl);
    await prisma.opponent.delete({ where: { id } });
    return reply.send({ message: 'Adversário deletado com sucesso.' });
  });
}