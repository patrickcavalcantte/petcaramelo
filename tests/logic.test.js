import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  emptyState, hasUserData, addGatos, updateGato, setGatoAtivo, deleteGato, registrarEventos, deleteEvento,
  addAnexo, criarItem, registrarCompra, registrarContagem, estoqueDe, comprarItem, categoriaPorNome, situacaoDoItem, arquivarItem, criarGasto, deleteGasto, gastosDoMes,
  eventosDoGato, ultimoPeso, titulosUsados, eventosParaVencimento, gatosAtivos, todosGatos, anexosVivos,
  mergeStates, createStore,
} from "../js/logic.js";
import { calcularVencimentos } from "../js/domain/vencimentos.js";

const T0 = new Date("2026-10-01T12:00:00Z");
const T1 = new Date("2026-10-02T12:00:00Z");
const T2 = new Date("2026-10-03T12:00:00Z");
const contador = () => { let n = 0; return () => `id${++n}`; };

const comGatos = (nomes = "Frajola\nMingau", id = contador()) => addGatos(emptyState(), nomes, T0, id).state;

describe("gatos", () => {
  test("cadastro em lote ignora repetidos, inclusive os já existentes", () => {
    const r = addGatos(comGatos("Frajola"), "frajola\nPipoca", T1);
    assert.deepEqual(r.novos, ["Pipoca"]);
    assert.deepEqual(r.ignorados, ["frajola"]);
    assert.equal(todosGatos(r.state).length, 2);
  });

  test("arquivar tira dos ativos mas mantém o gato", () => {
    const s = comGatos();
    const arq = setGatoAtivo(s, s.gatos[0].id, false, T1);
    assert.equal(gatosAtivos(arq).length, 1);
    assert.equal(todosGatos(arq).length, 2);
  });

  test("editar guarda os campos e carimba updatedAt", () => {
    const s = comGatos();
    const novo = updateGato(s, s.gatos[0].id, { nome: "Frajola II", sexo: "macho", castrado: true }, T2);
    assert.equal(novo.gatos[0].nome, "Frajola II");
    assert.equal(novo.gatos[0].castrado, true);
    assert.equal(novo.gatos[0].updatedAt, T2.toISOString());
  });
});

describe("eventos de saúde", () => {
  const base = () => {
    const s = comGatos("A\nB", contador());
    return { s, a: s.gatos[0].id, b: s.gatos[1].id };
  };
  const ev = (o) => ({ tipo: "vermifugo", data: "2026-10-01", titulo: "Drontal", ...o });

  test("um registro por gato, com um único gasto para o lote", () => {
    const { s, a, b } = base();
    const r = registrarEventos(s, ev({ gatoIds: [a, b], valorCentavos: 9000, loja: "Pet" }), T1, contador());
    assert.equal(r.eventos.length, 2);
    assert.equal(r.gastos.length, 1);
    assert.equal(r.gastos[0].categoria, "remedio");
    assert.equal(r.gastos[0].gatoId, null); // vários gatos: gasto da Galera
    assert.equal(r.eventos[0].gastoId, r.gastos[0].id);
  });

  test("com um gato só, o gasto fica ligado a ele", () => {
    const { s, a } = base();
    const r = registrarEventos(s, ev({ gatoIds: [a], valorCentavos: 5000, tipo: "consulta" }), T1);
    assert.equal(r.gastos[0].gatoId, a);
    assert.equal(r.gastos[0].categoria, "consulta");
  });

  test("sem valor, não cria gasto", () => {
    const { s, a } = base();
    assert.equal(registrarEventos(s, ev({ gatoIds: [a] }), T1).gastos.length, 0);
  });

  test("último peso é o do evento mais recente com peso", () => {
    const { s, a } = base();
    let r = registrarEventos(s, ev({ gatoIds: [a], tipo: "pesagem", titulo: "Peso", pesoKg: 4, data: "2026-09-01" }), T0);
    r = registrarEventos(r, ev({ gatoIds: [a], tipo: "pesagem", titulo: "Peso", pesoKg: 4.3, data: "2026-10-01" }), T1);
    r = registrarEventos(r, ev({ gatoIds: [a], tipo: "consulta", titulo: "Retorno", data: "2026-10-02" }), T2);
    assert.equal(ultimoPeso(r, a), 4.3);
    assert.equal(eventosDoGato(r, a)[0].titulo, "Retorno");
  });

  test("a V5 nova encerra a pendência da V5 antiga", () => {
    const { s, a } = base();
    let r = registrarEventos(s, ev({ gatoIds: [a], tipo: "vacina", titulo: "V5", data: "2025-10-20", proximaData: "2026-10-20" }), T0);
    assert.equal(calcularVencimentos(eventosParaVencimento(r), "2026-10-10", 30).length, 1);
    r = registrarEventos(r, ev({ gatoIds: [a], tipo: "vacina", titulo: "v5 ", data: "2026-10-09" }), T1);
    assert.equal(calcularVencimentos(eventosParaVencimento(r), "2026-10-10", 30).length, 0);
  });

  test("gato arquivado não gera pendência no painel", () => {
    const { s, a } = base();
    let r = registrarEventos(s, ev({ gatoIds: [a], tipo: "vacina", titulo: "V5", proximaData: "2026-10-20" }), T0);
    r = setGatoAtivo(r, a, false, T1);
    assert.equal(eventosParaVencimento(r).length, 0);
  });

  test("títulos usados vêm sem repetição e em ordem", () => {
    const { s, a } = base();
    let r = registrarEventos(s, ev({ gatoIds: [a], titulo: "V5" }), T0);
    r = registrarEventos(r, ev({ gatoIds: [a], titulo: "Drontal" }), T1);
    r = registrarEventos(r, ev({ gatoIds: [a], titulo: "V5" }), T2);
    assert.deepEqual(titulosUsados(r), ["Drontal", "V5"]);
  });

  test("apagar o evento leva os documentos dele e devolve os caminhos; o gasto fica", () => {
    const { s, a } = base();
    let r = registrarEventos(s, ev({ gatoIds: [a], valorCentavos: 1000 }), T0, contador());
    const eventoId = r.eventos[0].id;
    r = addAnexo(r, { gatoId: a, eventoId, storagePath: "u/a/1.pdf", nomeArquivo: "laudo.pdf" }, T1, () => "anx1");
    r = addAnexo(r, { gatoId: a, storagePath: "u/a/2.pdf", nomeArquivo: "solto.pdf" }, T1, () => "anx2");
    const { state, paths } = deleteEvento(r, eventoId, T2);
    assert.deepEqual(paths, ["u/a/1.pdf"]);
    assert.equal(eventosDoGato(state, a).length, 0);
    assert.equal(anexosVivos(state).length, 1);
    assert.equal(state.gastos.filter((g) => !g.deleted).length, 1);
  });

  test("apagar o gato leva histórico e documentos, mas os gastos ficam sem vínculo", () => {
    const { s, a, b } = base();
    let r = registrarEventos(s, ev({ gatoIds: [a], valorCentavos: 2000 }), T0, contador());
    r = addAnexo(r, { gatoId: a, storagePath: "u/a/1.pdf", nomeArquivo: "x.pdf" }, T1);
    r = registrarEventos(r, ev({ gatoIds: [b] }), T1);
    const { state, paths } = deleteGato(r, a, T2);
    assert.deepEqual(paths, ["u/a/1.pdf"]);
    assert.equal(todosGatos(state).length, 1);
    assert.equal(eventosDoGato(state, a).length, 0);
    assert.equal(eventosDoGato(state, b).length, 1);
    assert.equal(state.gastos[0].deleted, undefined);
    assert.equal(state.gastos[0].gatoId, null);
  });
});

describe("estoque", () => {
  const item = { nome: "Areia", categoria: "areia", unidade: "kg", consumoDiario: 1, alertaDias: 7 };

  test("contagem + compra + consumo dão a estimativa", () => {
    let s = criarItem(emptyState(), item, T0, () => "i1");
    s = registrarContagem(s, { itemId: "i1", quantidade: 10, data: "2026-10-01" }, T0, contador());
    s = registrarCompra(s, { itemId: "i1", quantidade: 5, data: "2026-10-03" }, T1, contador());
    const [i] = estoqueDe(s, "2026-10-05");
    // 10 - 2 dias = 8; +5 = 13; -2 dias = 11
    assert.equal(i.estimativa.quantidade, 11);
    assert.equal(i.estimativa.diasRestantes, 11);
  });

  test("compra com valor lança o gasto na categoria do item; sem valor, não", () => {
    let s = criarItem(emptyState(), item, T0, () => "i1");
    s = registrarCompra(s, { itemId: "i1", quantidade: 5, data: "2026-10-03", valorCentavos: 7000, loja: "Pet" }, T1, contador());
    s = registrarCompra(s, { itemId: "i1", quantidade: 5, data: "2026-10-04" }, T2, contador());
    assert.equal(s.gastos.length, 1);
    assert.equal(s.gastos[0].categoria, "areia");
    assert.equal(s.gastos[0].descricao, "Areia");
    assert.equal(s.movimentos[0].gastoId, s.gastos[0].id);
  });

  test("compra de item que não existe falha", () => {
    assert.throws(() => registrarCompra(emptyState(), { itemId: "x", quantidade: 1, data: "2026-10-01" }, T0));
  });
});

describe("comprar pelo nome e acabar", () => {
  const compra = (o) => ({ nome: "Ração", unidade: "kg", quantidade: 15, data: "2026-09-22", ...o });

  test("a primeira compra cria o item; a segunda reaproveita pelo nome (sem caixa nem acento)", () => {
    let s = comprarItem(emptyState(), compra(), T0, contador());
    s = comprarItem(s, compra({ nome: "racao ", data: "2026-10-05" }), T1, contador());
    assert.equal(s.itens.length, 1);
    assert.equal(s.itens[0].categoria, "racao");
    assert.equal(s.movimentos.length, 2);
  });

  test("compra com valor vira gasto na categoria certa", () => {
    const s = comprarItem(emptyState(), compra({ nome: "Areia de sílica", valorCentavos: 8000 }), T0, contador());
    assert.equal(s.gastos[0].categoria, "areia");
    assert.equal(categoriaPorNome("Petisco"), "outro");
  });

  test("item arquivado volta ao comprar de novo", () => {
    let s = comprarItem(emptyState(), compra(), T0, contador());
    s = arquivarItem(s, s.itens[0].id, T1);
    assert.equal(estoqueDe(s, "2026-10-22").length, 0);
    s = comprarItem(s, compra({ data: "2026-10-10" }), T2, contador());
    assert.equal(estoqueDe(s, "2026-10-22").length, 1);
  });

  test("sem consumo definido não há previsão; depois de acabar, a média real passa a valer", () => {
    let s = comprarItem(emptyState(), compra(), T0, contador());
    let [i] = estoqueDe(s, "2026-10-01");
    assert.equal(i.situacao.tipo, "em_uso");
    assert.equal(i.consumo, null);
    assert.equal(i.consumoEfetivo, 0);
    assert.equal(i.estimativa.acabaEm, null);

    s = registrarContagem(s, { itemId: i.id, quantidade: 0, data: "2026-10-22" }, T1, contador()); // 15 kg em 30 dias
    [i] = estoqueDe(s, "2026-10-22");
    assert.equal(i.situacao.tipo, "acabou");
    assert.equal(i.consumo.porDia, 0.5);
    assert.equal(i.consumoEfetivo, 0.5);

    // nova compra: agora a estimativa usa 0,5 kg/dia
    s = comprarItem(s, compra({ quantidade: 10, data: "2026-10-23" }), T2, contador());
    [i] = estoqueDe(s, "2026-10-25");
    assert.equal(i.situacao.tipo, "em_uso");
    assert.equal(i.estimativa.quantidade, 9);
    assert.equal(i.estimativa.diasRestantes, 18);
  });

  test("situação do item", () => {
    assert.deepEqual(situacaoDoItem([]), { tipo: "vazio", desde: null, comprado: 0, acabouEm: null });
    const compras = [{ tipo: "compra", data: "2026-10-01", quantidade: 5 }, { tipo: "compra", data: "2026-10-10", quantidade: 5 }];
    assert.deepEqual(situacaoDoItem(compras), { tipo: "em_uso", desde: "2026-10-01", comprado: 10, acabouEm: null });
    assert.equal(situacaoDoItem([...compras, { tipo: "contagem", data: "2026-10-20", quantidade: 0 }]).tipo, "acabou");
  });
});

describe("gastos", () => {
  test("lista só o mês pedido e apagar tira o gasto da lista", () => {
    let s = criarGasto(emptyState(), { data: "2026-10-05", valorCentavos: 1000, categoria: "petisco" }, T0, () => "g1");
    s = criarGasto(s, { data: "2026-09-30", valorCentavos: 500, categoria: "outro" }, T0, () => "g2");
    assert.deepEqual(gastosDoMes(s, "2026-10").map((g) => g.id), ["g1"]);
    s = deleteGasto(s, "g1", T1);
    assert.equal(gastosDoMes(s, "2026-10").length, 0);
  });
});

describe("juntar estados (aparelho + nuvem)", () => {
  test("une registros de aparelhos diferentes", () => {
    const a = comGatos("A", () => "ga");
    const b = comGatos("B", () => "gb");
    assert.deepEqual(todosGatos(mergeStates(a, b)).map((g) => g.id).sort(), ["ga", "gb"]);
  });

  test("a edição mais recente vence", () => {
    const base = comGatos("A", () => "ga");
    const a = updateGato(base, "ga", { nome: "Antigo" }, T1);
    const b = updateGato(base, "ga", { nome: "Novo" }, T2);
    assert.equal(mergeStates(a, b).gatos[0].nome, "Novo");
    assert.equal(mergeStates(b, a).gatos[0].nome, "Novo");
  });

  test("apagar num aparelho apaga no outro (lápide mais recente vence)", () => {
    const base = comGatos("A", () => "ga");
    const apagado = deleteGato(base, "ga", T2).state;
    assert.equal(todosGatos(mergeStates(base, apagado)).length, 0);
    assert.equal(todosGatos(mergeStates(apagado, base)).length, 0);
  });

  test("edição mais recente que a lápide ressuscita o registro", () => {
    const base = comGatos("A", () => "ga");
    const apagado = deleteGato(base, "ga", T1).state;
    const editado = updateGato(base, "ga", { nome: "A2" }, T2);
    assert.equal(todosGatos(mergeStates(apagado, editado)).length, 1);
  });

  test("sem estado remoto devolve o local; mesmo estado não muda nada", () => {
    const a = comGatos();
    assert.equal(mergeStates(a, null), a);
    assert.deepEqual(mergeStates(a, a).gatos, a.gatos);
  });

  test("hasUserData ignora o que foi apagado", () => {
    const s = comGatos("A", () => "ga");
    assert.equal(hasUserData(s), true);
    assert.equal(hasUserData(deleteGato(s, "ga", T1).state), false);
    assert.equal(hasUserData(emptyState()), false);
  });
});

describe("persistência", () => {
  const fake = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

  test("guarda e recarrega", () => {
    const st = createStore(fake());
    assert.equal(st.save(comGatos("A")), true);
    assert.equal(todosGatos(st.load()).length, 1);
  });

  test("storage quebrado ou JSON inválido não derruba o app", () => {
    assert.equal(createStore(null).save(emptyState()), false);
    assert.equal(createStore({ getItem: () => "{nao e json", setItem() {} }).load().gatos.length, 0);
    assert.equal(createStore({ getItem: () => null, setItem() { throw new Error("cheio"); } }).save(emptyState()), false);
  });

  test("estado salvo com coleção faltando ainda carrega", () => {
    const st = createStore({ getItem: () => JSON.stringify({ gatos: [{ id: "x", nome: "A", ativo: true }] }), setItem() {} });
    const s = st.load();
    assert.equal(s.gatos.length, 1);
    assert.deepEqual(s.eventos, []);
  });
});
