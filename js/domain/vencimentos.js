import { diasEntre } from "./datas.js";

/**
 * Um evento com `proximaData` cria uma pendência (próxima vacina, próximo
 * vermífugo). Ela deixa de valer quando aparece um evento mais recente do
 * mesmo tipo e mesmo título para o mesmo gato. Ex.: "V5" de 2025 com
 * próxima em 2026 some quando "V5" de 2026 é registrada.
 *
 * Caso de borda conhecido: títulos diferentes para a mesma coisa
 * ("V5" vs "V5 felina") não se reconhecem. A interface sugere títulos já
 * usados para reduzir isso, e o título é normalizado (caixa, acentos, espaços).
 */

export function normalizarTitulo(titulo) {
  return titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** eventos: [{ id, gatoId, tipo, titulo, data, proximaData }] */
export function calcularVencimentos(eventos, hoje, janelaDias = 30) {
  const maisRecente = new Map();
  for (const e of eventos) {
    const chave = `${e.gatoId}|${e.tipo}|${normalizarTitulo(e.titulo)}`;
    const atual = maisRecente.get(chave);
    if (!atual || e.data > atual.data) maisRecente.set(chave, e);
  }

  const resultado = [];
  for (const e of maisRecente.values()) {
    if (!e.proximaData) continue;
    const diasAte = diasEntre(hoje, e.proximaData);
    if (diasAte > janelaDias) continue;
    const situacao = diasAte < 0 ? "atrasado" : diasAte === 0 ? "hoje" : "em_breve";
    resultado.push({ ...e, diasAte, situacao });
  }
  return resultado.sort((a, b) => a.diasAte - b.diasAte);
}
