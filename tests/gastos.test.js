import { describe, expect, it } from "./_vitest.js";
import { resumirGastos } from "../js/domain/gastos.js";

describe("resumirGastos", () => {
  it("soma por categoria e ordena do maior para o menor", () => {
    const r = resumirGastos([
      { valorCentavos: 15990, categoria: "areia" },
      { valorCentavos: 30000, categoria: "racao" },
      { valorCentavos: 4010, categoria: "areia" },
    ]);
    expect(r.totalCentavos).toBe(50000);
    expect(r.porCategoria[0]).toEqual({ categoria: "racao", totalCentavos: 30000, fracao: 0.6 });
    expect(r.porCategoria[1].totalCentavos).toBe(20000);
  });

  it("lista vazia não divide por zero", () => {
    expect(resumirGastos([])).toEqual({ totalCentavos: 0, porCategoria: [] });
  });
});
