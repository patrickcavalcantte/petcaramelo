import { describe, expect, it } from "vitest";
import { consumoObservado, estimarEstoque, type Movimento } from "./estoque";

const compra = (data: string, quantidade: number): Movimento => ({ tipo: "compra", data, quantidade });
const contagem = (data: string, quantidade: number): Movimento => ({ tipo: "contagem", data, quantidade });

describe("estimarEstoque", () => {
  it("sem movimentos não inventa número", () => {
    expect(estimarEstoque([], 1, "2026-10-05").status).toBe("sem_dados");
  });

  it("desconta o consumo desde a contagem", () => {
    const e = estimarEstoque([contagem("2026-10-01", 20)], 1.5, "2026-10-05");
    expect(e.quantidade).toBe(14);
    expect(e.diasRestantes).toBe(9);
    expect(e.acabaEm).toBe("2026-10-14");
    expect(e.status).toBe("ok");
  });

  it("soma compras depois da contagem", () => {
    const e = estimarEstoque([contagem("2026-10-01", 2), compra("2026-10-03", 10)], 1, "2026-10-05");
    // 2 - 2 dias = 0, +10, -2 dias = 8
    expect(e.quantidade).toBe(8);
  });

  it("não deixa o consumo de um período zerado comer a compra seguinte", () => {
    // acabou no dia 11, ficou zerado até o dia 20, comprou de novo
    const e = estimarEstoque([compra("2026-10-01", 10), compra("2026-10-20", 10)], 1, "2026-10-25");
    expect(e.quantidade).toBe(5); // modelo linear ingênuo daria 0
  });

  it("contagem substitui a estimativa anterior", () => {
    const e = estimarEstoque([compra("2026-10-01", 50), contagem("2026-10-04", 3)], 1, "2026-10-05");
    expect(e.quantidade).toBe(2);
    expect(e.status).toBe("baixo");
  });

  it("no mesmo dia, a ordem de criação desempata", () => {
    const movs: Movimento[] = [
      { tipo: "compra", data: "2026-10-05", quantidade: 10, criadoEm: "2026-10-05T12:00:00Z" },
      { tipo: "contagem", data: "2026-10-05", quantidade: 4, criadoEm: "2026-10-05T10:00:00Z" },
    ];
    expect(estimarEstoque(movs, 1, "2026-10-05").quantidade).toBe(14);
  });

  it("marca como acabou e nunca fica negativo", () => {
    const e = estimarEstoque([contagem("2026-09-01", 5)], 1, "2026-10-05");
    expect(e.quantidade).toBe(0);
    expect(e.status).toBe("acabou");
  });

  it("ignora movimentos com data futura", () => {
    const e = estimarEstoque([contagem("2026-10-01", 5), compra("2026-10-10", 100)], 0.5, "2026-10-05");
    expect(e.quantidade).toBe(3);
  });

  it("consumo zero não calcula dias restantes", () => {
    const e = estimarEstoque([contagem("2026-10-01", 5)], 0, "2026-10-05");
    expect(e.diasRestantes).toBeNull();
    expect(e.status).toBe("ok");
  });

  it("respeita o limite de aviso", () => {
    const e = estimarEstoque([contagem("2026-10-05", 10)], 1, "2026-10-05", 10);
    expect(e.status).toBe("baixo");
  });
});

describe("consumoObservado", () => {
  it("precisa de duas contagens", () => {
    expect(consumoObservado([contagem("2026-10-01", 10), compra("2026-10-02", 5)])).toBeNull();
  });

  it("considera compras entre as contagens", () => {
    const movs = [contagem("2026-10-01", 10), compra("2026-10-03", 12), contagem("2026-10-11", 2)];
    expect(consumoObservado(movs)).toBe(2); // (10 + 12 - 2) / 10
  });

  it("usa só as duas últimas contagens", () => {
    const movs = [
      contagem("2026-09-01", 100),
      contagem("2026-10-01", 10),
      contagem("2026-10-06", 5),
    ];
    expect(consumoObservado(movs)).toBe(1);
  });

  it("descarta resultado negativo (contagem errada)", () => {
    expect(consumoObservado([contagem("2026-10-01", 2), contagem("2026-10-05", 9)])).toBeNull();
  });

  it("descarta contagens no mesmo dia", () => {
    expect(consumoObservado([contagem("2026-10-01", 9), contagem("2026-10-01", 8)])).toBeNull();
  });
});
