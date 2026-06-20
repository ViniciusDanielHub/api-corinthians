// src/shared/services/clube-api/http.ts
//
// Núcleo HTTP do client da clube-api: função request genérica,
// montagem de query string e classe de erro tipada.

declare const process: { env: Record<string, string | undefined> };

const BASE_URL = process.env.CLUBE_API_URL || 'http://localhost:3010';
const API_KEY  = process.env.CLUBE_API_KEY  || '';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface RequestOptions<TBody = unknown> {
  method?: HttpMethod;
  body?: TBody;
  auth?: boolean;
}

interface ClubeApiErrorBody {
  error?: string;
  details?: unknown;
}

export class ClubeApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ClubeApiError';
  }
}

function isErrorBody(value: unknown): value is ClubeApiErrorBody {
  return typeof value === 'object' && value !== null;
}

export async function request<TResponse, TBody = unknown>(
  path: string,
  options: RequestOptions<TBody> = {},
): Promise<TResponse> {
  const { method = 'GET', body, auth = false } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) headers['x-api-key'] = API_KEY;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro de rede desconhecido';
    throw new ClubeApiError(503, `clube-api indisponível: ${message}`);
  }

  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const errorBody = isErrorBody(data) ? data : undefined;
    throw new ClubeApiError(
      res.status,
      errorBody?.error ?? 'Erro na clube-api',
      errorBody?.details,
    );
  }

  return data as TResponse;
}

type QueryParamValue = string | number | boolean | undefined | null;

export function buildQueryString<T extends { [K in keyof T]: QueryParamValue }>(
  params?: T,
): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    searchParams.set(key, String(value));
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}
