import { describe, expect, it } from "vitest";
import { formatarPeso, formatarQuantidade, textoPrazo } from "./formato";

describe("textoPrazo", () => {
  it.each([
    [0, "vence hoje"],
    [-1, "venceu ontem"],
    [-5, "venceu há 5 dias"],
    [1, "vence amanhã"],
    [12, "vence em 12 dias"],
  ])("%i -> %s", (diasAte, txt) => expect(textoPrazo({ diasAte })).toBe(txt));
});

describe("formatos", () => {
  it("quantidade respeita a unidade", () => {
    expect(formatarQuantidade(14.25, "kg")).toBe("14,3 kg");
    expect(formatarQuantidade(3, "un")).toBe("3 un");
  });
  it("peso com vírgula", () => {
    expect(formatarPeso(4.35)).toBe("4,35 kg");
    expect(formatarPeso(5)).toBe("5,0 kg");
  });
});
