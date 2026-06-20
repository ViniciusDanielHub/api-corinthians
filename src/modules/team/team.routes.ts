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
  // SEGURANÇA: antes, a proteção de auth era passada manualmente como
  // preHandler só na rota PATCH ("preHandler: [requireApiKey, uploadLogo]"),
  // diferente de TODOS os outros módulos admin (categories, competitions,
  // opponents, matches, standings, squad), que usam
  // app.addHook('preHandler', requireApiKey) no nível do plugin.
  //
  // Essa inconsistência é perigosa: qualquer rota nova adicionada a este
  // arquivo no futuro (ex: DELETE /team, GET /team com dados sensíveis)
  // ficaria SEM autenticação por padrão, bastando o autor esquecer de
  // colar o preHandler manualmente. Usar addHook torna a proteção
  // automática para qualquer rota deste plugin, igual aos demais módulos.
  app.addHook('preHandler', requireApiKey);

  // PATCH /api/admin/team — multipart/form-data, campo de arquivo "logo"
  app.patch(
    '/team',
    { preHandler: [uploadLogo] },
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