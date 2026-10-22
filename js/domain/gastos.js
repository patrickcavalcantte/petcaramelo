export const CATEGORIAS_GASTO = {
  racao: "Ração",
  areia: "Areia",
  remedio: "Remédio",
  consulta: "Consulta",
  exame: "Exame",
  vacina: "Vacina",
  cirurgia: "Cirurgia",
  petisco: "Petisco",
  higiene: "Higiene",
  outro: "Outro",
};

/** Categoria do gasto que nasce de um cuidado de saúde. */
export const CATEGORIA_POR_TIPO = {
  vacina: "vacina",
  consulta: "consulta",
  exame: "exame",
  cirurgia: "cirurgia",
  medicacao: "remedio",
  vermifugo: "remedio",
  antipulgas: "remedio",
};

/** gastos: [{ valorCentavos, categoria }] */
export function resumirGastos(gastos) {
  const mapa = new Map();
  let total = 0;
  for (const g of gastos) {
    total += g.valorCentavos;
    mapa.set(g.categoria, (mapa.get(g.categoria) ?? 0) + g.valorCentavos);
  }
  const porCategoria = [...mapa.entries()]
    .map(([categoria, totalCentavos]) => ({ categoria, totalCentavos, fracao: total === 0 ? 0 : totalCentavos / total }))
    .sort((a, b) => b.totalCentavos - a.totalCentavos);
  return { totalCentavos: total, porCategoria };
}
