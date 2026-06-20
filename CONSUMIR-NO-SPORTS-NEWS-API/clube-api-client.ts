// CONSUMIR-NO-SPORTS-NEWS-API/clube-api-client.ts
//
// ATENÇÃO: este arquivo é apenas uma referência de uso rápido (legado).
// Para o client totalmente tipado, copie a PASTA INTEIRA
//   src/shared/services/clube-api/
// para dentro do sports-news-api.
//
// Variáveis de ambiente necessárias no sports-news-api (.env):
//   CLUBE_API_URL=http://localhost:3010
//   CLUBE_API_KEY=<mesma chave configurada na clube-api>

const BASE_URL = process.env.CLUBE_API_URL || 'http://localhost:3010';
const API_KEY  = process.env.CLUBE_API_KEY  || '';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean;
}

class ClubeApiError extends Error {
  constructor(public statusCode: number, message: string, public details?: unknown) {
    super(message);
    this.name = 'ClubeApiError';
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
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
  } catch (err: any) {
    throw new ClubeApiError(503, `clube-api indisponível: ${err.message}`);
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ClubeApiError(res.status, data?.error || 'Erro na clube-api', data?.details);
  }

  return data as T;
}

export const clubeApi = {
  // ── Leitura pública ──────────────────────────────────────────────────────
  team:         { get: () => request<any>('/api/team') },
  categories:   { list: () => request<any[]>('/api/categories'),
                  getBySlug: (slug: string) => request<any>(`/api/categories/${slug}`) },
  competitions: { list: (categorySlug?: string) =>
                    request<any[]>(`/api/competitions${categorySlug ? `?category=${categorySlug}` : ''}`) },
  opponents:    { list: () => request<any[]>('/api/opponents') },
  matches: {
    list:   (p?: any) => { const qs = new URLSearchParams(p).toString(); return request<any[]>(`/api/matches${qs ? `?${qs}` : ''}`); },
    next:   (p?: any) => { const qs = new URLSearchParams(p).toString(); return request<any[]>(`/api/matches/next${qs ? `?${qs}` : ''}`); },
    recent: (p?: any) => { const qs = new URLSearchParams(p).toString(); return request<any[]>(`/api/matches/recent${qs ? `?${qs}` : ''}`); },
  },
  standings: { get: (competitionId: string) => request<any[]>(`/api/standings/${competitionId}`) },
  squad:     { list: (categorySlug: string) => request<any[]>(`/api/squad?category=${categorySlug}`) },
  movements: {
    recent:       (p?: any) => { const qs = new URLSearchParams(p).toString(); return request<any[]>(`/api/movements/recent${qs ? `?${qs}` : ''}`); },
    listByPlayer: (squadMemberId: string) => request<any[]>(`/api/squad/${squadMemberId}/movements`),
  },

  // ── Escrita admin (server-to-server, x-api-key automático) ───────────────
  admin: {
    team:         { update: (d: any) => request<any>('/api/admin/team', { method: 'PATCH', body: d, auth: true }) },
    categories: {
      list:   ()                   => request<any[]>('/api/admin/categories', { auth: true }),
      create: (d: any)             => request<any>('/api/admin/categories', { method: 'POST', body: d, auth: true }),
      update: (id: string, d: any) => request<any>(`/api/admin/categories/${id}`, { method: 'PATCH', body: d, auth: true }),
      delete: (id: string)         => request<any>(`/api/admin/categories/${id}`, { method: 'DELETE', auth: true }),
    },
    competitions: {
      list:   ()                   => request<any[]>('/api/admin/competitions', { auth: true }),
      create: (d: any)             => request<any>('/api/admin/competitions', { method: 'POST', body: d, auth: true }),
      update: (id: string, d: any) => request<any>(`/api/admin/competitions/${id}`, { method: 'PATCH', body: d, auth: true }),
      delete: (id: string)         => request<any>(`/api/admin/competitions/${id}`, { method: 'DELETE', auth: true }),
    },
    opponents: {
      create: (d: any)             => request<any>('/api/admin/opponents', { method: 'POST', body: d, auth: true }),
      update: (id: string, d: any) => request<any>(`/api/admin/opponents/${id}`, { method: 'PATCH', body: d, auth: true }),
      delete: (id: string)         => request<any>(`/api/admin/opponents/${id}`, { method: 'DELETE', auth: true }),
    },
    matches: {
      list:   (page = 1, limit = 20) => request<any>(`/api/admin/matches?page=${page}&limit=${limit}`, { auth: true }),
      create: (d: any)               => request<any>('/api/admin/matches', { method: 'POST', body: d, auth: true }),
      update: (id: string, d: any)   => request<any>(`/api/admin/matches/${id}`, { method: 'PATCH', body: d, auth: true }),
      delete: (id: string)           => request<any>(`/api/admin/matches/${id}`, { method: 'DELETE', auth: true }),
    },
    standings: {
      upsertRow:   (d: any)                         => request<any>('/api/admin/standings', { method: 'POST', body: d, auth: true }),
      bulkReplace: (competitionId: string, rows: any[]) => request<any>(`/api/admin/standings/${competitionId}/bulk`, { method: 'PUT', body: rows, auth: true }),
      deleteRow:   (id: string)                     => request<any>(`/api/admin/standings/${id}`, { method: 'DELETE', auth: true }),
    },
    squad: {
      list:   (categoryId?: string) => request<any[]>(`/api/admin/squad${categoryId ? `?categoryId=${categoryId}` : ''}`, { auth: true }),
      create: (d: any)              => request<any>('/api/admin/squad', { method: 'POST', body: d, auth: true }),
      update: (id: string, d: any)  => request<any>(`/api/admin/squad/${id}`, { method: 'PATCH', body: d, auth: true }),
      delete: (id: string)          => request<any>(`/api/admin/squad/${id}`, { method: 'DELETE', auth: true }),
    },
    movements: {
      list:   (p?: any)             => { const qs = new URLSearchParams(p).toString(); return request<any>(`/api/admin/movements${qs ? `?${qs}` : ''}`, { auth: true }); },
      create: (d: any)              => request<any>('/api/admin/movements', { method: 'POST', body: d, auth: true }),
      update: (id: string, d: any)  => request<any>(`/api/admin/movements/${id}`, { method: 'PATCH', body: d, auth: true }),
      delete: (id: string)          => request<any>(`/api/admin/movements/${id}`, { method: 'DELETE', auth: true }),
    },
  },
};

export { ClubeApiError };
