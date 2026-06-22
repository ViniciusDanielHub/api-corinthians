// src/modules/squad/squad.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../shared/database/prisma';
import { requireAdminAuth } from '../../shared/plugins/admin-auth.plugin';
import { createUploadHandler } from '../../shared/plugins/upload.plugin';
import { deleteImageSafe } from '../../shared/services/cloudinary';

const uploadPlayerPhoto = createUploadHandler('players');

export async function squadPublicRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/squad?category=sub-20  (slug da categoria)
  app.get('/squad', async (request, reply) => {
    const { category } = request.query as { category?: string };

    if (!category) {
      return reply.code(422).send({ error: 'O parâmetro "category" (slug) é obrigatório.' });
    }

    const players = await prisma.squadMember.findMany({
      where: {
        isActive: true,
        category: { slug: category },
      },
      orderBy: [{ shirtNumber: 'asc' }, { name: 'asc' }],
    });
    return reply.send(players);
  });
}

export async function squadAdminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAdminAuth);

  // GET /api/admin/squad?categoryId=...  — inclui inativos
  app.get('/squad', async (request, reply) => {
    const { categoryId } = request.query as { categoryId?: string };
    const players = await prisma.squadMember.findMany({
      where: { ...(categoryId && { categoryId }) },
      orderBy: [{ shirtNumber: 'asc' }, { name: 'asc' }],
    });
    return reply.send(players);
  });

  // POST /api/admin/squad — multipart/form-data: campos + arquivo "photo"
  app.post('/squad', { preHandler: [uploadPlayerPhoto] }, async (request, reply) => {
    const body = request.body as any;
    const uploadedFile = (request as any).uploadedFile as { path: string } | undefined;

    if (!body.categoryId || !body.name) {
      return reply.code(422).send({ error: 'Campos obrigatórios: categoryId, name.' });
    }

    const player = await prisma.squadMember.create({
      data: {
        categoryId: body.categoryId,
        name: body.name.trim(),
        position: body.position,
        shirtNumber: body.shirtNumber !== undefined ? Number(body.shirtNumber) : undefined,
        photoUrl: uploadedFile?.path,
        birthDate: body.birthDate ? new Date(body.birthDate) : undefined,
      },
    });
    return reply.code(201).send(player);
  });

  // PATCH /api/admin/squad/:id
  app.patch('/squad/:id', { preHandler: [uploadPlayerPhoto] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const uploadedFile = (request as any).uploadedFile as { path: string } | undefined;

    if (uploadedFile) {
      const existing = await prisma.squadMember.findUnique({ where: { id } });
      if (existing?.photoUrl) await deleteImageSafe(existing.photoUrl);
    }

    const player = await prisma.squadMember.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name.trim() }),
        ...(body.position !== undefined && { position: body.position }),
        ...(body.shirtNumber !== undefined && {
          shirtNumber: body.shirtNumber === null ? null : Number(body.shirtNumber),
        }),
        ...(uploadedFile && { photoUrl: uploadedFile.path }),
        ...(body.birthDate !== undefined && {
          birthDate: body.birthDate ? new Date(body.birthDate) : null,
        }),
        ...(body.isActive !== undefined && { isActive: Boolean(body.isActive) }),
      },
    });
    return reply.send(player);
  });

  // DELETE /api/admin/squad/:id
  app.delete('/squad/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const player = await prisma.squadMember.findUnique({ where: { id } });
    if (player?.photoUrl) await deleteImageSafe(player.photoUrl);
    await prisma.squadMember.delete({ where: { id } });
    return reply.send({ message: 'Jogador deletado.' });
  });
}
