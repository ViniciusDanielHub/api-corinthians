// src/modules/standings/standings.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../shared/database/prisma';
import { requireApiKey } from '../../shared/plugins/api-key.plugin';

// Adiciona goalDifference calculado (SG) na resposta — não é salvo no
// banco para não correr risco de ficar "dessincronizado" com GM/GC.
function withGoalDifference<T extends { goalsFor: number; goalsAgainst: number }>(row: T) {
  return { ...row, goalDifference: row.goalsFor - row.goalsAgainst };
}

export async function standingsPublicRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/standings/:competitionId
  app.get('/standings/:competitionId', async (request, reply) => {
    const { competitionId } = request.params as { competitionId: string };
    const table = await prisma.standingEntry.findMany({
      where: { competitionId },
      orderBy: { position: 'asc' },
    });
    return reply.send(table.map(withGoalDifference));
  });
}

export async function standingsAdminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireApiKey);

  // POST /api/admin/standings — cria/atualiza uma linha (upsert por posição)
  app.post('/standings', async (request, reply) => {
    const body = request.body as any;
    if (!body.competitionId || body.position === undefined || !body.teamName) {
      return reply.code(422).send({ error: 'Campos obrigatórios: competitionId, position, teamName.' });
    }

    const data = {
      teamName: body.teamName.trim(),
      logoUrl: body.logoUrl,
      points: body.points ?? 0,
      played: body.played ?? 0,
      won: body.won ?? 0,
      drawn: body.drawn ?? 0,
      lost: body.lost ?? 0,
      goalsFor: body.goalsFor ?? 0,
      goalsAgainst: body.goalsAgainst ?? 0,
      isOwnTeam: Boolean(body.isOwnTeam),
      form: body.form ?? undefined,       // ex: "L,D,W,L,W"
      zone: body.zone ?? 'NONE',
    };

    const entry = await prisma.standingEntry.upsert({
      where: { competitionId_position: { competitionId: body.competitionId, position: Number(body.position) } },
      update: data,
      create: { competitionId: body.competitionId, position: Number(body.position), ...data },
    });
    return reply.code(201).send(withGoalDifference(entry));
  });

  // PUT /api/admin/standings/:competitionId/bulk — substitui a tabela inteira
  // (forma mais prática pra digitar manualmente: cola a tabela toda de uma vez)
  app.put('/standings/:competitionId/bulk', async (request, reply) => {
    const { competitionId } = request.params as { competitionId: string };
    const rows = request.body as any[];

    if (!Array.isArray(rows)) {
      return reply.code(422).send({ error: 'O corpo deve ser um array de linhas da tabela.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.standingEntry.deleteMany({ where: { competitionId } });
      return tx.standingEntry.createMany({
        data: rows.map((r) => ({
          competitionId,
          position: Number(r.position),
          teamName: String(r.teamName).trim(),
          logoUrl: r.logoUrl,
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

    return reply.send({ message: `Tabela atualizada com ${result.count} linhas.` });
  });

  app.delete('/standings/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.standingEntry.delete({ where: { id } });
    return reply.send({ message: 'Linha da tabela deletada.' });
  });
}