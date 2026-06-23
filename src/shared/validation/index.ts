// src/shared/validation/index.ts
//
// Utilitários de validação centralizados. Toda rota deve usar estas
// funções em vez de checar campos manualmente — garante mensagens
// consistentes, sanitização e rastreabilidade de erros.

// ─── Tipos base ───────────────────────────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
  received?: unknown;
}

export class ValidationException extends Error {
  public readonly errors: ValidationError[];
  public readonly statusCode = 422;

  constructor(errors: ValidationError[]) {
    const summary = errors.map((e) => `${e.field}: ${e.message}`).join('; ');
    super(`Erro de validação: ${summary}`);
    this.name = 'ValidationException';
    this.errors = errors;
  }
}

// ─── Builder de validação fluente ─────────────────────────────────────────────

export class Validator {
  private errors: ValidationError[] = [];

  /** Campo obrigatório — rejeita undefined, null e string vazia */
  required(field: string, value: unknown, label?: string): this {
    const display = label ?? field;
    if (value === undefined || value === null) {
      this.errors.push({ field, message: `O campo "${display}" é obrigatório.`, received: value });
    } else if (typeof value === 'string' && value.trim() === '') {
      this.errors.push({ field, message: `O campo "${display}" não pode ser vazio.`, received: value });
    }
    return this;
  }

  /** String com tamanho mínimo e/ou máximo */
  string(
    field: string,
    value: unknown,
    opts: { min?: number; max?: number; label?: string } = {},
  ): this {
    if (value === undefined || value === null) return this; // deixa required() tratar
    const display = opts.label ?? field;
    if (typeof value !== 'string') {
      this.errors.push({ field, message: `O campo "${display}" deve ser uma string.`, received: typeof value });
      return this;
    }
    const trimmed = value.trim();
    if (opts.min !== undefined && trimmed.length < opts.min) {
      this.errors.push({
        field,
        message: `O campo "${display}" deve ter pelo menos ${opts.min} caractere(s).`,
        received: trimmed.length,
      });
    }
    if (opts.max !== undefined && trimmed.length > opts.max) {
      this.errors.push({
        field,
        message: `O campo "${display}" deve ter no máximo ${opts.max} caractere(s).`,
        received: trimmed.length,
      });
    }
    return this;
  }

  /** Número inteiro com limites opcionais */
  integer(
    field: string,
    value: unknown,
    opts: { min?: number; max?: number; label?: string } = {},
  ): this {
    if (value === undefined || value === null) return this;
    const display = opts.label ?? field;
    const n = Number(value);
    if (!Number.isInteger(n) || isNaN(n)) {
      this.errors.push({
        field,
        message: `O campo "${display}" deve ser um número inteiro.`,
        received: value,
      });
      return this;
    }
    if (opts.min !== undefined && n < opts.min) {
      this.errors.push({
        field,
        message: `O campo "${display}" deve ser maior ou igual a ${opts.min}.`,
        received: n,
      });
    }
    if (opts.max !== undefined && n > opts.max) {
      this.errors.push({
        field,
        message: `O campo "${display}" deve ser menor ou igual a ${opts.max}.`,
        received: n,
      });
    }
    return this;
  }

  /** Número positivo (> 0) — usado para valores financeiros */
  positiveNumber(field: string, value: unknown, label?: string): this {
    if (value === undefined || value === null) return this;
    const display = label ?? field;
    const n = Number(value);
    if (isNaN(n)) {
      this.errors.push({ field, message: `O campo "${display}" deve ser um número.`, received: value });
      return this;
    }
    if (n <= 0) {
      this.errors.push({
        field,
        message: `O campo "${display}" deve ser um valor positivo (> 0).`,
        received: n,
      });
    }
    return this;
  }

  /** Valida que o valor pertence a uma lista de opções */
  oneOf<T extends string>(
    field: string,
    value: unknown,
    allowed: readonly T[],
    label?: string,
  ): this {
    if (value === undefined || value === null) return this;
    const display = label ?? field;
    if (!allowed.includes(value as T)) {
      this.errors.push({
        field,
        message: `O campo "${display}" deve ser um dos seguintes valores: ${allowed.join(', ')}.`,
        received: value,
      });
    }
    return this;
  }

  /** Valida formato de data ISO (YYYY-MM-DD ou ISO 8601 completo) */
  isoDate(field: string, value: unknown, label?: string): this {
    if (value === undefined || value === null) return this;
    const display = label ?? field;
    if (typeof value !== 'string') {
      this.errors.push({ field, message: `O campo "${display}" deve ser uma string de data.`, received: typeof value });
      return this;
    }
    const d = new Date(value);
    if (isNaN(d.getTime())) {
      this.errors.push({
        field,
        message: `O campo "${display}" possui formato de data inválido. Use ISO 8601 (ex: "2026-06-20" ou "2026-06-20T15:00:00").`,
        received: value,
      });
    }
    return this;
  }

  /** Data não pode ser no passado (útil para partidas futuras agendadas) */
  futureDate(field: string, value: unknown, label?: string): this {
    if (value === undefined || value === null) return this;
    const display = label ?? field;
    const d = new Date(value as string);
    if (!isNaN(d.getTime()) && d < new Date()) {
      this.errors.push({
        field,
        message: `O campo "${display}" deve ser uma data futura.`,
        received: value,
      });
    }
    return this;
  }

  /** URL válida */
  url(field: string, value: unknown, label?: string): this {
    if (value === undefined || value === null) return this;
    const display = label ?? field;
    try {
      new URL(value as string);
    } catch {
      this.errors.push({
        field,
        message: `O campo "${display}" deve ser uma URL válida (ex: https://exemplo.com).`,
        received: value,
      });
    }
    return this;
  }

  /** Booleano estrito (true/false/string "true"/"false"/0/1) */
  boolean(field: string, value: unknown, label?: string): this {
    if (value === undefined || value === null) return this;
    const display = label ?? field;
    const valid = [true, false, 'true', 'false', 0, 1, '0', '1'];
    if (!valid.includes(value as any)) {
      this.errors.push({
        field,
        message: `O campo "${display}" deve ser um booleano (true ou false).`,
        received: value,
      });
    }
    return this;
  }

  /** Array não vazio */
  nonEmptyArray(field: string, value: unknown, label?: string): this {
    const display = label ?? field;
    if (!Array.isArray(value)) {
      this.errors.push({ field, message: `O campo "${display}" deve ser um array.`, received: typeof value });
      return this;
    }
    if (value.length === 0) {
      this.errors.push({ field, message: `O campo "${display}" não pode ser um array vazio.` });
    }
    return this;
  }

  /** Ano com faixa razoável */
  year(field: string, value: unknown, label?: string): this {
    if (value === undefined || value === null) return this;
    const display = label ?? field;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1800 || n > new Date().getFullYear()) {
      this.errors.push({
        field,
        message: `O campo "${display}" deve ser um ano entre 1800 e ${new Date().getFullYear()}.`,
        received: value,
      });
    }
    return this;
  }

  /** Valida o padrão "form" da tabela de classificação (ex: "W,D,L,W,W") */
  standingForm(field: string, value: unknown): this {
    if (value === undefined || value === null) return this;
    if (typeof value !== 'string') {
      this.errors.push({ field, message: 'O campo "form" deve ser uma string.', received: typeof value });
      return this;
    }
    const parts = value.split(',');
    if (parts.length > 10) {
      this.errors.push({
        field,
        message: 'O campo "form" deve ter no máximo 10 resultados separados por vírgula.',
        received: parts.length,
      });
      return this;
    }
    const invalid = parts.filter((p) => !['W', 'D', 'L'].includes(p.trim()));
    if (invalid.length > 0) {
      this.errors.push({
        field,
        message: `O campo "form" contém valores inválidos: ${invalid.join(', ')}. Use apenas W, D ou L.`,
        received: value,
      });
    }
    return this;
  }

  /** Valida valor monetário em centavos (inteiro, positivo, BigInt-safe) */
  centValue(field: string, value: unknown, label?: string): this {
    if (value === undefined || value === null) return this;
    const display = label ?? field;
    const str = String(value).trim();
    if (!/^\d+$/.test(str)) {
      this.errors.push({
        field,
        message: `O campo "${display}" deve ser um inteiro positivo em centavos (ex: 150000 = R$ 1.500,00).`,
        received: value,
      });
      return this;
    }
    const n = BigInt(str);
    if (n <= 0n) {
      this.errors.push({
        field,
        message: `O campo "${display}" deve ser maior que zero.`,
        received: value,
      });
    }
    return this;
  }

  /** Código de moeda ISO 4217 */
  currencyCode(field: string, value: unknown): this {
    if (value === undefined || value === null) return this;
    const KNOWN = ['BRL', 'USD', 'EUR', 'GBP', 'ARS', 'PYG', 'UYU', 'CLP', 'BOB', 'PEN', 'COP'];
    if (!KNOWN.includes(String(value).toUpperCase())) {
      this.errors.push({
        field,
        message: `O campo "currency" deve ser um código ISO 4217 válido. Valores aceitos: ${KNOWN.join(', ')}.`,
        received: value,
      });
    }
    return this;
  }

  /**
   * Adiciona um erro customizado ao validador — use quando a regra de
   * negócio não se encaixa em nenhum dos helpers acima (ex: validações
   * cruzadas entre campos, formatos muito específicos).
   */
  addError(field: string, message: string, received?: unknown): this {
    this.errors.push({ field, message, received });
    return this;
  }

  /** Lança ValidationException se houver erros acumulados */
  throw(): void {
    if (this.errors.length > 0) {
      throw new ValidationException(this.errors);
    }
  }

  /** Retorna os erros sem lançar — útil para compor validações */
  getErrors(): ValidationError[] {
    return [...this.errors];
  }

  get hasErrors(): boolean {
    return this.errors.length > 0;
  }
}

// ─── Funções auxiliares de sanitização ───────────────────────────────────────

/** Converte string para inteiro com fallback seguro */
export function safeInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) ? n : fallback;
}

/** Clamp — garante que um número fique dentro de [min, max] */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Sanitiza paginação — garante page >= 1 e limit entre 1 e maxLimit */
export function sanitizePagination(
  page: unknown,
  limit: unknown,
  maxLimit = 100,
): { page: number; skip: number; take: number } {
  const p = clamp(safeInt(page, 1), 1, 10_000);
  const l = clamp(safeInt(limit, 20), 1, maxLimit);
  return { page: p, skip: (p - 1) * l, take: l };
}

/** Valida e parseia intervalo de datas para filtros financeiros */
export function parseDateRange(
  from: unknown,
  to: unknown,
  fieldNames = { from: 'from', to: 'to' },
): { from: Date; to: Date } {
  const v = new Validator();

  if (!from || !to) {
    throw new ValidationException([
      { field: fieldNames.from, message: `Os parâmetros "${fieldNames.from}" e "${fieldNames.to}" são obrigatórios.` },
    ]);
  }

  v.isoDate(fieldNames.from, from, fieldNames.from)
    .isoDate(fieldNames.to, to, fieldNames.to)
    .throw();

  const fromDate = new Date(from as string);
  const toDate = new Date(to as string);

  if (fromDate > toDate) {
    throw new ValidationException([
      {
        field: fieldNames.from,
        message: `"${fieldNames.from}" não pode ser posterior a "${fieldNames.to}".`,
        received: `${from} > ${to}`,
      },
    ]);
  }

  const diffMs = toDate.getTime() - fromDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays > 1095) { // ~3 anos
    throw new ValidationException([
      {
        field: fieldNames.to,
        message: 'O intervalo máximo permitido é de 3 anos (1095 dias).',
        received: `${Math.round(diffDays)} dias`,
      },
    ]);
  }

  return { from: fromDate, to: toDate };
}

// ─── Constantes compartilhadas ───────────────────────────────────────────────

export const VALID_MATCH_STATUSES = [
  'SCHEDULED', 'IN_PLAY', 'FINISHED', 'POSTPONED', 'CANCELLED',
] as const;

export const VALID_MOVEMENT_TYPES = [
  'ARRIVAL', 'DEPARTURE', 'LOAN_OUT', 'LOAN_IN', 'RETURN',
] as const;

export const VALID_GENDERS = ['MALE', 'FEMALE'] as const;
export const VALID_MODALITIES = ['FOOTBALL', 'FUTSAL', 'BASKETBALL'] as const;
export const VALID_ZONES = [
  'NONE', 'TITLE', 'LIBERTADORES', 'LIBERTADORES_PRELIMINARY', 'SULAMERICANA', 'RELEGATION',
] as const;