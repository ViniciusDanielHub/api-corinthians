// src/shared/plugins/api-key.plugin.ts
//
// Autenticação simples para rotas de escrita: a API principal
// (sports-news-api) chama esta API server-to-server enviando o header
//   x-api-key: <CLUBE_API_KEY>
//
// Não há login de usuário aqui — quem decide QUEM pode cadastrar o quê
// é o painel admin do sports-news-api (que já tem roles/permissões).
// Esta API só verifica "a requisição vem de um servidor autorizado".
import type { FastifyRequest, FastifyReply } from 'fastify';
import { timingSafeEqual } from 'crypto';

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function requireApiKey(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const expected = process.env.CLUBE_API_KEY?.trim();

  if (!expected) {
    request.log.error('CLUBE_API_KEY não configurada no .env — bloqueando rota de escrita');
    return reply.code(503).send({ error: 'API não configurada corretamente.' });
  }

  const received = request.headers['x-api-key'];

  if (!received || typeof received !== 'string' || !safeCompare(received, expected)) {
    return reply.code(401).send({ error: 'Chave de API ausente ou inválida (header x-api-key).' });
  }
}
