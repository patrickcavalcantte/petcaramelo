import type { Vencimento } from "./domain/vencimentos";

export function textoPrazo(v: Pick<Vencimento, "diasAte">): string {
  if (v.diasAte === 0) return "vence hoje";
  if (v.diasAte === -1) return "venceu ontem";
  if (v.diasAte < 0) return `venceu há ${-v.diasAte} dias`;
  if (v.diasAte === 1) return "vence amanhã";
  return `vence em ${v.diasAte} dias`;
}

export function formatarQuantidade(n: number, unidade: string): string {
  const txt = n.toLocaleString("pt-BR", { maximumFractionDigits: unidade === "un" ? 0 : 1 });
  return unidade === "un" ? `${txt} un` : `${txt} ${unidade}`;
}

export function formatarPeso(kg: number): string {
  return `${kg.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg`;
}
