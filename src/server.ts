// src/server.ts
import 'dotenv/config';
import { buildApp } from './app';

const PORT = Number(process.env.PORT) || 3010;

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`clube-api rodando em http://localhost:${PORT} — health: /api/health`);
  } catch (err) {
    console.error('Falha ao iniciar o servidor', err);
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    app.log.info(`Sinal ${signal} recebido — encerrando`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
