import { describe, expect, it } from "./_vitest.js";
import { nomesEmLote } from "../js/domain/lote.js";

describe("nomesEmLote", () => {
  it("aceita linhas, vírgulas e ponto e vírgula", () => {
    expect(nomesEmLote("Frajola\nMingau, Pipoca;Tigrão").novos).toEqual(["Frajola", "Mingau", "Pipoca", "Tigrão"]);
  });

  it("remove vazios, espaços extras e duplicados sem diferenciar caixa", () => {
    const r = nomesEmLote("  Frajola \n\nfrajola\n  Dona   Chica ");
    expect(r.novos).toEqual(["Frajola", "Dona Chica"]);
    expect(r.ignorados).toEqual(["frajola"]);
  });

  it("ignora quem já está cadastrado", () => {
    const r = nomesEmLote("Mingau\nNina", ["mingau"]);
    expect(r.novos).toEqual(["Nina"]);
    expect(r.ignorados).toEqual(["Mingau"]);
  });

  it("separa nomes longos demais", () => {
    const longo = "x".repeat(61);
    expect(nomesEmLote(longo).invalidos).toEqual([longo]);
  });
});
