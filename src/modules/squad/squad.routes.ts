// src/modules/squad/squad.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../shared/database/prisma';
import { requireAdminAuth } from '../../shared/plugins/admin-auth.plugin';
import { createUploadHandler } from '../../shared/plugins/upload.plugin';
import { deleteImageSafe } from '../../shared/services/cloudinary';
import { Validator } from '../../shared/validation';

const uploadPlayerPhoto = createUploadHandler('players');

const VALID_POSITIONS = [
  'Goleiro', 'Lateral Direito', 'Lateral Esquerdo', 'Zagueiro',
  'Volante', 'Meia', 'Meia-atacante', 'Ponta Direita', 'Ponta Esquerda',
  'Centroavante', 'Atacante',
] as const;

export async function squadPublicRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/squad?category=sub-20
  app.get('/squad', async (request, reply) => {
    const { category } = request.query as { category?: string };

    if (!category || category.trim() === '') {
      return reply.code(422).send({
        error: 'O parâmetro "category" (slug da categoria) é obrigatório.',
        hint: 'Use GET /api/categories para listar as categorias e seus slugs.',
        example: '/api/squad?category=principal',
      });
    }

    // Verifica se a categoria existe para dar erro descritivo
    const categoryRecord = await prisma.category.findUnique({
      where: { slug: category },
      select: { id: true, name: true, isActive: true },
    });

    if (!categoryRecord) {
      return reply.code(404).send({
        error: `Categoria com slug "${category}" não encontrada.`,
        hint: 'Use GET /api/categories para listar as categorias disponíveis.',
      });
    }

    if (!categoryRecord.isActive) {
      return reply.code(404).send({
        error: `A categoria "${categoryRecord.name}" está inativa.`,
      });
    }

    const players = await prisma.squadMember.findMany({
      where: { isActive: true, category: { slug: category } },
      orderBy: [{ shirtNumber: 'asc' }, { name: 'asc' }],
    });
    return reply.send(players);
  });
}

export async function squadAdminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAdminAuth);

  // GET /api/admin/squad?categoryId=... — inclui inativos
  app.get('/squad', async (request, reply) => {
    const { categoryId } = request.query as { categoryId?: string };
    const players = await prisma.squadMember.findMany({
      where: { ...(categoryId && { categoryId }) },
      orderBy: [{ shirtNumber: 'asc' }, { name: 'asc' }],
    });
    return reply.send(players);
  });

  // POST /api/admin/squad
  app.post('/squad', { preHandler: [uploadPlayerPhoto] }, async (request, reply) => {
    const body = request.body as any;
    const uploadedFile = (request as any).uploadedFile as { path: string } | undefined;

    try {
      new Validator()
        .required('categoryId', body?.categoryId, 'categoria')
        .required('name', body?.name, 'nome')
        .string('name', body?.name, { min: 2, max: 100, label: 'nome' })
        .string('position', body?.position, { max: 60, label: 'posição' })
        .integer('shirtNumber', body?.shirtNumber, { min: 1, max: 99, label: 'número da camisa' })
        .isoDate('birthDate', body?.birthDate, 'data de nascimento')
        .throw();

      // Verifica se a categoria existe
      const category = await prisma.category.findUnique({ where: { id: body.categoryId } });
      if (!category) {
        return reply.code(422).send({
          error: `Categoria com ID "${body.categoryId}" não encontrada.`,
          field: 'categoryId',
          hint: 'Use GET /api/admin/categories para listar as categorias.',
        });
      }

      // Bloqueia número de camisa já em uso por outro jogador ativo
      // na MESMA categoria (times diferentes podem repetir números livremente).
      if (body.shirtNumber !== undefined) {
        const shirtConflict = await prisma.squadMember.findFirst({
          where: {
            categoryId: body.categoryId,
            shirtNumber: Number(body.shirtNumber),
            isActive: true,
          },
          select: { id: true, name: true },
        });
        if (shirtConflict) {
          return reply.code(409).send({
            error: `O número de camisa ${body.shirtNumber} já está em uso por "${shirtConflict.name}" nesta categoria.`,
            field: 'shirtNumber',
            conflictId: shirtConflict.id,
            hint: 'Escolha outro número ou desative/atualize o jogador atual antes de reutilizá-lo.',
          });
        }
      }

      // Valida data de nascimento razoável (entre 1940 e hoje)
      if (body.birthDate) {
        const birthDate = new Date(body.birthDate);
        const minYear = 1940;
        const maxDate = new Date();
        if (birthDate.getFullYear() < minYear || birthDate > maxDate) {
          return reply.code(422).send({
            error: `Data de nascimento inválida. Deve estar entre ${minYear} e hoje.`,
            field: 'birthDate',
            received: body.birthDate,
          });
        }
      }

      const player = await prisma.squadMember.create({
        data: {
          categoryId: body.categoryId,
          name: body.name.trim(),
          position: body.position?.trim() ?? null,
          shirtNumber: body.shirtNumber !== undefined ? Number(body.shirtNumber) : null,
          photoUrl: uploadedFile?.path ?? null,
          birthDate: body.birthDate ? new Date(body.birthDate) : null,
        },
      });
      return reply.code(201).send(player);
    } catch (err) {
      if (uploadedFile) await deleteImageSafe(uploadedFile.path);
      throw err;
    }
  });

  // PATCH /api/admin/squad/:id
  app.patch('/squad/:id', { preHandler: [uploadPlayerPhoto] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const uploadedFile = (request as any).uploadedFile as { path: string } | undefined;

    const hasFields = body && Object.keys(body).length > 0;
    if (!hasFields && !uploadedFile) {
      return reply.code(422).send({
        error: 'Nenhum campo enviado para atualização.',
        hint: 'Envie ao menos um campo: name, position, shirtNumber, birthDate ou isActive.',
      });
    }

    new Validator()
      .string('name', body?.name, { min: 2, max: 100, label: 'nome' })
      .string('position', body?.position, { max: 60, label: 'posição' })
      .integer('shirtNumber', body?.shirtNumber, { min: 1, max: 99, label: 'número da camisa' })
      .isoDate('birthDate', body?.birthDate, 'data de nascimento')
      .boolean('isActive', body?.isActive, 'ativo')
      .throw();

    try {
      if (body?.birthDate) {
        const birthDate = new Date(body.birthDate);
        if (birthDate.getFullYear() < 1940 || birthDate > new Date()) {
          return reply.code(422).send({
            error: 'Data de nascimento inválida. Deve estar entre 1940 e hoje.',
            field: 'birthDate',
          });
        }
      }

      // Se o número de camisa está sendo definido/alterado, ou o jogador está
      // sendo (re)ativado, revalida o conflito dentro da mesma categoria.
      const willBeActive = body?.isActive !== undefined ? Boolean(body.isActive) : undefined;
      if (body?.shirtNumber !== undefined && body.shirtNumber !== null || willBeActive === true) {
        const current = await prisma.squadMember.findUnique({
          where: { id },
          select: { categoryId: true, shirtNumber: true, isActive: true },
        });
        if (current) {
          const effectiveShirt = body?.shirtNumber !== undefined ? Number(body.shirtNumber) : current.shirtNumber;
          const effectiveActive = willBeActive ?? current.isActive;

          if (effectiveShirt !== null && effectiveActive) {
            const shirtConflict = await prisma.squadMember.findFirst({
              where: {
                categoryId: current.categoryId,
                shirtNumber: effectiveShirt,
                isActive: true,
                NOT: { id },
              },
              select: { id: true, name: true },
            });
            if (shirtConflict) {
              return reply.code(409).send({
                error: `O número de camisa ${effectiveShirt} já está em uso por "${shirtConflict.name}" nesta categoria.`,
                field: 'shirtNumber',
                conflictId: shirtConflict.id,
              });
            }
          }
        }
      }

      if (uploadedFile) {
        const existing = await prisma.squadMember.findUnique({ where: { id } });
        if (existing?.photoUrl) await deleteImageSafe(existing.photoUrl);
      }

      const player = await prisma.squadMember.update({
        where: { id },
        data: {
          ...(body?.name && { name: body.name.trim() }),
          ...(body?.position !== undefined && { position: body.position?.trim() ?? null }),
          ...(body?.shirtNumber !== undefined && {
            shirtNumber: body.shirtNumber === null ? null : Number(body.shirtNumber),
          }),
          ...(uploadedFile && { photoUrl: uploadedFile.path }),
          ...(body?.birthDate !== undefined && {
            birthDate: body.birthDate ? new Date(body.birthDate) : null,
          }),
          ...(body?.isActive !== undefined && { isActive: Boolean(body.isActive) }),
        },
      });
      return reply.send(player);
    } catch (err) {
      if (uploadedFile) await deleteImageSafe(uploadedFile.path);
      throw err;
    }
  });

  // DELETE /api/admin/squad/:id
  app.delete('/squad/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    // Avisa sobre movimentações vinculadas
    const movementsCount = await prisma.playerMovement.count({ where: { squadMemberId: id } });
    if (movementsCount > 0) {
      return reply.code(409).send({
        error: 'Não é possível deletar este jogador pois ele possui movimentações registradas.',
        dependents: { movements: movementsCount },
        hint: 'Desative o jogador (isActive: false) em vez de deletar para preservar o histórico.',
      });
    }

    const player = await prisma.squadMember.findUnique({ where: { id } });
    if (player?.photoUrl) await deleteImageSafe(player.photoUrl);
    await prisma.squadMember.delete({ where: { id } });
    return reply.send({ message: 'Jogador deletado com sucesso.' });
  });
}