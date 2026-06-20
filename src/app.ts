// src/shared/services/clube-api/index.ts
//
// Client HTTP minúsculo para a clube-api (projeto separado).
// Cole este arquivo dentro do sports-news-api e use nas controllers
// do painel admin que vão exibir/cadastrar dados do clube.
//
// Variáveis de ambiente necessárias no sports-news-api (.env):
//   CLUBE_API_URL=http://localhost:3010   (ou a URL de produção)
//   CLUBE_API_KEY=<mesma chave configurada na clube-api>

const BASE_URL = process.env.CLUBE_API_URL || 'http://localhost:3010';
const API_KEY = process.env.CLUBE_API_KEY || '';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean; // true = envia x-api-key (rotas /api/admin/*)
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

// ═══════════════════════════════════════════════════════════════
// Leitura (rotas públicas — não precisam de auth)
// ═══════════════════════════════════════════════════════════════
export const clubeApi = {
  team: {
    get: () => request<any>('/api/team'),
  },

  categories: {
    list: () => request<any[]>('/api/categories'),
    getBySlug: (slug: string) => request<any>(`/api/categories/${slug}`),
  },

  competitions: {
    list: (categorySlug?: string) =>
      request<any[]>(`/api/competitions${categorySlug ? `?category=${categorySlug}` : ''}`),
  },

  opponents: {
    list: () => request<any[]>('/api/opponents'),
  },

  matches: {
    list: (params?: { category?: string; status?: string; competitionId?: string; limit?: number }) => {
      const qs = new URLSearchParams(params as any).toString();
      return request<any[]>(`/api/matches${qs ? `?${qs}` : ''}`);
    },
    next: (params?: { category?: string; limit?: number }) => {
      const qs = new URLSearchParams(params as any).toString();
      return request<any[]>(`/api/matches/next${qs ? `?${qs}` : ''}`);
    },
    recent: (params?: { category?: string; limit?: number }) => {
      const qs = new URLSearchParams(params as any).toString();
      return request<any[]>(`/api/matches/recent${qs ? `?${qs}` : ''}`);
    },
  },

  standings: {
    get: (competitionId: string) => request<any[]>(`/api/standings/${competitionId}`),
  },

  squad: {
    list: (categorySlug: string) => request<any[]>(`/api/squad?category=${categorySlug}`),
  },

  // Movimentações de elenco (entradas e saídas do clube)
  movements: {
    // Histórico de um jogador específico
    listByPlayer: (squadMemberId: string) =>
      request<any[]>(`/api/squad/${squadMemberId}/movements`),
    // Últimas movimentações do clube (home, página de transferências...)
    recent: (params?: { limit?: number; type?: string }) => {
      const qs = new URLSearchParams(params as any).toString();
      return request<any[]>(`/api/movements/recent${qs ? `?${qs}` : ''}`);
    },
  },

  // ═══════════════════════════════════════════════════════════
  // Escrita (rotas /api/admin/* — usadas pelo painel admin do
  // sports-news-api; sempre passam x-api-key automaticamente)
  // ═══════════════════════════════════════════════════════════
  admin: {
    team: {
      update: (data: any) => request<any>('/api/admin/team', { method: 'PATCH', body: data, auth: true }),
    },
    categories: {
      list: () => request<any[]>('/api/admin/categories', { auth: true }),
      create: (data: any) => request<any>('/api/admin/categories', { method: 'POST', body: data, auth: true }),
      update: (id: string, data: any) =>
        request<any>(`/api/admin/categories/${id}`, { method: 'PATCH', body: data, auth: true }),
      delete: (id: string) => request<any>(`/api/admin/categories/${id}`, { method: 'DELETE', auth: true }),
    },
    competitions: {
      list: () => request<any[]>('/api/admin/competitions', { auth: true }),
      create: (data: any) => request<any>('/api/admin/competitions', { method: 'POST', body: data, auth: true }),
      update: (id: string, data: any) =>
        request<any>(`/api/admin/competitions/${id}`, { method: 'PATCH', body: data, auth: true }),
      delete: (id: string) => request<any>(`/api/admin/competitions/${id}`, { method: 'DELETE', auth: true }),
    },
    opponents: {
      create: (data: any) => request<any>('/api/admin/opponents', { method: 'POST', body: data, auth: true }),
      update: (id: string, data: any) =>
        request<any>(`/api/admin/opponents/${id}`, { method: 'PATCH', body: data, auth: true }),
      delete: (id: string) => request<any>(`/api/admin/opponents/${id}`, { method: 'DELETE', auth: true }),
    },
    matches: {
      list: (page = 1, limit = 20) =>
        request<any>(`/api/admin/matches?page=${page}&limit=${limit}`, { auth: true }),
      create: (data: any) => request<any>('/api/admin/matches', { method: 'POST', body: data, auth: true }),
      update: (id: string, data: any) =>
        request<any>(`/api/admin/matches/${id}`, { method: 'PATCH', body: data, auth: true }),
      delete: (id: string) => request<any>(`/api/admin/matches/${id}`, { method: 'DELETE', auth: true }),
    },
    standings: {
      upsertRow: (data: any) => request<any>('/api/admin/standings', { method: 'POST', body: data, auth: true }),
      bulkReplace: (competitionId: string, rows: any[]) =>
        request<any>(`/api/admin/standings/${competitionId}/bulk`, { method: 'PUT', body: rows, auth: true }),
      deleteRow: (id: string) => request<any>(`/api/admin/standings/${id}`, { method: 'DELETE', auth: true }),
    },
    squad: {
      list: (categoryId?: string) =>
        request<any[]>(`/api/admin/squad${categoryId ? `?categoryId=${categoryId}` : ''}`, { auth: true }),
      create: (data: any) => request<any>('/api/admin/squad', { method: 'POST', body: data, auth: true }),
      update: (id: string, data: any) =>
        request<any>(`/api/admin/squad/${id}`, { method: 'PATCH', body: data, auth: true }),
      delete: (id: string) => request<any>(`/api/admin/squad/${id}`, { method: 'DELETE', auth: true }),
    },
    movements: {
      list: (params?: { page?: number; limit?: number; squadMemberId?: string }) => {
        const qs = new URLSearchParams(params as any).toString();
        return request<any>(`/api/admin/movements${qs ? `?${qs}` : ''}`, { auth: true });
      },
      // type: 'ARRIVAL' | 'DEPARTURE' | 'LOAN_OUT' | 'LOAN_IN' | 'RETURN'
      create: (data: { squadMemberId: string; type: string; date: string; club?: string; notes?: string }) =>
        request<any>('/api/admin/movements', { method: 'POST', body: data, auth: true }),
      update: (id: string, data: any) =>
        request<any>(`/api/admin/movements/${id}`, { method: 'PATCH', body: data, auth: true }),
      delete: (id: string) => request<any>(`/api/admin/movements/${id}`, { method: 'DELETE', auth: true }),
    },
  },
};

export { ClubeApiError };