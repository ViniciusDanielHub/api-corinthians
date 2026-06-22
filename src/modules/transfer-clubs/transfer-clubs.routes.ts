// src/modules/transfer-clubs/transfer-clubs.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../shared/database/prisma';
import { requireAdminAuth } from '../../shared/plugins/admin-auth.plugin';
import { createUploadHandler } from '../../shared/plugins/upload.plugin';
import { deleteImageSafe } from '../../shared/services/cloudinary';

const uploadTransferClubLogo = createUploadHandler('transferClubs');

export async function transferClubsPublicRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/transfer-clubs — útil pro front mostrar logo "veio do X"
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

  // POST /api/admin/transfer-clubs — multipart/form-data: "name" + arquivo "logo"
  // Upsert por nome: se o clube já existe, reaproveita o registro (e atualiza
  // o logo se um novo arquivo for enviado) em vez de duplicar.
  app.post('/transfer-clubs', { preHandler: [uploadTransferClubLogo] }, async (request, reply) => {
    const body = request.body as any;
    const uploadedFile = (request as any).uploadedFile as { path: string } | undefined;

    if (!body.name) return reply.code(422).send({ error: 'O campo "name" é obrigatório.' });

    const club = await prisma.transferClub.upsert({
      where: { name: body.name.trim() },
      update: { ...(uploadedFile && { logoUrl: uploadedFile.path }) },
      create: { name: body.name.trim(), logoUrl: uploadedFile?.path },
    });
    return reply.code(201).send(club);
  });

  app.patch('/transfer-clubs/:id', { preHandler: [uploadTransferClubLogo] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const uploadedFile = (request as any).uploadedFile as { path: string } | undefined;

    if (uploadedFile) {
      const existing = await prisma.transferClub.findUnique({ where: { id } });
      if (existing?.logoUrl) await deleteImageSafe(existing.logoUrl);
    }

    const club = await prisma.transferClub.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name.trim() }),
        ...(uploadedFile && { logoUrl: uploadedFile.path }),
      },
    });
    return reply.send(club);
  });

  app.delete('/transfer-clubs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const club = await prisma.transferClub.findUnique({ where: { id } });
    if (club?.logoUrl) await deleteImageSafe(club.logoUrl);
    await prisma.transferClub.delete({ where: { id } });
    return reply.send({ message: 'Clube de transferência deletado.' });
  });
}