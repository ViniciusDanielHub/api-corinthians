import type { FastifyInstance } from 'fastify';
import { requireApiKey } from '../../shared/plugins/api-key.plugin';
import { monthsAgo, pctChange } from './finance.helpers';
import { balanceByCategory, clubRanking, monthlyEvolution, monthRange, summarize } from './finance.service';

export async function financeAdminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireApiKey);

  // GET /api/admin/finance/month?month=2026-06&currency=BRL
  app.get('/finance/month', async (request, reply) => {
    const { month, currency } = request.query as { month?: string; currency?: string };
    const ref = month ? new Date(`${month}-01T00:00:00`) : new Date();
    const { from, to } = monthRange(ref);
    return reply.send(await summarize(from, to, currency));
  });

  // GET /api/admin/finance/last-6-months?currency=BRL
  app.get('/finance/last-6-months', async (request, reply) => {
    const { currency } = request.query as { currency?: string };
    return reply.send(await summarize(monthsAgo(6), new Date(), currency));
  });

  // GET /api/admin/finance/last-year?currency=BRL
  app.get('/finance/last-year', async (request, reply) => {
    const { currency } = request.query as { currency?: string };
    return reply.send(await summarize(monthsAgo(12), new Date(), currency));
  });

  // GET /api/admin/finance/range?from=2026-01-01&to=2026-06-30&currency=BRL
  app.get('/finance/range', async (request, reply) => {
    const { from, to, currency } = request.query as { from?: string; to?: string; currency?: string };
    if (!from || !to) return reply.code(422).send({ error: 'Parâmetros "from" e "to" são obrigatórios.' });
    return reply.send(await summarize(new Date(from), new Date(to), currency));
  });

  // GET /api/admin/finance/evolution?months=12&currency=BRL
  // Saldo mês a mês — pronto pra alimentar gráfico de linha/barra no dashboard.
  app.get('/finance/evolution', async (request, reply) => {
    const { months, currency } = request.query as { months?: string; currency?: string };
    const n = Math.min(Math.max(Number(months) || 12, 1), 36);
    return reply.send(await monthlyEvolution(n, currency));
  });

  // GET /api/admin/finance/club-ranking?from=2026-01-01&to=2026-06-30&currency=BRL
  // Ranking de clubes parceiros: quem mais comprou/vendeu pro/do seu clube.
  app.get('/finance/club-ranking', async (request, reply) => {
    const { from, to, currency } = request.query as { from?: string; to?: string; currency?: string };
    const fromDate = from ? new Date(from) : monthsAgo(12);
    const toDate = to ? new Date(to) : new Date();
    return reply.send(await clubRanking(fromDate, toDate, currency));
  });

  // GET /api/admin/finance/by-category?from=2026-01-01&to=2026-06-30&currency=BRL
  // Saldo de transferências separado por categoria (Principal, Sub-20...).
  app.get('/finance/by-category', async (request, reply) => {
    const { from, to, currency } = request.query as { from?: string; to?: string; currency?: string };
    const fromDate = from ? new Date(from) : monthsAgo(12);
    const toDate = to ? new Date(to) : new Date();
    return reply.send(await balanceByCategory(fromDate, toDate, currency));
  });

  // GET /api/admin/finance/comparison?month=2026-06&currency=BRL
  // Compara o mês informado (ou atual) com o mês imediatamente anterior.
  app.get('/finance/comparison', async (request, reply) => {
    const { month, currency } = request.query as { month?: string; currency?: string };
    const ref = month ? new Date(`${month}-01T00:00:00`) : new Date();

    const { from: currentFrom, to: currentTo } = monthRange(ref);
    const previousRef = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
    const { from: previousFrom, to: previousTo } = monthRange(previousRef);

    const [current, previous] = await Promise.all([
      summarize(currentFrom, currentTo, currency),
      summarize(previousFrom, previousTo, currency),
    ]);

    return reply.send({
      current,
      previous,
      variation: {
        incomePct: pctChange(BigInt(previous.incomeCents), BigInt(current.incomeCents)),
        expensePct: pctChange(BigInt(previous.expenseCents), BigInt(current.expenseCents)),
        balancePct: pctChange(BigInt(previous.balanceCents), BigInt(current.balanceCents)),
      },
    });
  });
}