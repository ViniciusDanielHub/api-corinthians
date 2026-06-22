export type MovementForSummary = {
  id: string;
  type: string;
  date: Date;
  valueCents: bigint | null;
  currency: string | null;
  squadMember: {
    id: string;
    name: string;
    photoUrl: string | null;
    categoryId?: string;
    category?: { id: string; name: string; slug: string } | null;
  };
  club: { id: string; name: string; logoUrl: string | null } | null;
};

export interface FinanceSummary {
  period: { from: Date; to: Date };
  incomeCents: string;
  expenseCents: string;
  balanceCents: string;
  movementsCount: number;
  averageSaleCents: string;
  averagePurchaseCents: string;
  biggestSale: MovementSummaryDTO | null;
  biggestPurchase: MovementSummaryDTO | null;
}

export interface MovementSummaryDTO {
  player: string;
  club: string | null;
  valueCents: string;
  date: Date;
  type: string;
}

export interface MonthlyEvolutionRow {
  month: string;
  incomeCents: string;
  expenseCents: string;
  balanceCents: string;
  movementsCount: number;
}

export interface ClubRankingRow {
  clubId: string;
  clubName: string;
  logoUrl: string | null;
  soldToCents: string;
  boughtFromCents: string;
  totalCents: string;
  movementsCount: number;
}

export interface CategoryBalanceRow {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  incomeCents: string;
  expenseCents: string;
  balanceCents: string;
  movementsCount: number;
}

export interface FinanceComparison {
  current: FinanceSummary;
  previous: FinanceSummary;
  variation: {
    incomePct: number | null;
    expensePct: number | null;
    balancePct: number | null;
  };
}