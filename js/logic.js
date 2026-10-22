// Estado do app e regras. Funções puras: recebem o estado e devolvem um estado novo.
// Sem DOM, sem localStorage direto (a não ser em createStore, que recebe o storage). Tudo aqui é testado em tests/.
//
// Cada registro tem `id` e `updatedAt`. Apagar vira `deleted: true` (lápide), para que apagar
// num aparelho também apague nos outros quando os estados se juntam (mergeStates).
import { estimarEstoque, consumoMedio } from "./domain/estoque.js";
import { CATEGORIA_POR_TIPO } from "./domain/gastos.js";
import { nomesEmLote } from "./domain/lote.js";
import { normalizarTitulo } from "./domain/vencimentos.js";

export const STATE_VERSION = 1;
export const STORAGE_KEY = "pet-caramelo:v1";
const COLECOES = ["gatos", "eventos", "anexos", "itens", "movimentos", "gastos"];

export function emptyState() {
  return { version: STATE_VERSION, gatos: [], eventos: [], anexos: [], itens: [], movimentos: [], gastos: [], savedAt: null };
}

/** Este estado tem algo que a pessoa registrou? */
export function hasUserData(state) {
  return COLECOES.some((k) => (state?.[k] ?? []).some((x) => !x.deleted));
}

export const newId = () =>
  crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

const live = (list) => (list ?? []).filter((x) => !x.deleted);
export const gatosAtivos = (s) => live(s.gatos).filter((g) => g.ativo);
export const todosGatos = (s) => live(s.gatos);
export const eventosVivos = (s) => live(s.eventos);
export const itensAtivos = (s) => live(s.itens).filter((i) => i.ativo);
export const gastosVivos = (s) => live(s.gastos);
export const anexosVivos = (s) => live(s.anexos);

const stamp = (obj, now) => ({ ...obj, updatedAt: now.toISOString() });
const trocar = (list, id, fn) => list.map((x) => (x.id === id ? fn(x) : x));
const limpar = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

// ---------- Gatos ----------

/** Cadastro em lote. Devolve { state, novos, ignorados, invalidos }. */
export function addGatos(state, texto, now, id = newId) {
  const r = nomesEmLote(texto, todosGatos(state).map((g) => g.nome));
  const criados = r.novos.map((nome) => stamp({ id: id(), nome, nascimento: null, sexo: null, castrado: false, descricao: null, microchip: null, observacoes: null, ativo: true }, now));
  return { ...r, state: { ...state, gatos: [...state.gatos, ...criados] } };
}

export function updateGato(state, id, dados, now) {
  const campos = {
    nome: dados.nome,
    nascimento: dados.nascimento ?? null,
    sexo: dados.sexo ?? null,
    castrado: Boolean(dados.castrado),
    descricao: dados.descricao ?? null,
    microchip: dados.microchip ?? null,
    observacoes: dados.observacoes ?? null,
  };
  return { ...state, gatos: trocar(state.gatos, id, (g) => stamp({ ...g, ...campos }, now)) };
}

export function setGatoAtivo(state, id, ativo, now) {
  return { ...state, gatos: trocar(state.gatos, id, (g) => stamp({ ...g, ativo }, now)) };
}

/**
 * Apaga o gato, o histórico e os documentos dele. Os gastos ficam (dinheiro gasto de verdade), só perdem o vínculo.
 * Devolve também os caminhos no Storage para o app apagar os arquivos.
 */
export function deleteGato(state, id, now) {
  const paths = anexosVivos(state).filter((a) => a.gatoId === id).map((a) => a.storagePath);
  const lapide = (x) => stamp({ ...x, deleted: true }, now);
  return {
    paths,
    state: {
      ...state,
      gatos: trocar(state.gatos, id, lapide),
      eventos: state.eventos.map((e) => (e.gatoId === id && !e.deleted ? lapide(e) : e)),
      anexos: state.anexos.map((a) => (a.gatoId === id && !a.deleted ? lapide(a) : a)),
      gastos: state.gastos.map((g) => (g.gatoId === id && !g.deleted ? stamp({ ...g, gatoId: null }, now) : g)),
    },
  };
}

// ---------- Saúde ----------

/**
 * Um registro por gato. Com valor, um único gasto, ligado ao gato só quando o evento é de um gato só.
 * `e` vem de validarEvento.
 */
export function registrarEventos(state, e, now, id = newId) {
  let gastos = state.gastos;
  let gastoId = null;
  if (e.valorCentavos !== undefined) {
    gastoId = id();
    gastos = [...gastos, stamp({
      id: gastoId, data: e.data, valorCentavos: e.valorCentavos,
      categoria: CATEGORIA_POR_TIPO[e.tipo] ?? "outro",
      descricao: e.titulo, loja: e.loja ?? null, gatoId: e.gatoIds.length === 1 ? e.gatoIds[0] : null,
    }, now)];
  }
  const novos = e.gatoIds.map((gatoId_) => stamp({
    id: id(), gatoId: gatoId_, tipo: e.tipo, data: e.data, titulo: e.titulo,
    detalhes: e.detalhes ?? null, pesoKg: e.pesoKg ?? null, proximaData: e.proximaData ?? null, gastoId,
  }, now));
  return { ...state, gastos, eventos: [...state.eventos, ...novos] };
}

/** Apaga o registro e os documentos ligados a ele. O gasto continua. Devolve os caminhos do Storage. */
export function deleteEvento(state, id, now) {
  const paths = anexosVivos(state).filter((a) => a.eventoId === id).map((a) => a.storagePath);
  const lapide = (x) => stamp({ ...x, deleted: true }, now);
  return {
    paths,
    state: {
      ...state,
      eventos: trocar(state.eventos, id, lapide),
      anexos: state.anexos.map((a) => (a.eventoId === id && !a.deleted ? lapide(a) : a)),
    },
  };
}

/** Mais recente primeiro; no mesmo dia, o lançado por último. */
export function eventosDoGato(state, gatoId) {
  return eventosVivos(state)
    .filter((e) => e.gatoId === gatoId)
    .sort((a, b) => b.data.localeCompare(a.data) || (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
}

export function ultimoPeso(state, gatoId) {
  return eventosDoGato(state, gatoId).find((e) => e.pesoKg !== null)?.pesoKg ?? null;
}

/** Títulos já usados, para sugerir no formulário. */
export function titulosUsados(state) {
  return [...new Set(eventosVivos(state).map((e) => e.titulo))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Eventos de gatos ativos, no formato que calcularVencimentos espera. */
export function eventosParaVencimento(state, apenasGatoId = null) {
  const ativos = new Set(gatosAtivos(state).map((g) => g.id));
  return eventosVivos(state)
    .filter((e) => (apenasGatoId ? e.gatoId === apenasGatoId : ativos.has(e.gatoId)))
    .map((e) => ({ id: e.id, gatoId: e.gatoId, tipo: e.tipo, titulo: e.titulo, data: e.data, proximaData: e.proximaData }));
}

// ---------- Documentos (metadados; o arquivo fica no Storage) ----------

export function addAnexo(state, a, now, id = newId) {
  return { ...state, anexos: [...state.anexos, stamp({ id: id(), eventoId: null, ...a }, now)] };
}

export function deleteAnexo(state, id, now) {
  return { ...state, anexos: trocar(state.anexos, id, (a) => stamp({ ...a, deleted: true }, now)) };
}

// ---------- Estoque ----------

export function criarItem(state, i, now, id = newId) {
  const item = stamp({ id: id(), nome: i.nome, categoria: i.categoria, unidade: i.unidade, consumoDiario: i.consumoDiario, alertaDias: i.alertaDias, ativo: true }, now);
  return { ...state, itens: [...state.itens, item] };
}

export function arquivarItem(state, itemId, now) {
  return { ...state, itens: trocar(state.itens, itemId, (i) => stamp({ ...i, ativo: false }, now)) };
}

/** Compra: soma ao estoque e, com valor, lança o gasto (na categoria do item) junto. */
export function registrarCompra(state, c, now, id = newId) {
  const item = live(state.itens).find((i) => i.id === c.itemId);
  if (!item) throw new Error("Item não encontrado");
  let gastos = state.gastos;
  let gastoId = null;
  if (c.valorCentavos !== undefined) {
    gastoId = id();
    gastos = [...gastos, stamp({ id: gastoId, data: c.data, valorCentavos: c.valorCentavos, categoria: item.categoria, descricao: item.nome, loja: c.loja ?? null, gatoId: null }, now)];
  }
  const mov = stamp({ id: id(), itemId: c.itemId, tipo: "compra", quantidade: c.quantidade, data: c.data, gastoId }, now);
  return { ...state, gastos, movimentos: [...state.movimentos, mov] };
}

/** Ração e areia pelo nome; o resto é "outro". Só decide a categoria do gasto. */
export function categoriaPorNome(nome) {
  const n = normalizarTitulo(nome);
  if (n.includes("racao")) return "racao";
  if (n.includes("areia") || n.includes("silica")) return "areia";
  return "outro";
}

/**
 * Compra pelo nome do item: se ele ainda não existe, é criado aqui (sem consumo definido; a média real
 * vem quando a pessoa disser que acabou). Item arquivado com o mesmo nome volta a ser usado.
 * `c` vem de validarCompra: { nome, unidade, quantidade, data, valorCentavos?, loja? }.
 */
export function comprarItem(state, c, now, id = newId) {
  const chave = normalizarTitulo(c.nome);
  const existente = live(state.itens).find((i) => normalizarTitulo(i.nome) === chave);
  let s = state;
  let itemId;
  if (existente) {
    itemId = existente.id;
    if (!existente.ativo) s = { ...s, itens: trocar(s.itens, itemId, (i) => stamp({ ...i, ativo: true }, now)) };
  } else {
    itemId = id();
    s = criarItem(s, { nome: c.nome, categoria: categoriaPorNome(c.nome), unidade: c.unidade, consumoDiario: 0, alertaDias: 7 }, now, () => itemId);
  }
  return registrarCompra(s, { itemId, quantidade: c.quantidade, data: c.data, valorCentavos: c.valorCentavos, loja: c.loja }, now, id);
}

export function registrarContagem(state, c, now, id = newId) {
  if (!live(state.itens).some((i) => i.id === c.itemId)) throw new Error("Item não encontrado");
  const mov = stamp({ id: id(), itemId: c.itemId, tipo: "contagem", quantidade: c.quantidade, data: c.data, gastoId: null }, now);
  return { ...state, movimentos: [...state.movimentos, mov] };
}

/** O gasto ligado a uma compra continua: é dinheiro gasto de fato. */
export function deleteMovimento(state, id, now) {
  return { ...state, movimentos: trocar(state.movimentos, id, (m) => stamp({ ...m, deleted: true }, now)) };
}

/**
 * Itens ativos com estimativa e consumo. O consumo usado é a média real (compra até "acabou") assim que existir;
 * antes disso, o valor que o item trouxer (itens antigos), ou 0 (sem estimativa de quando acaba).
 * `situacao` diz em que pé o item está: "vazio" (sem compra), "em_uso" ou "acabou".
 */
export function estoqueDe(state, hoje) {
  return itensAtivos(state).map((item) => {
    const movimentos = live(state.movimentos)
      .filter((m) => m.itemId === item.id)
      .map((m) => ({ ...m, criadoEm: m.updatedAt }))
      .sort((a, b) => a.data.localeCompare(b.data) || (a.criadoEm ?? "").localeCompare(b.criadoEm ?? ""));
    const consumo = consumoMedio(movimentos);
    const consumoEfetivo = consumo?.porDia ?? item.consumoDiario ?? 0;
    return {
      ...item,
      movimentos,
      consumo,
      consumoEfetivo,
      situacao: situacaoDoItem(movimentos),
      estimativa: estimarEstoque(movimentos, consumoEfetivo, hoje, item.alertaDias ?? 7),
    };
  });
}

/** { tipo: "vazio" | "em_uso" | "acabou", desde, comprado, acabouEm }. "Em uso" conta desde a primeira compra depois do último "acabou". */
export function situacaoDoItem(movimentos) {
  let desde = null;
  let comprado = 0;
  let acabouEm = null;
  for (const m of movimentos) {
    if (m.tipo === "contagem" && m.quantidade === 0) {
      acabouEm = m.data;
      desde = null;
      comprado = 0;
    } else if (m.tipo === "compra") {
      desde ??= m.data;
      comprado += m.quantidade;
      acabouEm = null;
    } else {
      desde = m.data;
      comprado = m.quantidade;
      acabouEm = null;
    }
  }
  if (movimentos.length === 0) return { tipo: "vazio", desde: null, comprado: 0, acabouEm: null };
  if (acabouEm) return { tipo: "acabou", desde: null, comprado: 0, acabouEm };
  return { tipo: "em_uso", desde, comprado, acabouEm: null };
}

// ---------- Gastos ----------

export function criarGasto(state, g, now, id = newId) {
  const gasto = stamp(limpar({ id: id(), data: g.data, valorCentavos: g.valorCentavos, categoria: g.categoria, descricao: g.descricao ?? null, loja: g.loja ?? null, gatoId: g.gatoId ?? null }), now);
  return { ...state, gastos: [...state.gastos, gasto] };
}

export function deleteGasto(state, id, now) {
  return {
    ...state,
    gastos: trocar(state.gastos, id, (g) => stamp({ ...g, deleted: true }, now)),
    // Compra ou cuidado que apontava para este gasto fica sem ele.
    eventos: state.eventos.map((e) => (e.gastoId === id ? stamp({ ...e, gastoId: null }, now) : e)),
    movimentos: state.movimentos.map((m) => (m.gastoId === id ? stamp({ ...m, gastoId: null }, now) : m)),
  };
}

/** Gastos do mês ("YYYY-MM"), mais recentes primeiro. */
export function gastosDoMes(state, mes) {
  return gastosVivos(state)
    .filter((g) => g.data.startsWith(mes))
    .sort((a, b) => b.data.localeCompare(a.data) || (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
}

// ---------- Juntar estados (aparelho + nuvem) ----------

function mergeLista(a = [], b = []) {
  const mapa = new Map();
  for (const x of [...a, ...b]) {
    const atual = mapa.get(x.id);
    // O mais recente vence. Empate: fica o que já estava (a).
    if (!atual || (x.updatedAt ?? "") > (atual.updatedAt ?? "")) mapa.set(x.id, x);
  }
  return [...mapa.values()];
}

export function mergeStates(a, b) {
  if (!b) return a;
  if (!a) return b;
  const out = { ...emptyState(), version: STATE_VERSION };
  for (const k of COLECOES) out[k] = mergeLista(a[k], b[k]);
  out.savedAt = [a.savedAt, b.savedAt].filter(Boolean).sort().pop() ?? null;
  return out;
}

// ---------- Persistência ----------

/** Guarda o estado no storage recebido (localStorage). Se não houver storage, tudo segue só na memória. */
export function createStore(storage, key = STORAGE_KEY) {
  return {
    load() {
      try {
        const raw = storage?.getItem(key);
        if (!raw) return emptyState();
        const parsed = JSON.parse(raw);
        const base = emptyState();
        for (const k of COLECOES) base[k] = Array.isArray(parsed[k]) ? parsed[k] : [];
        base.savedAt = parsed.savedAt ?? null;
        return base;
      } catch {
        return emptyState();
      }
    },
    save(state) {
      try {
        storage?.setItem(key, JSON.stringify(state));
        return Boolean(storage);
      } catch {
        return false;
      }
    },
  };
}
