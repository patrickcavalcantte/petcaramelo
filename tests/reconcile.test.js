import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { reconciliar, normalizarCodigo, formatarCodigo } from "../js/reconcile.js";
import { emptyState, addGatos, mergeStates, todosGatos, updateGato } from "../js/logic.js";

const T0 = new Date("2026-10-01T12:00:00Z");
const T1 = new Date("2026-10-02T12:00:00Z");
const T2 = new Date("2026-10-03T12:00:00Z");

/** Uma "nuvem" de mentira com versão, igual ao salvar_estado do banco. */
function nuvem(estadoInicial = null) {
  let estado = estadoInicial;
  let versao = 1;
  return {
    get estado() { return estado; },
    // quem baixou guarda a versão; push só vale se ela ainda for a atual
    cliente() {
      let lida = 0;
      return {
        pull: async () => { lida = versao; return estado; },
        push: async (novo) => {
          if (lida !== versao) return false;
          estado = novo;
          versao += 1;
          return true;
        },
      };
    },
    /** Outra pessoa grava no meio do caminho. */
    gravaOutraPessoa(novo) { estado = novo; versao += 1; },
  };
}

function aparelho(inicial) {
  let s = inicial;
  return { get: () => s, set: (n) => { s = n; } };
}

describe("reconciliar", () => {
  test("primeira vez: não há nada na nuvem, o estado do aparelho sobe", async () => {
    const cloud = nuvem(null);
    const ap = aparelho(addGatos(emptyState(), "Frajola", T0).state);
    const c = cloud.cliente();
    const r = await reconciliar({ local: ap.get, pull: c.pull, push: c.push, merge: mergeStates, gravarLocal: ap.set });
    assert.equal(r.mudouAqui, false);
    assert.equal(todosGatos(cloud.estado).length, 1);
  });

  test("traz o que a outra pessoa fez e avisa que mudou aqui", async () => {
    const dela = addGatos(emptyState(), "Mingau", T1).state;
    const cloud = nuvem(dela);
    const ap = aparelho(addGatos(emptyState(), "Frajola", T0).state);
    const c = cloud.cliente();
    const r = await reconciliar({ local: ap.get, pull: c.pull, push: c.push, merge: mergeStates, gravarLocal: ap.set });
    assert.equal(r.mudouAqui, true);
    assert.deepEqual(todosGatos(ap.get()).map((g) => g.nome).sort(), ["Frajola", "Mingau"]);
    assert.deepEqual(todosGatos(cloud.estado).map((g) => g.nome).sort(), ["Frajola", "Mingau"]);
  });

  test("tudo igual: não grava nada", async () => {
    const s = addGatos(emptyState(), "Frajola", T0).state;
    const cloud = nuvem(s);
    let gravacoes = 0;
    const c = cloud.cliente();
    const ap = aparelho(s);
    await reconciliar({ local: ap.get, pull: c.pull, push: async (n) => { gravacoes += 1; return c.push(n); }, merge: mergeStates, gravarLocal: ap.set });
    assert.equal(gravacoes, 0);
  });

  test("conflito de versão: tenta de novo e não perde o que a outra pessoa gravou no meio", async () => {
    const base = addGatos(emptyState(), "Frajola", T0).state;
    const cloud = nuvem(base);
    const ap = aparelho(updateGato(base, base.gatos[0].id, { nome: "Frajola II" }, T2)); // eu editei
    const c = cloud.cliente();
    let primeira = true;
    const push = async (n) => {
      if (primeira) { // entre o meu download e a minha gravação, ela cadastra outro gato
        primeira = false;
        cloud.gravaOutraPessoa(addGatos(base, "Mingau", T1).state);
      }
      return c.push(n);
    };
    await reconciliar({ local: ap.get, pull: c.pull, push, merge: mergeStates, gravarLocal: ap.set });
    const nomes = todosGatos(cloud.estado).map((g) => g.nome).sort();
    assert.deepEqual(nomes, ["Frajola II", "Mingau"]); // a edição minha e o gato dela
    assert.deepEqual(todosGatos(ap.get()).map((g) => g.nome).sort(), nomes);
  });

  test("a pessoa mexe no aparelho durante o download: a alteração entra na junção", async () => {
    const cloud = nuvem(addGatos(emptyState(), "Mingau", T1).state);
    const ap = aparelho(emptyState());
    const c = cloud.cliente();
    const pull = async () => { const r = await c.pull(); ap.set(addGatos(ap.get(), "Pipoca", T2).state); return r; };
    await reconciliar({ local: ap.get, pull, push: c.push, merge: mergeStates, gravarLocal: ap.set });
    assert.deepEqual(todosGatos(cloud.estado).map((g) => g.nome).sort(), ["Mingau", "Pipoca"]);
  });

  test("desiste depois de várias tentativas seguidas com conflito", async () => {
    const cloud = nuvem(emptyState());
    const ap = aparelho(addGatos(emptyState(), "Frajola", T0).state); // há o que enviar, mas a gravação sempre conflita
    const c = cloud.cliente();
    await assert.rejects(
      reconciliar({ local: ap.get, pull: c.pull, push: async () => false, merge: mergeStates, gravarLocal: ap.set, tentativas: 3 }),
      /Muitas alterações/,
    );
  });
});

describe("código de convite", () => {
  test("aceita minúsculas, hífen e espaços", () => {
    assert.equal(normalizarCodigo(" abcd-ef 23 "), "ABCDEF23");
    assert.equal(normalizarCodigo(null), "");
  });
  test("mostra em dois blocos", () => {
    assert.equal(formatarCodigo("ABCDEF23"), "ABCD-EF23");
  });
});
