// src/shared/json/bigint-serialization.ts
//
// O Prisma representa campos `BigInt` do schema (ex: PlayerMovement.valueCents)
// como o tipo nativo `bigint` do JS. O `JSON.stringify` (usado pelo Fastify
// para serializar respostas quando não há schema de output) NÃO sabe lidar
// com BigInt e lança:
//
//   TypeError: Do not know how to serialize a BigInt
//
// Isso derrubava com 500 qualquer resposta que incluísse um PlayerMovement
// com `valueCents` preenchido (POST/PATCH/GET /movements, /movements/recent,
// /squad/:id/movements) — bug crítico, pois movimentação com valor é o caso
// de uso mais comum do módulo.
//
// Em vez de converter manualmente em cada rota (fácil de esquecer em uma
// nova rota futura), patcheamos `BigInt.prototype.toJSON` uma única vez no
// boot da aplicação. Isso faz `JSON.stringify` chamar esse método e
// devolver o valor como string — mesmo padrão que o módulo finance já usava
// manualmente (`valueCents.toString()`), só que agora é garantido em
// qualquer lugar do código, presente ou futuro.
//
// Precisa ser importado antes de qualquer outro módulo que possa serializar
// uma resposta (ou seja, no topo de server.ts).
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (this: bigint) {
  return this.toString();
};

export { };