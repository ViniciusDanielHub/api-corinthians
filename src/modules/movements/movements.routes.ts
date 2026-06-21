// src/modules/movements/movements.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../shared/database/prisma';
import { requireApiKey } from '../../shared/plugins/api-key.plugin';
import type { MovementType } from '@prisma/client';

// Includes reutilizados para evitar duplicação
const movementInclude = {
  squadMember: {
    select: {
      id: true,
      name: true,
      photoUrl: true,
      shirtNumber: true,
      category: { select: { id: true, name: true, slug: true } },
    },
  },
  club: { select: { id: true, name: true, logoUrl: true } }, // clube externo (origem ou destino, depende do type)
} as const;

// ── Rotas públicas ─────────────────────────────────────────────────────────

export async function movementsPublicRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/movements/recent?limit=10&type=ARRIVAL
   * Últimas movimentações do clube (para página de transferências, home etc.)
   */
  app.get('/movements/recent', async (request, reply) => {
    const { limit, type } = request.query as { limit?: string; type?: string };

    const movements = await prisma.playerMovement.findMany({
      where: {
        ...(type && { type: type as MovementType }),
      },
      include: movementInclude,
      orderBy: { date: 'desc' },
      take: limit ? Math.min(Number(limit), 50) : 10,
    });

    return reply.send(movements);
  });

  /**
   * GET /api/squad/:squadMemberId/movements
   * Histórico de movimentações de um jogador específico.
   * Rota pública pois o jogador já é público via /api/squad.
   */
  app.get('/squad/:squadMemberId/movements', async (request, reply) => {
    const { squadMemberId } = request.params as { squadMemberId: string };

    const movements = await prisma.playerMovement.findMany({
      where: { squadMemberId },
      include: movementInclude,
      orderBy: { date: 'desc' },
    });

    return reply.send(movements);
  });
}

// ── Rotas admin ────────────────────────────────────────────────────────────

export async function movementsAdminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireApiKey);

  /**
   * GET /api/admin/movements?page=1&limit=20&squadMemberId=<id>
   * Lista paginada de movimentações.
   */
  app.get('/movements', async (request, reply) => {
    const { page = '1', limit = '20', squadMemberId } = request.query as {
      page?: string;
      limit?: string;
      squadMemberId?: string;
    };

    const take = Math.min(Number(limit) || 20, 100);
    const skip = (Number(page) - 1) * take;

    const [data, total] = await Promise.all([
      prisma.playerMovement.findMany({
        where: { ...(squadMemberId && { squadMemberId }) },
        include: movementInclude,
        orderBy: { date: 'desc' },
        skip,
        take,
      }),
      prisma.playerMovement.count({
        where: { ...(squadMemberId && { squadMemberId }) },
      }),
    ]);

    return reply.send({ data, total, page: Number(page), limit: take });
  });

  /**
   * POST /api/admin/movements
   * Registra uma movimentação (contratação, venda, empréstimo ou retorno).
   * clubId é opcional — fica nulo em RETURN (jogador só voltou pro próprio clube).
   */
  app.post('/movements', async (request, reply) => {
    const body = request.body as any;

    if (!body.squadMemberId || !body.type || !body.date) {
      return reply.code(422).send({
        error: 'Campos obrigatórios: squadMemberId, type, date.',
      });
    }

    const VALID_TYPES: MovementType[] = ['ARRIVAL', 'DEPARTURE', 'LOAN_OUT', 'LOAN_IN', 'RETURN'];
    if (!VALID_TYPES.includes(body.type)) {
      return reply.code(422).send({
        error: `Tipo inválido. Valores aceitos: ${VALID_TYPES.join(', ')}.`,
      });
    }

    const movement = await prisma.playerMovement.create({
      data: {
        squadMemberId: body.squadMemberId,
        type: body.type as MovementType,
        date: new Date(body.date),
        clubId: body.clubId ?? null,
        notes: body.notes ?? null,
      },
      include: movementInclude,
    });

    return reply.code(201).send(movement);
  });

  /**
   * PATCH /api/admin/movements/:id
   * Atualiza uma movimentação existente.
   */
  app.patch('/movements/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const VALID_TYPES: MovementType[] = ['ARRIVAL', 'DEPARTURE', 'LOAN_OUT', 'LOAN_IN', 'RETURN'];
    if (body.type && !VALID_TYPES.includes(body.type)) {
      return reply.code(422).send({
        error: `Tipo inválido. Valores aceitos: ${VALID_TYPES.join(', ')}.`,
      });
    }

    const movement = await prisma.playerMovement.update({
      where: { id },
      data: {
        ...(body.type && { type: body.type as MovementType }),
        ...(body.date && { date: new Date(body.date) }),
        ...(body.clubId !== undefined && { clubId: body.clubId }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
      include: movementInclude,
    });

    return reply.send(movement);
  });

  /**
   * DELETE /api/admin/movements/:id
   * Remove uma movimentação do histórico.
   */
  app.delete('/movements/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.playerMovement.delete({ where: { id } });
    return reply.send({ message: 'Movimentação deletada.' });
  });
}