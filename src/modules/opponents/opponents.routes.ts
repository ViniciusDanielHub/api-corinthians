// src/modules/opponents/opponents.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../shared/database/prisma';
import { requireAdminAuth } from '../../shared/plugins/admin-auth.plugin';
import { createUploadHandler } from '../../shared/plugins/upload.plugin';
import { deleteImageSafe } from '../../shared/services/cloudinary';

const uploadOpponentLogo = createUploadHandler('opponents');

export async function opponentsPublicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/opponents', async (_req, reply) => {
    const opponents = await prisma.opponent.findMany({ orderBy: { name: 'asc' } });
    return reply.send(opponents);
  });
}

export async function opponentsAdminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAdminAuth);

  // POST /api/admin/opponents — multipart/form-data: campos "name" + arquivo "logo"
  app.post('/opponents', { preHandler: [uploadOpponentLogo] }, async (request, reply) => {
    const body = request.body as any;
    const uploadedFile = (request as any).uploadedFile as { path: string } | undefined;

    if (!body.name) return reply.code(422).send({ error: 'O campo "name" é obrigatório.' });

    const opponent = await prisma.opponent.upsert({
      where: { name: body.name.trim() },
      update: { ...(uploadedFile && { logoUrl: uploadedFile.path }) },
      create: { name: body.name.trim(), logoUrl: uploadedFile?.path },
    });
    return reply.code(201).send(opponent);
  });

  app.patch('/opponents/:id', { preHandler: [uploadOpponentLogo] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const uploadedFile = (request as any).uploadedFile as { path: string } | undefined;

    if (uploadedFile) {
      const existing = await prisma.opponent.findUnique({ where: { id } });
      if (existing?.logoUrl) await deleteImageSafe(existing.logoUrl);
    }

    const opponent = await prisma.opponent.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name.trim() }),
        ...(uploadedFile && { logoUrl: uploadedFile.path }),
      },
    });
    return reply.send(opponent);
  });

  app.delete('/opponents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const opponent = await prisma.opponent.findUnique({ where: { id } });
    if (opponent?.logoUrl) await deleteImageSafe(opponent.logoUrl);
    await prisma.opponent.delete({ where: { id } });
    return reply.send({ message: 'Adversário deletado.' });
  });
}