// src/modules/team/team.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../shared/database/prisma';
import { requireApiKey } from '../../shared/plugins/api-key.plugin';
import { createUploadHandler } from '../../shared/plugins/upload.plugin';
import { deleteImageSafe } from '../../shared/services/cloudinary';

const uploadLogo = createUploadHandler('logos');

export async function teamPublicRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/team
  app.get('/team', async (_req, reply) => {
    const team = await prisma.team.findUnique({ where: { id: 'main' } });
    return reply.send(team);
  });
}

export async function teamAdminRoutes(app: FastifyInstance): Promise<void> {
  // PATCH /api/admin/team — multipart/form-data, campo de arquivo "logo"
  app.patch(
    '/team',
    { preHandler: [requireApiKey, uploadLogo] },
    async (request, reply) => {
      const body = request.body as any;
      const uploadedFile = (request as any).uploadedFile as { path: string } | undefined;

      if (uploadedFile) {
        const existing = await prisma.team.findUnique({ where: { id: 'main' } });
        if (existing?.logoUrl) await deleteImageSafe(existing.logoUrl);
      }

      const team = await prisma.team.upsert({
        where: { id: 'main' },
        update: {
          name: body.name,
          shortName: body.shortName,
          ...(uploadedFile && { logoUrl: uploadedFile.path }),
          foundedYear: body.foundedYear ? Number(body.foundedYear) : undefined,
          stadium: body.stadium,
          city: body.city,
          website: body.website,
        },
        create: {
          id: 'main',
          name: body.name ?? 'Meu Clube',
          shortName: body.shortName,
          logoUrl: uploadedFile?.path,
          foundedYear: body.foundedYear ? Number(body.foundedYear) : undefined,
          stadium: body.stadium,
          city: body.city,
          website: body.website,
        },
      });
      return reply.send(team);
    },
  );
}