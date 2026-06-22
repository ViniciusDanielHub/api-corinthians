// src/modules/movements/movements.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../shared/database/prisma';
import { requireAdminAuth } from '../../shared/plugins/admin-auth.plugin';
import { Validator, sanitizePagination, VALID_MOVEMENT_TYPES } from '../../shared/validation';
import type { MovementType } from '@prisma/client';

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
  club: { select: { id: true, name: true, logoUrl: true } },
} as const;

// Tipos cujo clube de origem/destino faz sentido
const TYPES_WITH_CLUB: MovementType[] = ['ARRIVAL', 'DEPARTURE', 'LOAN_OUT', 'LOAN_IN'];
// Tipos que representam receita (entrada de caixa)
const INCOME_TYPES: MovementType[] = ['DEPARTURE', 'LOAN_OUT'];

export async function movementsPublicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/movements/recent', async (request, reply) => {
    const { limit, type } = request.query as { limit?: string; type?: string };

    if (type) {
      new Validator()
        .oneOf('type', type, VALID_MOVEMENT_TYPES, 'tipo de movimentação')
        .throw();
    }

    const take = limit ? Math.min(Math.max(Number(limit) || 10, 1), 50) : 10;

    const movements = await prisma.playerMovement.findMany({
      where: { ...(type && { type: type as MovementType }) },
      include: movementInclude,
      orderBy: { date: 'desc' },
      take,
    });
    return reply.send(movements);
  });

  app.get('/squad/:squadMemberId/movements', async (request, reply) => {
    const { squadMemberId } = request.params as { squadMemberId: string };

    // Verifica se o jogador existe antes de retornar lista vazia silenciosamente
    const player = await prisma.squadMember.findUnique({
      where: { id: squadMemberId },
      select: { id: true, name: true },
    });
    if (!player) {
      return reply.code(404).send({
        error: `Jogador com ID "${squadMemberId}" não encontrado.`,
        hint: 'Use GET /api/squad?category=<slug> para listar os jogadores disponíveis.',
      });
    }

    const movements = await prisma.playerMovement.findMany({
      where: { squadMemberId },
      include: movementInclude,
      orderBy: { date: 'desc' },
    });
    return reply.send(movements);
  });
}

export async function movementsAdminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAdminAuth);

  app.get('/movements', async (request, reply) => {
    const { page, limit, squadMemberId } = request.query as {
      page?: string; limit?: string; squadMemberId?: string;
    };

    const { skip, take, page: p } = sanitizePagination(page, limit, 100);

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
    return reply.send({ data, total, page: p, limit: take });
  });

  app.post('/movements', async (request, reply) => {
    const body = request.body as any;

    new Validator()
      .required('squadMemberId', body?.squadMemberId, 'jogador')
      .required('type', body?.type, 'tipo')
      .oneOf('type', body?.type, VALID_MOVEMENT_TYPES, 'tipo')
      .required('date', body?.date, 'data')
      .isoDate('date', body?.date, 'data')
      .string('notes', body?.notes, { max: 500, label: 'observações' })
      .currencyCode('currency', body?.currency)
      .throw();

    // Valor financeiro — opcional, mas se enviado deve ser centavos positivos
    if (body.valueCents !== undefined && body.valueCents !== null) {
      new Validator().centValue('valueCents', body.valueCents, 'valor em centavos').throw();
    }

    // RETURN normalmente não tem clube nem valor
    const type = body.type as MovementType;
    if (type === 'RETURN' && body.clubId) {
      return reply.code(422).send({
        error: 'Movimentações do tipo RETURN não devem ter clube associado.',
        hint: 'O campo "clubId" deve ser omitido ou nulo em retornos de empréstimo.',
        field: 'clubId',
      });
    }

    // Clube obrigatório para tipos que representam negociação
    if (TYPES_WITH_CLUB.includes(type) && !body.clubId) {
      return reply.code(422).send({
        error: `Movimentações do tipo "${type}" devem ter um clube associado.`,
        field: 'clubId',
        hint: 'Use GET /api/transfer-clubs para listar os clubes ou crie um novo em POST /api/admin/transfer-clubs.',
      });
    }

    // Verifica existência do jogador
    const player = await prisma.squadMember.findUnique({
      where: { id: body.squadMemberId },
      select: { id: true, name: true, isActive: true },
    });
    if (!player) {
      return reply.code(422).send({
        error: `Jogador com ID "${body.squadMemberId}" não encontrado.`,
        field: 'squadMemberId',
        hint: 'Use GET /api/admin/squad para listar os jogadores.',
      });
    }

    // Alerta se jogador estiver inativo (não bloqueia — pode ser movimento de saída)
    const warnings: string[] = [];
    if (!player.isActive && type === 'ARRIVAL') {
      warnings.push(`O jogador "${player.name}" está marcado como inativo. Considere reativá-lo após registrar a chegada.`);
    }

    // Verifica existência do clube de transferência se informado
    if (body.clubId) {
      const club = await prisma.transferClub.findUnique({ where: { id: body.clubId } });
      if (!club) {
        return reply.code(422).send({
          error: `Clube de transferência com ID "${body.clubId}" não encontrado.`,
          field: 'clubId',
          hint: 'Use GET /api/transfer-clubs para listar os clubes ou POST /api/admin/transfer-clubs para criar.',
        });
      }
    }

    const movement = await prisma.playerMovement.create({
      data: {
        squadMemberId: body.squadMemberId,
        type: body.type as MovementType,
        date: new Date(body.date),
        clubId: body.clubId ?? null,
        notes: body.notes?.trim() ?? null,
        ...(body.valueCents !== undefined && body.valueCents !== null && {
          valueCents: BigInt(String(body.valueCents)),
        }),
        ...(body.currency && { currency: body.currency.toUpperCase() }),
      },
      include: movementInclude,
    });

    return reply.code(201).send(warnings.length > 0 ? { ...movement, warnings } : movement);
  });

  app.patch('/movements/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    if (!body || Object.keys(body).length === 0) {
      return reply.code(422).send({
        error: 'Nenhum campo enviado para atualização.',
        hint: 'Envie ao menos um campo: type, date, clubId, notes, valueCents ou currency.',
      });
    }

    new Validator()
      .oneOf('type', body.type, VALID_MOVEMENT_TYPES, 'tipo')
      .isoDate('date', body.date, 'data')
      .string('notes', body.notes, { max: 500, label: 'observações' })
      .currencyCode('currency', body.currency)
      .throw();

    if (body.valueCents !== undefined && body.valueCents !== null) {
      new Validator().centValue('valueCents', body.valueCents, 'valor em centavos').throw();
    }

    // Se clube foi fornecido, verifica existência
    if (body.clubId) {
      const club = await prisma.transferClub.findUnique({ where: { id: body.clubId } });
      if (!club) {
        return reply.code(422).send({
          error: `Clube de transferência com ID "${body.clubId}" não encontrado.`,
          field: 'clubId',
        });
      }
    }

    const movement = await prisma.playerMovement.update({
      where: { id },
      data: {
        ...(body.type && { type: body.type as MovementType }),
        ...(body.date && { date: new Date(body.date) }),
        ...(body.clubId !== undefined && { clubId: body.clubId }),
        ...(body.notes !== undefined && { notes: body.notes?.trim() ?? null }),
        ...(body.valueCents !== undefined && {
          valueCents: body.valueCents === null ? null : BigInt(String(body.valueCents)),
        }),
        ...(body.currency && { currency: body.currency.toUpperCase() }),
      },
      include: movementInclude,
    });
    return reply.send(movement);
  });

  app.delete('/movements/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.playerMovement.delete({ where: { id } });
    return reply.send({ message: 'Movimentação deletada com sucesso.' });
  });
}