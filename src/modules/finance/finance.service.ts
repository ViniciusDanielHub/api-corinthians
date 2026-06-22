// src/modules/finance/finance.service.ts
//
// Lógica de negócio do módulo financeiro: busca movimentações no banco
// e agrega em resumos, evolução mensal, ranking de clubes e saldo por
// categoria. As rotas (finance.routes.ts) só chamam essas funções.

import { prisma } from '../../shared/database/prisma';
import {
  currencyFilter,
  endOfMonth,
  isExpense,
  isIncome,
  monthKey,
  monthsAgo,
  startOfMonth,
} from './finance.helpers';
import type {
  CategoryBalanceRow,
  ClubRankingRow,
  FinanceSummary,
  MonthlyEvolutionRow,
  MovementForSummary,
  MovementSummaryDTO,
} from './finance.types';

// ── Busca base (reaproveitada por todas as agregações) ──────────────────
async function fetchMovements(from: Date, to: Date, currency?: string): Promise<MovementForSummary[]> {
  return prisma.playerMovement.findMany({
    where: { date: { gte: from, lte: to }, valueCents: { not: null }, ...currencyFilter(currency) },
    include: {
      squadMember: {
        select: {
          id: true,
          name: true,
          photoUrl: true,
          categoryId: true,
          category: { select: { id: true, name: true, slug: true } },
        },
      },
      club: { select: { id: true, name: true, logoUrl: true } },
    },
    orderBy: { date: 'desc' },
  });
}

function formatMovementSummary(m: MovementForSummary | null): MovementSummaryDTO | null {
  if (!m) return null;
  return {
    player: m.squadMember.name,
    club: m.club?.name ?? null,
    valueCents: m.valueCents!.toString(),
    date: m.date,
    type: m.type,
  };
}

// ── Resumo simples (totais, ticket médio, maior venda/compra) ───────────
function summarizeMovements(movements: MovementForSummary[]) {
  let incomeCents = 0n, expenseCents = 0n;
  let incomeCount = 0, expenseCount = 0;
  let biggestSale: MovementForSummary | null = null;
  let biggestPurchase: MovementForSummary | null = null;

  for (const m of movements) {
    const v = m.valueCents ?? 0n;
    if (isIncome(m.type)) {
      incomeCents += v;
      incomeCount++;
      if (!biggestSale || v > (biggestSale.valueCents ?? 0n)) biggestSale = m;
    } else if (isExpense(m.type)) {
      expenseCents += v;
      expenseCount++;
      if (!biggestPurchase || v > (biggestPurchase.valueCents ?? 0n)) biggestPurchase = m;
    }
  }

  return { incomeCents, expenseCents, incomeCount, expenseCount, biggestSale, biggestPurchase };
}

export async function summarize(from: Date, to: Date, currency?: string): Promise<FinanceSummary> {
  const movements = await fetchMovements(from, to, currency);
  const { incomeCents, expenseCents, incomeCount, expenseCount, biggestSale, biggestPurchase } =
    summarizeMovements(movements);

  return {
    period: { from, to },
    incomeCents: incomeCents.toString(),
    expenseCents: expenseCents.toString(),
    balanceCents: (incomeCents - expenseCents).toString(),
    movementsCount: movements.length,
    averageSaleCents: incomeCount > 0 ? (incomeCents / BigInt(incomeCount)).toString() : '0',
    averagePurchaseCents: expenseCount > 0 ? (expenseCents / BigInt(expenseCount)).toString() : '0',
    biggestSale: formatMovementSummary(biggestSale),
    biggestPurchase: formatMovementSummary(biggestPurchase),
  };
}

// ── Evolução mês a mês ──────────────────────────────────────────────────
export async function monthlyEvolution(months: number, currency?: string): Promise<MonthlyEvolutionRow[]> {
  const from = monthsAgo(months - 1);
  const to = new Date();
  const movements = await fetchMovements(from, to, currency);

  // Inicializa todos os meses do range (mesmo os sem movimentação) com zero
  const buckets = new Map<string, { incomeCents: bigint; expenseCents: bigint; movementsCount: number }>();
  for (let i = months - 1; i >= 0; i--) {
    const ref = monthsAgo(i);
    buckets.set(monthKey(ref), { incomeCents: 0n, expenseCents: 0n, movementsCount: 0 });
  }

  for (const m of movements) {
    const key = monthKey(m.date);
    const bucket = buckets.get(key);
    if (!bucket) continue; // fora do range por arredondamento de data, ignora
    const v = m.valueCents ?? 0n;
    if (isIncome(m.type)) bucket.incomeCents += v;
    else if (isExpense(m.type)) bucket.expenseCents += v;
    bucket.movementsCount++;
  }

  return Array.from(buckets.entries()).map(([month, b]) => ({
    month,
    incomeCents: b.incomeCents.toString(),
    expenseCents: b.expenseCents.toString(),
    balanceCents: (b.incomeCents - b.expenseCents).toString(),
    movementsCount: b.movementsCount,
  }));
}

// ── Ranking de clubes parceiros (quem mais compra/vende com o clube) ────
export async function clubRanking(from: Date, to: Date, currency?: string): Promise<ClubRankingRow[]> {
  const movements = await fetchMovements(from, to, currency);

  type Row = {
    clubId: string;
    clubName: string;
    logoUrl: string | null;
    soldToCents: bigint;
    boughtFromCents: bigint;
    movementsCount: number;
  };
  const map = new Map<string, Row>();

  for (const m of movements) {
    if (!m.club) continue; // RETURN normalmente não tem clube parceiro
    const key = m.club.id;
    const row = map.get(key) ?? {
      clubId: m.club.id,
      clubName: m.club.name,
      logoUrl: m.club.logoUrl,
      soldToCents: 0n,
      boughtFromCents: 0n,
      movementsCount: 0,
    };
    const v = m.valueCents ?? 0n;
    if (isIncome(m.type)) row.soldToCents += v;          // vendemos pra esse clube
    else if (isExpense(m.type)) row.boughtFromCents += v; // compramos desse clube
    row.movementsCount++;
    map.set(key, row);
  }

  return Array.from(map.values())
    .map((r) => ({
      clubId: r.clubId,
      clubName: r.clubName,
      logoUrl: r.logoUrl,
      soldToCents: r.soldToCents.toString(),
      boughtFromCents: r.boughtFromCents.toString(),
      totalCents: (r.soldToCents + r.boughtFromCents).toString(),
      movementsCount: r.movementsCount,
    }))
    .sort((a, b) => Number(BigInt(b.totalCents) - BigInt(a.totalCents)));
}

// ── Saldo por categoria (Principal, Sub-20 etc.) ─────────────────────────
export async function balanceByCategory(from: Date, to: Date, currency?: string): Promise<CategoryBalanceRow[]> {
  const movements = await fetchMovements(from, to, currency);

  type Row = {
    categoryId: string;
    categoryName: string;
    categorySlug: string;
    incomeCents: bigint;
    expenseCents: bigint;
    movementsCount: number;
  };
  const map = new Map<string, Row>();

  for (const m of movements) {
    const cat = m.squadMember.category;
    const key = cat?.id ?? 'sem-categoria';
    const row = map.get(key) ?? {
      categoryId: key,
      categoryName: cat?.name ?? 'Sem categoria',
      categorySlug: cat?.slug ?? '',
      incomeCents: 0n,
      expenseCents: 0n,
      movementsCount: 0,
    };
    const v = m.valueCents ?? 0n;
    if (isIncome(m.type)) row.incomeCents += v;
    else if (isExpense(m.type)) row.expenseCents += v;
    row.movementsCount++;
    map.set(key, row);
  }

  return Array.from(map.values())
    .map((r) => ({
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      categorySlug: r.categorySlug,
      incomeCents: r.incomeCents.toString(),
      expenseCents: r.expenseCents.toString(),
      balanceCents: (r.incomeCents - r.expenseCents).toString(),
      movementsCount: r.movementsCount,
    }))
    .sort((a, b) => Number(BigInt(b.balanceCents) - BigInt(a.balanceCents)));
}

// ── Helpers de range usados nas rotas (evita repetir startOfMonth/endOfMonth) ─
export function monthRange(ref: Date): { from: Date; to: Date } {
  return { from: startOfMonth(ref), to: endOfMonth(ref) };
}