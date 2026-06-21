import type { FastifyInstance } from 'fastify';
import { prisma } from '../../shared/database/prisma';
import { requireApiKey } from '../../shared/plugins/api-key.plugin';

const INCOME_TYPES = ['DEPARTURE', 'LOAN_OUT'] as const; // entrada de caixa
const EXPENSE_TYPES = ['ARRIVAL', 'LOAN_IN'] as const;   // saída de caixa

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function monthsAgo(n: number) { const d = new Date(); d.setMonth(d.getMonth() - n); return startOfMonth(d); }

async function summarize(from: Date, to: Date) {
  const movements = await prisma.playerMovement.findMany({
    where: { date: { gte: from, lte: to }, valueCents: { not: null } },
    include: {
      squadMember: { select: { id: true, name: true, photoUrl: true } },
      club: { select: { id: true, name: true, logoUrl: true } },
    },
    orderBy: { date: 'desc' },
  });

  let incomeCents = 0n, expenseCents = 0n;
  let biggestSale: typeof movements[number] | null = null;
  let biggestPurchase: typeof movements[number] | null = null;

  for (const m of movements) {
    const v = m.valueCents ?? 0n;
    if ((INCOME_TYPES as readonly string[]).includes(m.type)) {
      incomeCents += v;
      if (!biggestSale || v > (biggestSale.valueCents ?? 0n)) biggestSale = m;
    } else if ((EXPENSE_TYPES as readonly string[]).includes(m.type)) {
      expenseCents += v;
      if (!biggestPurchase || v > (biggestPurchase.valueCents ?? 0n)) biggestPurchase = m;
    }
  }

  return {
    period: { from, to },
    incomeCents: incomeCents.toString(),
    expenseCents: expenseCents.toString(),
    balanceCents: (incomeCents - expenseCents).toString(),
    movementsCount: movements.length,
    biggestSale: biggestSale && {
      player: biggestSale.squadMember.name,
      club: biggestSale.club?.name ?? null,
      valueCents: biggestSale.valueCents!.toString(),
      date: biggestSale.date,
      type: biggestSale.type,
    },
    biggestPurchase: biggestPurchase && {
      player: biggestPurchase.squadMember.name,
      club: biggestPurchase.club?.name ?? null,
      valueCents: biggestPurchase.valueCents!.toString(),
      date: biggestPurchase.date,
      type: biggestPurchase.type,
    },
  };
}

export async function financeAdminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireApiKey);

  // GET /api/admin/finance/month?month=2026-06
  app.get('/finance/month', async (request, reply) => {
    const { month } = request.query as { month?: string };
    const ref = month ? new Date(`${month}-01T00:00:00`) : new Date();
    const from = startOfMonth(ref);
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 0, 23, 59, 59);
    return reply.send(await summarize(from, to));
  });

  // GET /api/admin/finance/last-6-months
  app.get('/finance/last-6-months', async (_req, reply) => {
    return reply.send(await summarize(monthsAgo(6), new Date()));
  });

  // GET /api/admin/finance/last-year
  app.get('/finance/last-year', async (_req, reply) => {
    return reply.send(await summarize(monthsAgo(12), new Date()));
  });

  // GET /api/admin/finance/range?from=2026-01-01&to=2026-06-30 (flexível)
  app.get('/finance/range', async (request, reply) => {
    const { from, to } = request.query as { from?: string; to?: string };
    if (!from || !to) return reply.code(422).send({ error: 'Parâmetros "from" e "to" são obrigatórios.' });
    return reply.send(await summarize(new Date(from), new Date(to)));
  });
}