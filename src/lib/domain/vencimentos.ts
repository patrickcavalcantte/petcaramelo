import { diasEntre } from "./datas";

/**
 * Um evento com `proximaData` cria uma pendência (próxima vacina, próximo
 * vermífugo). Ela deixa de valer quando aparece um evento mais recente do
 * mesmo tipo e mesmo título para o mesmo gato. Ex.: "V5" de 2025 com
 * próxima em 2026 some quando "V5" de 2026 é registrada.
 *
 * Caso de borda conhecido: títulos diferentes para a mesma coisa
 * ("V5" vs "V5 felina") não se reconhecem. A interface sugere títulos já
 * usados para reduzir isso, e o título é normalizado (caixa, acentos,
 * espaços).
 */

export type EventoComProxima = {
  id: string;
  gatoId: string;
  tipo: string;
  titulo: string;
  data: string;
  proximaData: string | null;
};

export type Vencimento = EventoComProxima & {
  proximaData: string;
  diasAte: number; // negativo = atrasado
  situacao: "atrasado" | "hoje" | "em_breve";
};

export function normalizarTitulo(titulo: string): string {
  return titulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function calcularVencimentos(
  eventos: EventoComProxima[],
  hoje: string,
  janelaDias = 30,
): Vencimento[] {
  const maisRecente = new Map<string, EventoComProxima>();
  for (const e of eventos) {
    const chave = `${e.gatoId}|${e.tipo}|${normalizarTitulo(e.titulo)}`;
    const atual = maisRecente.get(chave);
    if (!atual || e.data > atual.data) maisRecente.set(chave, e);
  }

  const resultado: Vencimento[] = [];
  for (const e of maisRecente.values()) {
    if (!e.proximaData) continue;
    const diasAte = diasEntre(hoje, e.proximaData);
    if (diasAte > janelaDias) continue;
    const situacao = diasAte < 0 ? "atrasado" : diasAte === 0 ? "hoje" : "em_breve";
    resultado.push({ ...e, proximaData: e.proximaData, diasAte, situacao });
  }
  return resultado.sort((a, b) => a.diasAte - b.diasAte);
}
