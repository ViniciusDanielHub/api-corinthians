// src/modules/finance/finance.helpers.ts
//
// Funções utilitárias puras (datas, formatação, cálculo) usadas pelo
// finance.service.ts. Não acessam o banco — só recebem e devolvem dados.

export const INCOME_TYPES = ['DEPARTURE', 'LOAN_OUT'] as const; // entrada de caixa
export const EXPENSE_TYPES = ['ARRIVAL', 'LOAN_IN'] as const;   // saída de caixa

export function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function monthsAgo(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return startOfMonth(d);
}

export function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function isIncome(type: string) {
  return (INCOME_TYPES as readonly string[]).includes(type);
}

export function isExpense(type: string) {
  return (EXPENSE_TYPES as readonly string[]).includes(type);
}

// Filtro opcional de moeda — somar entre moedas diferentes sem conversão
// distorce o resultado, então por enquanto só permitimos isolar uma moeda.
export function currencyFilter(currency?: string) {
  return currency ? { currency } : {};
}

// Percentual de variação A → B. null quando não há base de comparação (from = 0).
export function pctChange(from: bigint, to: bigint): number | null {
  if (from === 0n) return to === 0n ? 0 : null;
  return Number(((to - from) * 10000n) / from) / 100;
}