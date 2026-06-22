// src/shared/plugins/error-handler.plugin.ts
import type { FastifyInstance } from 'fastify';
import { ValidationException } from '../validation';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: `Rota não encontrada: ${request.method} ${request.url}`,
      hint: 'Verifique o método HTTP e o caminho da URL.',
    });
  });

  app.setErrorHandler((err: any, request, reply) => {
    // ── Erros de validação da nossa camada ───────────────────────────────
    if (err instanceof ValidationException) {
      return reply.code(422).send({
        error: 'Dados inválidos.',
        details: err.errors,
      });
    }

    // ── Erros do Prisma ──────────────────────────────────────────────────

    // Violação de unique constraint
    if (err.code === 'P2002') {
      const fields: string[] = err.meta?.target ?? [];
      return reply.code(409).send({
        error: 'Já existe um registro com este valor único.',
        fields: fields.length > 0 ? fields : undefined,
        hint:
          fields.length > 0
            ? `O(s) campo(s) "${fields.join(', ')}" já está(ão) em uso por outro registro.`
            : 'Verifique se não há duplicidade nos dados enviados.',
      });
    }

    // Registro não encontrado (update/delete em id inexistente)
    if (err.code === 'P2025') {
      return reply.code(404).send({
        error: 'Registro não encontrado.',
        hint: 'Verifique se o ID informado existe e pertence ao recurso correto.',
      });
    }

    // Violação de FK — referência inexistente ou registro em uso
    if (err.code === 'P2003') {
      const isDelete = request.method === 'DELETE';
      const field: string = err.meta?.field_name ?? '';
      return reply.code(isDelete ? 409 : 422).send({
        error: isDelete
          ? 'Não é possível deletar: este registro está em uso por outro recurso.'
          : 'Referência inválida: o registro relacionado informado não existe.',
        field: field || undefined,
        hint: isDelete
          ? 'Remova ou desvincule os registros dependentes antes de deletar este.'
          : `Certifique-se de que o ID informado em "${field || 'campo relacionado'}" existe.`,
      });
    }

    // Violação de null constraint
    if (err.code === 'P2011') {
      const field: string = err.meta?.constraint ?? '';
      return reply.code(422).send({
        error: 'Campo obrigatório ausente no banco de dados.',
        field: field || undefined,
        hint: `O campo "${field || 'desconhecido'}" não pode ser nulo.`,
      });
    }

    // Tipo de dado incompatível
    if (err.code === 'P2006') {
      return reply.code(422).send({
        error: 'Valor inválido para o tipo de dado esperado.',
        hint: 'Verifique os tipos dos campos enviados (ex: número onde se espera string ou vice-versa).',
      });
    }

    // Timeout de banco
    if (err.code === 'P2024') {
      request.log.error({ err }, 'Timeout de conexão com o banco');
      return reply.code(503).send({
        error: 'O banco de dados demorou muito para responder.',
        hint: 'Tente novamente em instantes. Se o problema persistir, contate o suporte.',
      });
    }

    // Transação falhou
    if (err.code === 'P2034') {
      return reply.code(409).send({
        error: 'Conflito de transação detectado.',
        hint: 'Outra operação modificou os dados simultaneamente. Tente novamente.',
      });
    }

    // ── Erros de validação do Fastify (schema JSON) ──────────────────────
    if (err.validation) {
      return reply.code(422).send({
        error: 'Dados inválidos.',
        details: err.validation.map((v: any) => ({
          field: v.instancePath?.replace('/', '') ?? v.dataPath ?? 'desconhecido',
          message: v.message,
        })),
      });
    }

    // ── Multipart / upload ───────────────────────────────────────────────
    if (err.code === 'FST_FIELDS_LIMIT') {
      return reply.code(400).send({ error: 'Muitos campos no formulário enviado.' });
    }
    if (err.code === 'FST_FILES_LIMIT') {
      return reply.code(400).send({ error: 'Número máximo de arquivos excedido.' });
    }
    if (err.code === 'FST_PARTS_LIMIT') {
      return reply.code(400).send({ error: 'Número máximo de partes do formulário excedido.' });
    }

    // ── Rate limit ───────────────────────────────────────────────────────
    if (err.statusCode === 429) {
      return reply.code(429).send({
        error: 'Muitas requisições. Por favor, aguarde antes de tentar novamente.',
        retryAfter: reply.getHeader('Retry-After'),
      });
    }

    // ── JSON malformado ──────────────────────────────────────────────────
    if (err.statusCode === 400 && err.message?.includes('JSON')) {
      return reply.code(400).send({
        error: 'JSON malformado no corpo da requisição.',
        hint: 'Verifique a sintaxe do JSON enviado.',
      });
    }

    // ── Payload muito grande ─────────────────────────────────────────────
    if (err.statusCode === 413) {
      return reply.code(413).send({
        error: 'O corpo da requisição excede o tamanho máximo permitido.',
      });
    }

    // ── Erros HTTP com statusCode já definido ────────────────────────────
    const statusCode = err.statusCode && err.statusCode < 500 ? err.statusCode : 500;
    if (statusCode >= 500) {
      request.log.error({ err, path: request.url, method: request.method }, 'Erro interno');
    }

    reply.code(statusCode).send({
      error:
        statusCode >= 500
          ? 'Erro interno do servidor. Nossa equipe foi notificada.'
          : err.message || 'Erro na requisição.',
    });
  });
}