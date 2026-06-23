// src/modules/team/team.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../shared/database/prisma';
import { requireAdminAuth } from '../../shared/plugins/admin-auth.plugin';
import { createUploadHandler } from '../../shared/plugins/upload.plugin';
import { deleteImageSafe } from '../../shared/services/cloudinary';
import { Validator } from '../../shared/validation';

const uploadLogo = createUploadHandler('logos');

export async function teamPublicRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/team
  app.get('/team', async (_req, reply) => {
    const team = await prisma.team.findUnique({ where: { id: 'main' } });
    if (!team) {
      return reply.code(404).send({
        error: 'Dados do time ainda não foram configurados.',
        hint: 'Use PATCH /api/admin/team para configurar as informações do clube.',
      });
    }
    return reply.send(team);
  });
}

export async function teamAdminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAdminAuth);

  // PATCH /api/admin/team
  app.patch(
    '/team',
    { preHandler: [uploadLogo] },
    async (request, reply) => {
      const body = request.body as any;
      const uploadedFile = (request as any).uploadedFile as { path: string } | undefined;

      const hasFields = body && Object.keys(body).length > 0;
      if (!hasFields && !uploadedFile) {
        return reply.code(422).send({
          error: 'Nenhum campo enviado para atualização.',
          hint: 'Envie ao menos um campo: name, shortName, foundedYear, stadium, city, website, ou um arquivo de logo.',
        });
      }

      // A partir daqui, qualquer erro (validação ou banco) precisa desfazer
      // o upload feito no preHandler — senão a imagem fica órfã no Cloudinary.
      try {
        new Validator()
          .string('name', body?.name, { min: 2, max: 120, label: 'nome do clube' })
          .string('shortName', body?.shortName, { max: 20, label: 'nome abreviado' })
          .year('foundedYear', body?.foundedYear, 'ano de fundação')
          .string('stadium', body?.stadium, { max: 120, label: 'estádio' })
          .string('city', body?.city, { max: 80, label: 'cidade' })
          .url('website', body?.website, 'site oficial')
          .throw();

        if (uploadedFile) {
          const existing = await prisma.team.findUnique({ where: { id: 'main' } });
          if (existing?.logoUrl) await deleteImageSafe(existing.logoUrl);
        }

        const team = await prisma.team.upsert({
          where: { id: 'main' },
          update: {
            ...(body?.name && { name: body.name.trim() }),
            ...(body?.shortName !== undefined && { shortName: body.shortName?.trim() ?? null }),
            ...(uploadedFile && { logoUrl: uploadedFile.path }),
            ...(body?.foundedYear !== undefined && {
              foundedYear: body.foundedYear ? Number(body.foundedYear) : null,
            }),
            ...(body?.stadium !== undefined && { stadium: body.stadium?.trim() ?? null }),
            ...(body?.city !== undefined && { city: body.city?.trim() ?? null }),
            ...(body?.website !== undefined && { website: body.website?.trim() ?? null }),
          },
          create: {
            id: 'main',
            name: body?.name?.trim() ?? 'Meu Clube',
            shortName: body?.shortName?.trim() ?? null,
            logoUrl: uploadedFile?.path ?? null,
            foundedYear: body?.foundedYear ? Number(body.foundedYear) : null,
            stadium: body?.stadium?.trim() ?? null,
            city: body?.city?.trim() ?? null,
            website: body?.website?.trim() ?? null,
          },
        });
        return reply.send(team);
      } catch (err) {
        if (uploadedFile) await deleteImageSafe(uploadedFile.path);
        throw err;
      }
    },
  );
}