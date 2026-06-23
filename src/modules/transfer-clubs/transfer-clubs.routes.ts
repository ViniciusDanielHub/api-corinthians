// src/modules/transfer-clubs/transfer-clubs.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../shared/database/prisma';
import { requireAdminAuth } from '../../shared/plugins/admin-auth.plugin';
import { createUploadHandler } from '../../shared/plugins/upload.plugin';
import { deleteImageSafe } from '../../shared/services/cloudinary';
import { Validator } from '../../shared/validation';

const uploadTransferClubLogo = createUploadHandler('transferClubs');

export async function transferClubsPublicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/transfer-clubs', async (_req, reply) => {
    const clubs = await prisma.transferClub.findMany({ orderBy: { name: 'asc' } });
    return reply.send(clubs);
  });
}

export async function transferClubsAdminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAdminAuth);

  app.get('/transfer-clubs', async (_req, reply) => {
    const clubs = await prisma.transferClub.findMany({ orderBy: { name: 'asc' } });
    return reply.send(clubs);
  });

  // POST /api/admin/transfer-clubs
  app.post('/transfer-clubs', { preHandler: [uploadTransferClubLogo] }, async (request, reply) => {
    const body = request.body as any;
    const uploadedFile = (request as any).uploadedFile as { path: string } | undefined;

    try {
      new Validator()
        .required('name', body?.name, 'nome do clube')
        .string('name', body?.name, { min: 2, max: 100, label: 'nome do clube' })
        .throw();

      const club = await prisma.transferClub.upsert({
        where: { name: body.name.trim() },
        update: { ...(uploadedFile && { logoUrl: uploadedFile.path }) },
        create: { name: body.name.trim(), logoUrl: uploadedFile?.path ?? null },
      });
      return reply.code(201).send(club);
    } catch (err) {
      if (uploadedFile) await deleteImageSafe(uploadedFile.path);
      throw err;
    }
  });

  app.patch('/transfer-clubs/:id', { preHandler: [uploadTransferClubLogo] }, async (request, reply) => {
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

    try {
      if (body?.name) {
        new Validator()
          .string('name', body.name, { min: 2, max: 100, label: 'nome do clube' })
          .throw();

        const conflict = await prisma.transferClub.findFirst({
          where: { name: body.name.trim(), NOT: { id } },
        });
        if (conflict) {
          return reply.code(409).send({
            error: `Já existe um clube com o nome "${body.name.trim()}".`,
            conflictId: conflict.id,
          });
        }
      }

      if (uploadedFile) {
        const existing = await prisma.transferClub.findUnique({ where: { id } });
        if (existing?.logoUrl) await deleteImageSafe(existing.logoUrl);
      }

      const club = await prisma.transferClub.update({
        where: { id },
        data: {
          ...(body?.name && { name: body.name.trim() }),
          ...(uploadedFile && { logoUrl: uploadedFile.path }),
        },
      });
      return reply.send(club);
    } catch (err) {
      if (uploadedFile) await deleteImageSafe(uploadedFile.path);
      throw err;
    }
  });

  app.delete('/transfer-clubs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const movementsCount = await prisma.playerMovement.count({ where: { clubId: id } });
    if (movementsCount > 0) {
      return reply.code(409).send({
        error: 'Não é possível deletar este clube pois ele está vinculado a movimentações.',
        dependents: { movements: movementsCount },
        hint: 'Remova as movimentações vinculadas ou deixe o registro para preservar o histórico.',
      });
    }

    const club = await prisma.transferClub.findUnique({ where: { id } });
    if (club?.logoUrl) await deleteImageSafe(club.logoUrl);
    await prisma.transferClub.delete({ where: { id } });
    return reply.send({ message: 'Clube de transferência deletado com sucesso.' });
  });
}