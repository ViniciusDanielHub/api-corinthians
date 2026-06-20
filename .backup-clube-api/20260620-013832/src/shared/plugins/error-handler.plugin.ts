// src/shared/plugins/error-handler.plugin.ts
import type { FastifyInstance } from 'fastify';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({ error: `Rota não encontrada: ${request.method} ${request.url}` });
  });

  app.setErrorHandler((err: any, request, reply) => {
    if (err.code === 'P2002') {
      return reply.code(409).send({
        error: 'Já existe um registro com este valor único.',
        meta: process.env.NODE_ENV !== 'production' ? err.meta : undefined,
      });
    }
    if (err.code === 'P2025' || err.code === 'P2003') {
      return reply.code(404).send({ error: 'Registro não encontrado ou referência inválida.' });
    }
    if (err.validation) {
      return reply.code(422).send({ error: 'Dados inválidos.', details: err.validation });
    }

    const statusCode = err.statusCode && err.statusCode < 500 ? err.statusCode : 500;
    if (statusCode >= 500) {
      request.log.error({ err }, 'Erro interno');
    }
    reply.code(statusCode).send({
      error: statusCode >= 500
        ? 'Erro interno do servidor.'
        : (err.message || 'Erro na requisição.'),
    });
  });
}
