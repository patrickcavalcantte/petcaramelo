import { describe, expect, it } from "vitest";
import { anexoSchema, eventoSchema, formParaObjeto, gastoSchema, gatoSchema, primeiroErro } from "./schemas";

const HOJE = "2026-10-05";
const G1 = "3f1c2b4a-1d2e-4f5a-8b9c-0d1e2f3a4b5c";
const G2 = "7a8b9c0d-1e2f-4a5b-9c6d-7e8f9a0b1c2d";
const U = "11111111-2222-4333-8444-555555555555";

describe("gatoSchema", () => {
  it("normaliza campos opcionais vazios e checkbox", () => {
    const r = gatoSchema(HOJE).parse({ nome: " Frajola ", nascimento: "", sexo: "", castrado: "on" });
    expect(r).toEqual({ nome: "Frajola", castrado: true });
  });
  it("recusa nascimento no futuro", () => {
    const r = gatoSchema(HOJE).safeParse({ nome: "Nina", nascimento: "2026-12-01" });
    expect(r.success).toBe(false);
  });
});

describe("eventoSchema", () => {
  const base = { gatoIds: [G1], tipo: "vacina", data: "2026-10-01", titulo: "V5" };

  it("aceita evento simples e converte valor", () => {
    const r = eventoSchema(HOJE).parse({ ...base, valorCentavos: "120,00", proximaData: "2027-10-01" });
    expect(r.valorCentavos).toBe(12000);
  });

  it("remove gatos repetidos do lote", () => {
    expect(eventoSchema(HOJE).parse({ ...base, gatoIds: [G1, G2, G1] }).gatoIds).toEqual([G1, G2]);
  });

  it("aceita peso com vírgula", () => {
    const r = eventoSchema(HOJE).parse({ ...base, tipo: "pesagem", titulo: "Pesagem", pesoKg: "4,35" });
    expect(r.pesoKg).toBe(4.35);
  });

  it.each([
    [{ gatoIds: [] }, "Selecione pelo menos um gato"],
    [{ tipo: "pesagem" }, "Pesagem precisa do peso"],
    [{ gatoIds: [G1, G2], pesoKg: "4" }, "Peso só para um gato por vez"],
    [{ proximaData: "2026-09-01" }, "A próxima data precisa ser depois da data do evento"],
    [{ data: "2026-10-06" }, "A data não pode ser no futuro"],
    [{ valorCentavos: "abc" }, "Valor inválido. Use algo como 89,90"],
  ])("recusa %j", (extra, mensagem) => {
    const r = eventoSchema(HOJE).safeParse({ ...base, ...extra });
    expect(r.success).toBe(false);
    if (!r.success) expect(primeiroErro(r.error)).toBe(mensagem);
  });
});

describe("gastoSchema", () => {
  it("exige valor", () => {
    const r = gastoSchema(HOJE).safeParse({ data: HOJE, categoria: "racao", valorCentavos: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(primeiroErro(r.error)).toBe("Informe o valor");
  });
  it("gato é opcional", () => {
    const r = gastoSchema(HOJE).parse({ data: HOJE, categoria: "racao", valorCentavos: "250", gatoId: "" });
    expect(r.gatoId).toBeUndefined();
  });
});

describe("anexoSchema", () => {
  const ok = {
    gatoId: G1,
    storagePath: `${U}/${G1}/abc.pdf`,
    nomeArquivo: "laudo.pdf",
    mime: "application/pdf",
    tamanhoBytes: 2048,
  };
  it("aceita caminho dentro da pasta do dono e do gato", () => {
    expect(anexoSchema(U).safeParse(ok).success).toBe(true);
  });
  it.each([
    [{ storagePath: `outro/${G1}/abc.pdf` }],
    [{ storagePath: `${U}/${G2}/abc.pdf` }],
    [{ storagePath: `${U}/${G1}/../x.pdf` }],
    [{ mime: "application/zip" }],
    [{ tamanhoBytes: 11 * 1024 * 1024 }],
  ])("recusa %j", (extra) => {
    expect(anexoSchema(U).safeParse({ ...ok, ...extra }).success).toBe(false);
  });
});

describe("formParaObjeto", () => {
  it("lê campos repetidos como lista", () => {
    const fd = new FormData();
    fd.append("gatoIds", G1);
    fd.append("gatoIds", G2);
    fd.append("titulo", "V5");
    expect(formParaObjeto(fd, ["gatoIds"])).toEqual({ titulo: "V5", gatoIds: [G1, G2] });
  });
});
