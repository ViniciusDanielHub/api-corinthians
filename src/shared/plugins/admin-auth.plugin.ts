import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';

export type AdminRole =
  | 'SUPER_ADMIN'
  | 'EDITOR_CHEFE'
  | 'EDITOR'
  | 'JORNALISTA'
  | 'COLUNISTA'
  | 'SOCIAL_MEDIA'
  | 'MODERADOR'
  | 'SEO_MANAGER';

// Cargos que podem escrever na clube-api. Ajuste essa lista conforme a
// regra de negócio (ex: talvez EDITOR também devesse poder).
const ALLOWED_ROLES: AdminRole[] = ['SUPER_ADMIN', 'EDITOR_CHEFE'];

interface DecodedAdminToken {
  id: string;
  role: AdminRole;
  jti?: string;
  iat?: number;
  exp?: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    admin?: { id: string; role: AdminRole };
  }
}

export async function requireAdminAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret) {
    request.log.error(
      'JWT_SECRET não configurada na clube-api — bloqueando rota admin',
    );
    return reply.code(503).send({ error: 'API não configurada corretamente.' });
  }

  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({
      error: 'Token de autenticação ausente. Use o header: Authorization: Bearer <token>.',
    });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return reply.code(401).send({ error: 'Token vazio após "Bearer ".' });
  }

  let decoded: DecodedAdminToken;
  try {
    decoded = jwt.verify(token, secret) as DecodedAdminToken;
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return reply.code(401).send({ error: 'Token expirado. Faça login novamente.' });
    }
    return reply.code(401).send({ error: 'Token inválido.' });
  }

  if (!decoded?.id || !decoded?.role) {
    return reply.code(401).send({ error: 'Payload do token inválido ou incompleto.' });
  }

  if (!ALLOWED_ROLES.includes(decoded.role)) {
    request.log.warn(
      { userId: decoded.id, role: decoded.role },
      'Tentativa de acesso à clube-api com cargo insuficiente',
    );
    return reply.code(403).send({
      error: `Seu cargo (${decoded.role}) não tem permissão para acessar esta API.`,
      requiredRoles: ALLOWED_ROLES,
    });
  }

  request.admin = { id: decoded.id, role: decoded.role };
}