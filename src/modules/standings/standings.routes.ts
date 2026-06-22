// src/modules/standings/standings.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../shared/database/prisma';
import { requireAdminAuth } from '../../shared/plugins/admin-auth.plugin';
import { Validator, VALID_ZONES } from '../../shared/validation';

function withGoalDifference<T extends { goalsFor: number; goalsAgainst: number }>(row: T) {
  return { ...row, goalDifference: row.goalsFor - row.goalsAgainst };
}

function validateStandingRow(
  row: any,
  index?: number,
): { errors: { field: string; message: string; row?: number }[] } {
  const prefix = index !== undefined ? `[${index}].` : '';
  const v = new Validator();

  v.required(`${prefix}teamName`, row?.teamName, 'nome do time')
    .string(`${prefix}teamName`, row?.teamName, { min: 1, max: 100, label: 'nome do time' })
    .required(`${prefix}position`, row?.position, 'posição')
    .integer(`${prefix}position`, row?.position, { min: 1, max: 999, label: 'posição' })
    .integer(`${prefix}points`, row?.points, { min: 0, label: 'pontos' })
    .integer(`${prefix}played`, row?.played, { min: 0, label: 'jogos' })
    .integer(`${prefix}won`, row?.won, { min: 0, label: 'vitórias' })
    .integer(`${prefix}drawn`, row?.drawn, { min: 0, label: 'empates' })
    .integer(`${prefix}lost`, row?.lost, { min: 0, label: 'derrotas' })
    .integer(`${prefix}goalsFor`, row?.goalsFor, { min: 0, label: 'gols marcados' })
    .integer(`${prefix}goalsAgainst`, row?.goalsAgainst, { min: 0, label: 'gols sofridos' })
    .oneOf(`${prefix}zone`, row?.zone, VALID_ZONES, 'zona')
    .standingForm(`${prefix}form`, row?.form)
    .boolean(`${prefix}isOwnTeam`, row?.isOwnTeam, 'time do clube');

  // Consistência jogos (V + E + D = J)
  if (
    row?.won !== undefined &&
    row?.drawn !== undefined &&
    row?.lost !== undefined &&
    row?.played !== undefined
  ) {
    const sum = Number(row.won) + Number(row.drawn) + Number(row.lost);
    if (sum !== Number(row.played)) {
      v['errors'].push({
        field: `${prefix}played`,
        message: `Inconsistência: vitórias (${row.won}) + empates (${row.drawn}) + derrotas (${row.lost}) = ${sum}, mas jogos = ${row.played}.`,
      });
    }
  }

  return { errors: v.getErrors() };
}

export async function standingsPublicRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/standings/:competitionId
  app.get('/standings/:competitionId', async (request, reply) => {
    const { competitionId } = request.params as { competitionId: string };

    // Verifica existência da competição para feedback claro
    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      select: { id: true, name: true },
    });
    if (!competition) {
      return reply.code(404).send({
        error: `Competição com ID "${competitionId}" não encontrada.`,
        hint: 'Use GET /api/competitions para listar as competições disponíveis.',
      });
    }

    const table = await prisma.standingEntry.findMany({
      where: { competitionId },
      orderBy: { position: 'asc' },
    });
    return reply.send(table.map(withGoalDifference));
  });
}

export async function standingsAdminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAdminAuth);

  // POST /api/admin/standings — upsert por posição
  app.post('/standings', async (request, reply) => {
    const body = request.body as any;

    new Validator()
      .required('competitionId', body?.competitionId, 'competição')
      .throw();

    const { errors } = validateStandingRow(body);
    if (errors.length > 0) {
      return reply.code(422).send({ error: 'Dados inválidos.', details: errors });
    }

    // Verifica existência da competição
    const competition = await prisma.competition.findUnique({ where: { id: body.competitionId } });
    if (!competition) {
      return reply.code(422).send({
        error: `Competição com ID "${body.competitionId}" não encontrada.`,
        field: 'competitionId',
      });
    }

    const data = {
      teamName: body.teamName.trim(),
      logoUrl: body.logoUrl ?? null,
      points: body.points ?? 0,
      played: body.played ?? 0,
      won: body.won ?? 0,
      drawn: body.drawn ?? 0,
      lost: body.lost ?? 0,
      goalsFor: body.goalsFor ?? 0,
      goalsAgainst: body.goalsAgainst ?? 0,
      isOwnTeam: Boolean(body.isOwnTeam),
      form: body.form ?? null,
      zone: body.zone ?? 'NONE',
    };

    const entry = await prisma.standingEntry.upsert({
      where: {
        competitionId_position: {
          competitionId: body.competitionId,
          position: Number(body.position),
        },
      },
      update: data,
      create: { competitionId: body.competitionId, position: Number(body.position), ...data },
    });
    return reply.code(201).send(withGoalDifference(entry));
  });

  // PUT /api/admin/standings/:competitionId/bulk
  app.put('/standings/:competitionId/bulk', async (request, reply) => {
    const { competitionId } = request.params as { competitionId: string };
    const rows = request.body as any[];

    if (!Array.isArray(rows)) {
      return reply.code(422).send({
        error: 'O corpo da requisição deve ser um array de linhas da tabela.',
        hint: 'Envie um JSON array: [{ position, teamName, points, ... }, ...]',
      });
    }

    if (rows.length === 0) {
      return reply.code(422).send({ error: 'O array não pode ser vazio.' });
    }

    if (rows.length > 64) {
      return reply.code(422).send({
        error: `O array contém ${rows.length} linhas. O máximo permitido é 64.`,
      });
    }

    // Verifica existência da competição
    const competition = await prisma.competition.findUnique({ where: { id: competitionId } });
    if (!competition) {
      return reply.code(404).send({
        error: `Competição com ID "${competitionId}" não encontrada.`,
      });
    }

    // Valida todas as linhas e acumula erros
    const allErrors: { field: string; message: string; row: number }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const { errors } = validateStandingRow(rows[i], i);
      allErrors.push(...errors.map((e) => ({ ...e, row: i })));
    }

    if (allErrors.length > 0) {
      return reply.code(422).send({
        error: `${allErrors.length} erro(s) de validação encontrado(s) nas linhas da tabela.`,
        details: allErrors,
      });
    }

    // Verifica posições duplicadas no payload
    const positions = rows.map((r) => Number(r.position));
    const duplicates = positions.filter((p, i) => positions.indexOf(p) !== i);
    if (duplicates.length > 0) {
      return reply.code(422).send({
        error: `Posições duplicadas encontradas no payload: ${[...new Set(duplicates)].join(', ')}.`,
        hint: 'Cada posição deve ser única na tabela.',
      });
    }

    // Verifica isOwnTeam — apenas um registro pode ter true
    const ownTeamCount = rows.filter((r) => Boolean(r.isOwnTeam)).length;
    if (ownTeamCount > 1) {
      return reply.code(422).send({
        error: `Apenas uma linha pode ter "isOwnTeam: true". Encontrado: ${ownTeamCount}.`,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.standingEntry.deleteMany({ where: { competitionId } });
      return tx.standingEntry.createMany({
        data: rows.map((r) => ({
          competitionId,
          position: Number(r.position),
          teamName: String(r.teamName).trim(),
          logoUrl: r.logoUrl ?? null,
          points: r.points ?? 0,
          played: r.played ?? 0,
          won: r.won ?? 0,
          drawn: r.drawn ?? 0,
          lost: r.lost ?? 0,
          goalsFor: r.goalsFor ?? 0,
          goalsAgainst: r.goalsAgainst ?? 0,
          isOwnTeam: Boolean(r.isOwnTeam),
          form: r.form ?? null,
          zone: r.zone ?? 'NONE',
        })),
      });
    });

    return reply.send({
      message: `Tabela da competição "${competition.name}" atualizada com ${result.count} linhas.`,
      count: result.count,
    });
  });

  app.delete('/standings/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.standingEntry.delete({ where: { id } });
    return reply.send({ message: 'Linha da tabela deletada com sucesso.' });
  });
}