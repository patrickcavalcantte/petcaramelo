// Adaptador mínimo: os testes de domínio foram escritos com describe/it/expect e rodam aqui em cima do node:test.
import { describe, it as nodeIt } from "node:test";
import assert from "node:assert/strict";

export { describe };

/** it(...) com it.each(tabela)(nome, fn), como no vitest. %s e %j viram o valor da linha. */
export const it = Object.assign((...a) => nodeIt(...a), {
  each: (tabela) => (nome, fn) => {
    for (const linha of tabela) {
      const args = Array.isArray(linha) ? linha : [linha];
      let i = 0;
      nodeIt(nome.replace(/%[sjd]/g, () => JSON.stringify(args[i++])), () => fn(...args));
    }
  },
});

export function expect(valor) {
  return {
    toBe: (esperado) => assert.strictEqual(valor, esperado),
    toEqual: (esperado) => assert.deepStrictEqual(valor, esperado),
    toBeNull: () => assert.strictEqual(valor, null),
    toHaveLength: (n) => assert.strictEqual(valor.length, n),
    toThrow: () => assert.throws(valor),
  };
}
