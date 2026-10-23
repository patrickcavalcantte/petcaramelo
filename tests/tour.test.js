import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PASSOS, precisaTour, marcarTour, chaveTour, passoSeguinte, passoAnterior, ehUltimo } from "../js/tour.js";

const fake = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

describe("onboarding", () => {
  test("aparece até a pessoa terminar ou pular, depois não volta", () => {
    const st = fake();
    assert.equal(precisaTour(st, "u1"), true);
    marcarTour(st, "u1");
    assert.equal(precisaTour(st, "u1"), false);
  });

  test("cada pessoa tem o seu: quem entra na Galera depois também vê", () => {
    const st = fake();
    marcarTour(st, "marido");
    assert.equal(precisaTour(st, "marido"), false);
    assert.equal(precisaTour(st, "esposa"), true);
    assert.notEqual(chaveTour("a"), chaveTour("b"));
  });

  test("sem storage (modo privado, bloqueado) não fica insistindo", () => {
    assert.equal(precisaTour(null, "u1"), false);
    assert.equal(precisaTour({ getItem() { throw new Error("bloqueado"); } }, "u1"), false);
    assert.doesNotThrow(() => marcarTour({ setItem() { throw new Error("cheio"); } }, "u1"));
  });

  test("navegação entre passos para nas pontas", () => {
    assert.equal(passoAnterior(0), 0);
    assert.equal(passoSeguinte(PASSOS.length - 1), PASSOS.length - 1);
    assert.equal(passoSeguinte(0), 1);
    assert.equal(ehUltimo(PASSOS.length - 1), true);
    assert.equal(ehUltimo(0), false);
  });

  test("todo passo tem título, ícone e texto; só o último é marcado como último", () => {
    for (const p of PASSOS) {
      assert.ok(p.titulo && p.icone && p.texto.length > 0);
    }
    assert.equal(PASSOS.filter((p) => p.ultimo).length, 1);
    assert.equal(PASSOS.at(-1).ultimo, true);
  });

  test("o passo do estoque mostra o fluxo certo, na ordem", () => {
    const estoque = PASSOS.find((p) => p.fluxo);
    assert.deepEqual(estoque.fluxo, ["Comprei", "Abri o pacote", "Acabou"]);
  });
});
