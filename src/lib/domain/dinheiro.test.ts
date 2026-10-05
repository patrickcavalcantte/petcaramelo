import { describe, expect, it } from "vitest";
import { centavosParaInput, formatarReais, parseReais } from "./dinheiro";

describe("parseReais", () => {
  it.each([
    ["89,90", 8990],
    ["89,9", 8990],
    ["R$ 1.234,56", 123456],
    ["r$45", 4500],
    ["45", 4500],
    ["1234.5", 123450],
    ["1.234", 123400],
    ["1.234.567,89", 123456789],
    [" 12,00 ", 1200],
  ])("%s -> %i", (entrada, esperado) => expect(parseReais(entrada)).toBe(esperado));

  it.each(["", "abc", "0", "0,00", "1,234", "12,3,4", "1.23.4", "-10", "10,", ",50x"])(
    "recusa %j",
    (entrada) => expect(parseReais(entrada)).toBeNull(),
  );
});

describe("formatação", () => {
  it("formata em BRL", () => {
    // Intl usa espaço não separável entre R$ e o número
    expect(formatarReais(123456).replace(/\s/g, " ")).toBe("R$ 1.234,56");
  });
  it("prepara valor para input", () => {
    expect(centavosParaInput(8990)).toBe("89,90");
  });
});
