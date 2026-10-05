import { describe, expect, it } from "vitest";
import { destinoSeguro, mensagemDoBanco } from "./navegacao";

describe("destinoSeguro", () => {
  it.each(["/", "/gatos", "/gatos/abc?x=1"])("aceita %s", (d) => expect(destinoSeguro(d)).toBe(d));
  it.each(["//evil.com", "https://evil.com", "gatos", "/\\evil.com", undefined, 42])("recusa %j", (d) =>
    expect(destinoSeguro(d, "/padrao")).toBe("/padrao"));
});

describe("mensagemDoBanco", () => {
  it("explica nome duplicado", () => {
    expect(mensagemDoBanco({ code: "23505" }, "um gato")).toBe("Já existe um gato com esse nome");
  });
  it("repassa mensagens das funções do banco", () => {
    expect(mensagemDoBanco({ code: "22023", message: "Selecione pelo menos um gato" })).toBe(
      "Selecione pelo menos um gato",
    );
  });
});
