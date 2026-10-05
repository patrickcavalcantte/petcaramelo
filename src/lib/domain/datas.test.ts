import { describe, expect, it } from "vitest";
import {
  deslocarMes, diasEntre, formatarData, hojeISO, idade, intervaloDoMes, isDataISO, somarDias,
} from "./datas";

describe("hojeISO", () => {
  it("usa o fuso de São Paulo, não UTC", () => {
    // 5/out 23h30 em SP = 6/out 02h30 UTC
    const agora = new Date("2026-10-06T02:30:00Z");
    expect(hojeISO(agora)).toBe("2026-10-05");
    expect(hojeISO(agora, "UTC")).toBe("2026-10-06");
  });
});

describe("isDataISO", () => {
  it.each(["2026-02-28", "2024-02-29", "2026-12-31"])("aceita %s", (d) => expect(isDataISO(d)).toBe(true));
  it.each(["2026-02-30", "2025-02-29", "2026-13-01", "26-10-05", "2026-10-5", ""])("recusa %s", (d) =>
    expect(isDataISO(d)).toBe(false));
});

describe("diasEntre / somarDias", () => {
  it("conta dias atravessando meses e anos", () => {
    expect(diasEntre("2026-12-30", "2027-01-02")).toBe(3);
    expect(diasEntre("2026-10-05", "2026-10-01")).toBe(-4);
  });
  it("não sofre com horário de verão", () => {
    expect(diasEntre("2018-11-03", "2018-11-05")).toBe(2);
  });
  it("soma dias", () => {
    expect(somarDias("2026-02-27", 2)).toBe("2026-03-01");
  });
  it("lança erro para data inválida", () => {
    expect(() => diasEntre("2026-02-30", "2026-03-01")).toThrow();
  });
});

describe("idade", () => {
  it("formata anos e meses", () => {
    expect(idade("2023-08-10", "2026-10-05")).toBe("3 anos e 1 mês");
    expect(idade("2024-10-05", "2026-10-05")).toBe("2 anos");
    expect(idade("2026-02-10", "2026-10-05")).toBe("7 meses");
    expect(idade("2025-10-06", "2026-10-05")).toBe("11 meses");
  });
  it("trata filhotes e datas futuras", () => {
    expect(idade("2026-09-20", "2026-10-05")).toBe("menos de 1 mês");
    expect(idade("2026-11-01", "2026-10-05")).toBeNull();
  });
});

describe("meses", () => {
  it("calcula o intervalo, inclusive dezembro", () => {
    expect(intervaloDoMes("2026-12")).toEqual({ inicio: "2026-12-01", fimExclusivo: "2027-01-01" });
  });
  it("recusa mês inválido", () => {
    expect(() => intervaloDoMes("2026-13")).toThrow();
    expect(() => intervaloDoMes("out/2026")).toThrow();
  });
  it("desloca meses atravessando o ano", () => {
    expect(deslocarMes("2026-01", -1)).toBe("2025-12");
    expect(deslocarMes("2026-12", 1)).toBe("2027-01");
  });
  it("formata data brasileira", () => {
    expect(formatarData("2026-10-05")).toBe("05/10/2026");
  });
});
