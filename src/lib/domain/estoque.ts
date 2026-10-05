import { diasEntre, somarDias } from "./datas";

/**
 * O estoque é estimado, não registrado dia a dia.
 *
 * Modelo: uma "contagem" fixa a quantidade real naquele dia; uma "compra"
 * soma; entre eventos, o item é consumido a `consumoDiario`, sem ficar
 * negativo. Percorrer os eventos em ordem (em vez de fazer uma conta
 * linear única) evita subestimar o estoque quando ele zerou e depois
 * houve compra: o consumo do período em que estava zerado não "come" a
 * compra seguinte.
 */

export type Movimento = {
  tipo: "compra" | "contagem";
  quantidade: number;
  data: string; // YYYY-MM-DD
  criadoEm?: string; // desempate no mesmo dia
};

export type StatusEstoque = "sem_dados" | "ok" | "baixo" | "acabou";

export type Estimativa = {
  quantidade: number | null;
  diasRestantes: number | null; // null quando consumo é 0 ou sem dados
  acabaEm: string | null;
  status: StatusEstoque;
};

function ordenar(movs: Movimento[]): Movimento[] {
  return [...movs].sort(
    (a, b) => a.data.localeCompare(b.data) || (a.criadoEm ?? "").localeCompare(b.criadoEm ?? ""),
  );
}

export function estimarEstoque(
  movimentos: Movimento[],
  consumoDiario: number,
  hoje: string,
  alertaDias = 7,
): Estimativa {
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
    return {
      quantidade,
      diasRestantes: null,
      acabaEm: null,
      status: quantidade === 0 ? "acabou" : "ok",
    };
  }

  const diasRestantes = Math.floor(quantidade / consumoDiario);
  const status: StatusEstoque =
    quantidade === 0 ? "acabou" : diasRestantes <= alertaDias ? "baixo" : "ok";
  return { quantidade, diasRestantes, acabaEm: somarDias(hoje, diasRestantes), status };
}

/**
 * Consumo diário observado entre as duas últimas contagens:
 * (contagem anterior + compras no meio − contagem atual) / dias.
 * Serve para sugerir um consumo mais realista que o chute inicial.
 * Devolve null quando não há dado suficiente ou o resultado não faz sentido
 * (ex.: contagem errada que daria consumo negativo).
 */
export function consumoObservado(movimentos: Movimento[]): number | null {
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
