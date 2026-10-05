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
} as const;

export type CategoriaGasto = keyof typeof CATEGORIAS_GASTO;

export type GastoResumo = { valorCentavos: number; categoria: CategoriaGasto };

export function resumirGastos(gastos: GastoResumo[]): {
  totalCentavos: number;
  porCategoria: { categoria: CategoriaGasto; totalCentavos: number; fracao: number }[];
} {
  const mapa = new Map<CategoriaGasto, number>();
  let total = 0;
  for (const g of gastos) {
    total += g.valorCentavos;
    mapa.set(g.categoria, (mapa.get(g.categoria) ?? 0) + g.valorCentavos);
  }
  const porCategoria = [...mapa.entries()]
    .map(([categoria, totalCentavos]) => ({
      categoria,
      totalCentavos,
      fracao: total === 0 ? 0 : totalCentavos / total,
    }))
    .sort((a, b) => b.totalCentavos - a.totalCentavos);
  return { totalCentavos: total, porCategoria };
}
