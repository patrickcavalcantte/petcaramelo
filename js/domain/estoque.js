import { diasEntre, somarDias } from "./datas.js";

/**
 * O estoque é estimado, não registrado dia a dia.
 *
 * Modelo: uma "contagem" fixa a quantidade real naquele dia; uma "compra"
 * soma; entre eventos, o item é consumido a `consumoDiario`, sem ficar
 * negativo. Percorrer os eventos em ordem (em vez de fazer uma conta
 * linear única) evita subestimar o estoque quando ele zerou e depois
 * houve compra: o consumo do período em que estava zerado não "come" a
 * compra seguinte.
 *
 * Movimento: { tipo: "compra" | "contagem", quantidade, data: "YYYY-MM-DD", criadoEm? (desempate no mesmo dia) }
 * Status: "sem_dados" | "ok" | "baixo" | "acabou"
 */

function ordenar(movs) {
  return [...movs].sort((a, b) => a.data.localeCompare(b.data) || (a.criadoEm ?? "").localeCompare(b.criadoEm ?? ""));
}

/** Devolve { quantidade, diasRestantes, acabaEm, status }. diasRestantes é null sem consumo ou sem dados. */
export function estimarEstoque(movimentos, consumoDiario, hoje, alertaDias = 7) {
  const movs = ordenar(movimentos).filter((m) => diasEntre(m.data, hoje) >= 0);
  if (movs.length === 0) {
    return { quantidade: null, diasRestantes: null, acabaEm: null, status: "sem_dados" };
  }

  let nivel = 0;
  let t = movs[0].data;
  for (const m of movs) {
    nivel = Math.max(0, nivel - consumoDiario * diasEntre(t, m.data));
    nivel = m.tipo === "contagem" ? m.quantidade : nivel + m.quantidade;
    t = m.data;
  }
  nivel = Math.max(0, nivel - consumoDiario * diasEntre(t, hoje));
  const quantidade = Math.round(nivel * 1000) / 1000;

  if (consumoDiario <= 0) {
    return { quantidade, diasRestantes: null, acabaEm: null, status: quantidade === 0 ? "acabou" : "ok" };
  }

  const diasRestantes = Math.floor(quantidade / consumoDiario);
  const status = quantidade === 0 ? "acabou" : diasRestantes <= alertaDias ? "baixo" : "ok";
  return { quantidade, diasRestantes, acabaEm: somarDias(hoje, diasRestantes), status };
}

/**
 * Consumo diário observado entre as duas últimas contagens:
 * (contagem anterior + compras no meio − contagem atual) / dias.
 * Serve para sugerir um consumo mais realista que o chute inicial.
 * Devolve null quando não há dado suficiente ou o resultado não faz sentido
 * (ex.: contagem errada que daria consumo negativo).
 */
export function consumoObservado(movimentos) {
  const movs = ordenar(movimentos);
  const idxContagens = movs.flatMap((m, i) => (m.tipo === "contagem" ? [i] : []));
  if (idxContagens.length < 2) return null;

  const iFim = idxContagens[idxContagens.length - 1];
  const iIni = idxContagens[idxContagens.length - 2];
  const ini = movs[iIni];
  const fim = movs[iFim];
  const dias = diasEntre(ini.data, fim.data);
  if (dias <= 0) return null;

  const compras = movs
    .slice(iIni + 1, iFim)
    .filter((m) => m.tipo === "compra")
    .reduce((s, m) => s + m.quantidade, 0);

  const consumido = ini.quantidade + compras - fim.quantidade;
  if (consumido < 0) return null;
  return Math.round((consumido / dias) * 1000) / 1000;
}

/**
 * Consumo médio real, medido entre "âncoras": uma contagem (inclusive "acabou", que é contagem 0).
 * Em cada trecho entre duas âncoras: consumido = quantidade na âncora anterior + compras no meio − quantidade na âncora atual.
 * Os trechos somam, então a média pesa mais um ciclo longo do que um curto.
 *
 * - A primeira compra, sem contagem antes, parte de zero (o estoque estava vazio).
 * - Depois de "acabou", os dias sem estoque até a próxima compra não contam como consumo.
 * - Trecho de 0 dias ou com consumo negativo (contagem errada) é ignorado.
 * - O que veio depois da última âncora (ciclo em andamento) não entra: ainda não dá para saber quanto foi consumido.
 *
 * Devolve { porDia, dias, consumido, periodos } ou null se ainda não houver trecho fechado.
 */
export function consumoMedio(movimentos) {
  let ancora = null; // { qtd, inicio } ; inicio null = estoque zerado, a contagem de dias começa na próxima compra
  let compras = 0;
  let consumido = 0;
  let dias = 0;
  let periodos = 0;

  for (const m of ordenar(movimentos)) {
    if (m.tipo === "compra") {
      if (!ancora) ancora = { qtd: 0, inicio: m.data };
      else if (ancora.inicio === null) ancora.inicio = m.data;
      compras += m.quantidade;
      continue;
    }
    if (ancora && ancora.inicio !== null) {
      const d = diasEntre(ancora.inicio, m.data);
      const c = ancora.qtd + compras - m.quantidade;
      if (d > 0 && c >= 0) {
        consumido += c;
        dias += d;
        periodos += 1;
      }
    }
    ancora = { qtd: m.quantidade, inicio: m.quantidade === 0 ? null : m.data };
    compras = 0;
  }

  if (dias === 0) return null;
  return { porDia: consumido / dias, dias, consumido, periodos };
}
