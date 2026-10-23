import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  validarGato, validarEvento, validarCompra, validarAbertura, validarContagem, validarGasto,
  validarArquivo, validarCadastro,
} from "../js/validate.js";

const HOJE = "2026-10-22";

describe("gato", () => {
  test("só o nome é obrigatório", () => {
    const r = validarGato({ nome: "  Frajola " }, HOJE);
    assert.equal(r.valor.nome, "Frajola");
    assert.equal(r.valor.nascimento, undefined);
    assert.equal(r.valor.castrado, false);
  });
  test("recusa nome vazio, nascimento no futuro e sexo inventado", () => {
    assert.equal(validarGato({ nome: " " }, HOJE).erro, "Informe o nome");
    assert.equal(validarGato({ nome: "A", nascimento: "2027-01-01" }, HOJE).erro, "Nascimento não pode ser no futuro");
    assert.equal(validarGato({ nome: "A", sexo: "x" }, HOJE).erro, "Sexo inválido");
  });
  test("checkbox marcado vira true", () => {
    assert.equal(validarGato({ nome: "A", castrado: "on" }, HOJE).valor.castrado, true);
  });
});

describe("evento", () => {
  const ok = { gatoIds: ["a"], tipo: "vacina", data: "2026-10-01", titulo: "V5" };
  test("aceita o básico e converte valor e peso brasileiros", () => {
    const r = validarEvento({ ...ok, tipo: "pesagem", pesoKg: "4,3", valorCentavos: "R$ 89,90", proximaData: "" }, HOJE);
    assert.equal(r.valor.pesoKg, 4.3);
    assert.equal(r.valor.valorCentavos, 8990);
    assert.equal(r.valor.proximaData, undefined);
  });
  test("recusa sem gato, sem tipo, data futura e título vazio", () => {
    assert.equal(validarEvento({ ...ok, gatoIds: [] }, HOJE).erro, "Selecione pelo menos um gato");
    assert.equal(validarEvento({ ...ok, tipo: "" }, HOJE).erro, "Escolha o tipo");
    assert.equal(validarEvento({ ...ok, data: "2026-11-01" }, HOJE).erro, "A data não pode ser no futuro");
    assert.match(validarEvento({ ...ok, titulo: "" }, HOJE).erro, /título/);
  });
  test("pesagem exige peso; peso só para um gato; próxima data depois da data", () => {
    assert.equal(validarEvento({ ...ok, tipo: "pesagem" }, HOJE).erro, "Pesagem precisa do peso");
    assert.equal(validarEvento({ ...ok, gatoIds: ["a", "b"], pesoKg: "4" }, HOJE).erro, "Peso só para um gato por vez");
    assert.match(validarEvento({ ...ok, proximaData: "2026-10-01" }, HOJE).erro, /depois da data/);
    assert.equal(validarEvento({ ...ok, pesoKg: "40" }, HOJE).erro, "Peso entre 0 e 30 kg");
  });
  test("ids repetidos viram um só", () => {
    assert.deepEqual(validarEvento({ ...ok, gatoIds: ["a", "a"] }, HOJE).valor.gatoIds, ["a"]);
  });
  test("valor inválido dá mensagem legível", () => {
    assert.match(validarEvento({ ...ok, valorCentavos: "abc" }, HOJE).erro, /Valor inválido/);
  });
});

describe("estoque e gastos", () => {
  test("compra pelo nome: só nome e quantidade são obrigatórios", () => {
    const r = validarCompra({ nome: " Ração ", quantidade: "15", data: "2026-10-01" }, HOJE);
    assert.equal(r.valor.nome, "Ração");
    assert.equal(r.valor.unidade, "kg");
    assert.equal(r.valor.quantidade, 15);
    assert.equal(r.valor.valorCentavos, undefined);
  });
  test("compra recusa nome vazio, quantidade zero, unidade estranha e data futura", () => {
    assert.match(validarCompra({ nome: "", quantidade: "1", data: "2026-10-01" }, HOJE).erro, /Informe o que/);
    assert.equal(validarCompra({ nome: "R", quantidade: "0", data: "2026-10-01" }, HOJE).erro, "Quantidade precisa ser maior que zero");
    assert.equal(validarCompra({ nome: "R", quantidade: "1", unidade: "ton", data: "2026-10-01" }, HOJE).erro, "Escolha a unidade");
    assert.equal(validarCompra({ nome: "R", quantidade: "1", data: "2026-12-01" }, HOJE).erro, "A data não pode ser no futuro");
  });
  test("abertura de pacote exige tamanho e data válidos", () => {
    const r = validarAbertura({ itemId: "i", quantidade: "15", data: "2026-10-01" }, HOJE);
    assert.equal(r.valor.quantidade, 15);
    assert.equal(validarAbertura({ itemId: "i", quantidade: "", data: "2026-10-01" }, HOJE).erro, "Informe o tamanho do pacote");
    assert.equal(validarAbertura({ itemId: "i", quantidade: "0", data: "2026-10-01" }, HOJE).erro, "O pacote precisa ter mais que zero");
    assert.equal(validarAbertura({ itemId: "i", quantidade: "5", data: "2026-12-01" }, HOJE).erro, "A data não pode ser no futuro");
  });
  test("contagem aceita zero", () => {
    assert.equal(validarContagem({ itemId: "i", quantidade: "0", data: "2026-10-01" }, HOJE).valor.quantidade, 0);
  });
  test("gasto exige valor e categoria", () => {
    assert.equal(validarGasto({ data: "2026-10-01", categoria: "petisco" }, HOJE).erro, "Informe o valor");
    assert.equal(validarGasto({ data: "2026-10-01", valorCentavos: "10" }, HOJE).erro, "Escolha a categoria");
    assert.equal(validarGasto({ data: "2026-10-01", valorCentavos: "10", categoria: "petisco", gatoId: "" }, HOJE).valor.gatoId, undefined);
  });
});

describe("arquivos e conta", () => {
  test("aceita PDF e foto, inclusive HEIC sem tipo", () => {
    assert.equal(validarArquivo({ name: "laudo.pdf", type: "application/pdf", size: 1000 }).valor.ext, "pdf");
    assert.equal(validarArquivo({ name: "IMG_1.HEIC", type: "", size: 1000 }).valor.mime, "image/heic");
  });
  test("recusa tipo estranho e arquivo grande", () => {
    assert.match(validarArquivo({ name: "a.exe", type: "application/x-msdownload", size: 1 }).erro, /use PDF ou foto/);
    assert.match(validarArquivo({ name: "a.pdf", type: "application/pdf", size: 11 * 1024 * 1024 }).erro, /10 MB/);
  });
  test("cadastro", () => {
    assert.equal(validarCadastro({ email: " A@B.com ", senha: "12345678", confirmacao: "12345678" }).valor.email, "a@b.com");
    assert.equal(validarCadastro({ email: "x", senha: "12345678", confirmacao: "12345678" }).erro, "E-mail inválido");
    assert.match(validarCadastro({ email: "a@b.com", senha: "123", confirmacao: "123" }).erro, /8 caracteres/);
    assert.equal(validarCadastro({ email: "a@b.com", senha: "12345678", confirmacao: "x" }).erro, "As senhas não conferem");
  });
});
