import { describe, expect, it } from "vitest";
import { calcularVencimentos, normalizarTitulo, type EventoComProxima } from "./vencimentos";

let seq = 0;
const ev = (p: Partial<EventoComProxima>): EventoComProxima => ({
  id: String(++seq),
  gatoId: "g1",
  tipo: "vacina",
  titulo: "V5",
  data: "2025-10-01",
  proximaData: null,
  ...p,
});

describe("calcularVencimentos", () => {
  const hoje = "2026-10-05";

  it("classifica atrasado, hoje e em breve", () => {
    const r = calcularVencimentos(
      [
        ev({ gatoId: "a", proximaData: "2026-10-01" }),
        ev({ gatoId: "b", proximaData: "2026-10-05" }),
        ev({ gatoId: "c", proximaData: "2026-10-20" }),
      ],
      hoje,
    );
    expect(r.map((v) => v.situacao)).toEqual(["atrasado", "hoje", "em_breve"]);
    expect(r[0].diasAte).toBe(-4);
  });

  it("ignora o que está fora da janela", () => {
    expect(calcularVencimentos([ev({ proximaData: "2026-12-01" })], hoje, 30)).toHaveLength(0);
  });

  it("evento mais recente com o mesmo título resolve a pendência", () => {
    const r = calcularVencimentos(
      [
        ev({ data: "2025-10-01", proximaData: "2026-10-01" }),
        ev({ data: "2026-10-02", titulo: " v5 ", proximaData: "2027-10-02" }),
      ],
      hoje,
    );
    expect(r).toHaveLength(0);
  });

  it("títulos diferentes não se resolvem (antirrábica não cobre V5)", () => {
    const r = calcularVencimentos(
      [
        ev({ titulo: "V5", proximaData: "2026-10-01" }),
        ev({ titulo: "Antirrábica", data: "2026-10-02", proximaData: "2027-10-02" }),
      ],
      hoje,
    );
    expect(r).toHaveLength(1);
    expect(r[0].titulo).toBe("V5");
  });

  it("pendências de gatos diferentes são independentes", () => {
    const r = calcularVencimentos(
      [ev({ gatoId: "a", proximaData: "2026-10-01" }), ev({ gatoId: "b", proximaData: "2026-10-01" })],
      hoje,
    );
    expect(r).toHaveLength(2);
  });

  it("evento mais recente sem próxima data encerra a pendência", () => {
    const r = calcularVencimentos(
      [ev({ proximaData: "2026-10-01" }), ev({ data: "2026-10-03", proximaData: null })],
      hoje,
    );
    expect(r).toHaveLength(0);
  });
});

describe("normalizarTitulo", () => {
  it("ignora acento, caixa e espaços", () => {
    expect(normalizarTitulo("  Vermífugo   ORAL ")).toBe("vermifugo oral");
  });
});
