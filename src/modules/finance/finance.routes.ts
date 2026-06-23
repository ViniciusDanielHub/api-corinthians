// src/modules/finance/finance.routes.ts
import type { FastifyInstance } from 'fastify';
import { requireAdminAuth } from '../../shared/plugins/admin-auth.plugin';
import { Validator, parseDateRange } from '../../shared/validation';
import { monthsAgo, pctChange } from './finance.helpers';
import { balanceByCategory, clubRanking, monthlyEvolution, monthRange, summarize } from './finance.service';

/** Valida e parseia o parâmetro ?month=YYYY-MM */
function parseMonthParam(month: unknown): Date {
  if (!month) return new Date();

  const str = String(month).trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(str)) {
    const v = new Validator();
    v.addError('month', 'O parâmetro "month" deve estar no formato YYYY-MM (ex: 2026-06).', str);
    v.throw();
  }
  const d = new Date(`${str}-01T00:00:00`);
  if (isNaN(d.getTime())) {
    const v = new Validator();
    v.addError('month', `Mês inválido: "${str}".`);
    v.throw();
  }
  return d;
}

/** Valida o parâmetro ?months=N */
function parseMonthsParam(months: unknown, defaultN = 12): number {
  if (months === undefined || months === null) return defaultN;
  const n = Number(months);
  if (!Number.isInteger(n) || n < 1 || n > 36) {
    const v = new Validator();
    v.addError('months', 'O parâmetro "months" deve ser um inteiro entre 1 e 36.', months);
    v.throw();
  }
  return n;
}

export async function financeAdminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAdminAuth);

  // GET /api/admin/finance/month?month=2026-06&currency=BRL
  app.get('/finance/month', async (request, reply) => {
    const { month, currency } = request.query as { month?: string; currency?: string };

    if (currency) new Validator().currencyCode('currency', currency).throw();

    const ref = parseMonthParam(month);
    const { from, to } = monthRange(ref);
    return reply.send(await summarize(from, to, currency));
  });

  // GET /api/admin/finance/last-6-months?currency=BRL
  app.get('/finance/last-6-months', async (request, reply) => {
    const { currency } = request.query as { currency?: string };
    if (currency) new Validator().currencyCode('currency', currency).throw();
    return reply.send(await summarize(monthsAgo(6), new Date(), currency));
  });

  // GET /api/admin/finance/last-year?currency=BRL
  app.get('/finance/last-year', async (request, reply) => {
    const { currency } = request.query as { currency?: string };
    if (currency) new Validator().currencyCode('currency', currency).throw();
    return reply.send(await summarize(monthsAgo(12), new Date(), currency));
  });

  // GET /api/admin/finance/range?from=2026-01-01&to=2026-06-30&currency=BRL
  app.get('/finance/range', async (request, reply) => {
    const { from, to, currency } = request.query as { from?: string; to?: string; currency?: string };

    if (currency) new Validator().currencyCode('currency', currency).throw();
    const range = parseDateRange(from, to);
    return reply.send(await summarize(range.from, range.to, currency));
  });

  // GET /api/admin/finance/evolution?months=12&currency=BRL
  app.get('/finance/evolution', async (request, reply) => {
    const { months, currency } = request.query as { months?: string; currency?: string };

    if (currency) new Validator().currencyCode('currency', currency).throw();
    const n = parseMonthsParam(months, 12);
    return reply.send(await monthlyEvolution(n, currency));
  });

  // GET /api/admin/finance/club-ranking?from=2026-01-01&to=2026-06-30&currency=BRL
  app.get('/finance/club-ranking', async (request, reply) => {
    const { from, to, currency } = request.query as { from?: string; to?: string; currency?: string };

    if (currency) new Validator().currencyCode('currency', currency).throw();
    const fromDate = from ? parseDateRange(from, to ?? new Date().toISOString()).from : monthsAgo(12);
    const toDate = to ? parseDateRange(from ?? monthsAgo(12).toISOString(), to).to : new Date();
    return reply.send(await clubRanking(fromDate, toDate, currency));
  });

  // GET /api/admin/finance/by-category?from=2026-01-01&to=2026-06-30&currency=BRL
  app.get('/finance/by-category', async (request, reply) => {
    const { from, to, currency } = request.query as { from?: string; to?: string; currency?: string };

    if (currency) new Validator().currencyCode('currency', currency).throw();

    if (from || to) {
      // Se um dos dois foi informado, ambos precisam ser datas ISO válidas
      new Validator()
        .isoDate('from', from, 'data inicial')
        .isoDate('to', to, 'data final')
        .throw();
    }

    const fromDate = from ? new Date(from) : monthsAgo(12);
    const toDate = to ? new Date(to) : new Date();

    if (fromDate > toDate) {
      new Validator()
        .addError('from', `"from" (${from}) não pode ser posterior a "to" (${to}).`)
        .throw();
    }

    return reply.send(await balanceByCategory(fromDate, toDate, currency));
  });

  // GET /api/admin/finance/comparison?month=2026-06&currency=BRL
  app.get('/finance/comparison', async (request, reply) => {
    const { month, currency } = request.query as { month?: string; currency?: string };

    if (currency) new Validator().currencyCode('currency', currency).throw();
    const ref = parseMonthParam(month);

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