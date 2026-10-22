export function textoPrazo(v) {
  if (v.diasAte === 0) return "vence hoje";
  if (v.diasAte === -1) return "venceu ontem";
  if (v.diasAte < 0) return `venceu há ${-v.diasAte} dias`;
  if (v.diasAte === 1) return "vence amanhã";
  return `vence em ${v.diasAte} dias`;
}

export function formatarQuantidade(n, unidade) {
  const txt = n.toLocaleString("pt-BR", { maximumFractionDigits: unidade === "un" ? 0 : 1 });
  return unidade === "un" ? `${txt} un` : `${txt} ${unidade}`;
}

export function formatarPeso(kg) {
  return `${kg.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg`;
}

/** Consumo em unidade legível: 0,35 kg vira "350 g", 0,02 l vira "20 ml". */
export function formatarConsumo(n, unidade) {
  if ((unidade === "kg" || unidade === "l") && n < 1) {
    const menor = unidade === "kg" ? "g" : "ml";
    return `${Math.round(n * 1000).toLocaleString("pt-BR")} ${menor}`;
  }
  if (unidade === "un") return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} un`;
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${unidade}`;
}
