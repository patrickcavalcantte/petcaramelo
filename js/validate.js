// Validação do que chega dos formulários. Cada função recebe um objeto simples (FormData -> objeto)
// e devolve { valor } ou { erro } com a mensagem para mostrar na tela. Sem dependências.
import { isDataISO, diasEntre } from "./domain/datas.js";
import { parseReais } from "./domain/dinheiro.js";
import { CATEGORIAS_GASTO } from "./domain/gastos.js";

export const TIPOS_EVENTO = {
  vacina: "Vacina",
  vermifugo: "Vermífugo",
  antipulgas: "Antipulgas",
  consulta: "Consulta",
  exame: "Exame",
  medicacao: "Medicação",
  pesagem: "Pesagem",
  cirurgia: "Cirurgia",
  outro: "Outro",
};

export const MIMES_ANEXO = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const TAMANHO_MAX_ANEXO = 10 * 1024 * 1024;

class Falha extends Error {}
const falha = (msg) => { throw new Falha(msg); };

/** Roda `fn`; qualquer `falha(...)` vira { erro }. */
function validar(fn) {
  try {
    return { valor: fn() };
  } catch (e) {
    if (e instanceof Falha) return { erro: e.message };
    throw e;
  }
}

const str = (v) => (typeof v === "string" ? v.trim() : "");

function texto(v, max, { obrigatorio = false, msgVazio = "Campo obrigatório", nome = "Texto" } = {}) {
  const s = str(v);
  if (!s) {
    if (obrigatorio) falha(msgVazio);
    return undefined;
  }
  if (s.length > max) falha(`${nome}: máximo de ${max} caracteres`);
  return s;
}

function data(v, { obrigatoria = false, naoFutura = null, msgVazio = "Informe a data" } = {}) {
  const s = str(v);
  if (!s) {
    if (obrigatoria) falha(msgVazio);
    return undefined;
  }
  if (!isDataISO(s)) falha("Data inválida");
  if (naoFutura && diasEntre(s, naoFutura) < 0) falha("A data não pode ser no futuro");
  return s;
}

/** Número com vírgula brasileira ("4,3"). */
function numero(v, msg, { obrigatorio = true } = {}) {
  const s = str(v).replace(",", ".");
  if (s === "") {
    if (obrigatorio) falha(msg);
    return undefined;
  }
  const n = Number(s);
  if (!Number.isFinite(n)) falha(msg);
  return n;
}

function reais(v, { obrigatorio = false } = {}) {
  const s = str(v);
  if (!s) {
    if (obrigatorio) falha("Informe o valor");
    return undefined;
  }
  const c = parseReais(s);
  if (c === null) falha("Valor inválido. Use algo como 89,90");
  return c;
}

export function validarGato(f, hoje) {
  return validar(() => {
    const nascimento = data(f.nascimento);
    if (nascimento && diasEntre(nascimento, hoje) < 0) falha("Nascimento não pode ser no futuro");
    const sexo = str(f.sexo);
    if (sexo && sexo !== "macho" && sexo !== "femea") falha("Sexo inválido");
    return {
      nome: texto(f.nome, 60, { obrigatorio: true, msgVazio: "Informe o nome", nome: "Nome" }),
      nascimento,
      sexo: sexo || undefined,
      castrado: f.castrado === "on" || f.castrado === true,
      descricao: texto(f.descricao, 200, { nome: "Descrição" }),
      microchip: texto(f.microchip, 40, { nome: "Microchip" }),
      observacoes: texto(f.observacoes, 2000, { nome: "Observações" }),
    };
  });
}

/** f.gatoIds: array de ids. */
export function validarEvento(f, hoje) {
  return validar(() => {
    const gatoIds = [...new Set(f.gatoIds ?? [])];
    if (gatoIds.length === 0) falha("Selecione pelo menos um gato");
    const tipo = str(f.tipo);
    if (!(tipo in TIPOS_EVENTO)) falha("Escolha o tipo");
    const dia = data(f.data, { obrigatoria: true, naoFutura: hoje });
    const titulo = texto(f.titulo, 120, { obrigatorio: true, msgVazio: "Informe um título, como V5 ou Hemograma", nome: "Título" });
    let pesoKg = numero(f.pesoKg, "Peso inválido", { obrigatorio: false });
    if (pesoKg !== undefined && !(pesoKg > 0 && pesoKg < 30)) falha("Peso entre 0 e 30 kg");
    const proximaData = data(f.proximaData);
    if (tipo === "pesagem" && pesoKg === undefined) falha("Pesagem precisa do peso");
    if (pesoKg !== undefined && gatoIds.length > 1) falha("Peso só para um gato por vez");
    if (proximaData && diasEntre(dia, proximaData) <= 0) falha("A próxima data precisa ser depois da data do evento");
    return {
      gatoIds,
      tipo,
      data: dia,
      titulo,
      detalhes: texto(f.detalhes, 4000, { nome: "Observações" }),
      pesoKg,
      proximaData,
      valorCentavos: reais(f.valorCentavos),
      loja: texto(f.loja, 80, { nome: "Local" }),
    };
  });
}

/** Compra pelo nome do item (o item é criado se ainda não existir). */
export function validarCompra(f, hoje) {
  return validar(() => {
    const unidade = str(f.unidade) || "kg";
    if (!["kg", "l", "un"].includes(unidade)) falha("Escolha a unidade");
    const quantidade = numero(f.quantidade, "Quantidade inválida");
    if (!(quantidade > 0 && quantidade < 1_000_000)) falha("Quantidade precisa ser maior que zero");
    return {
      nome: texto(f.nome, 80, { obrigatorio: true, msgVazio: "Informe o que você comprou, como Ração ou Areia", nome: "Nome" }),
      unidade,
      quantidade,
      data: data(f.data, { obrigatoria: true, naoFutura: hoje }),
      valorCentavos: reais(f.valorCentavos),
      loja: texto(f.loja, 80, { nome: "Loja" }),
    };
  });
}

export function validarContagem(f, hoje) {
  return validar(() => {
    const quantidade = numero(f.quantidade, "Quantidade inválida");
    if (!(quantidade >= 0 && quantidade < 1_000_000)) falha("Quantidade inválida");
    return { itemId: str(f.itemId), quantidade, data: data(f.data, { obrigatoria: true, naoFutura: hoje }) };
  });
}

export function validarGasto(f, hoje) {
  return validar(() => {
    const categoria = str(f.categoria);
    if (!(categoria in CATEGORIAS_GASTO)) falha("Escolha a categoria");
    return {
      data: data(f.data, { obrigatoria: true, naoFutura: hoje }),
      valorCentavos: reais(f.valorCentavos, { obrigatorio: true }),
      categoria,
      descricao: texto(f.descricao, 200, { nome: "Descrição" }),
      loja: texto(f.loja, 80, { nome: "Loja" }),
      gatoId: str(f.gatoId) || undefined,
    };
  });
}

// Alguns navegadores mandam HEIC (foto de iPhone) com tipo vazio.
const MIME_POR_EXTENSAO = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  webp: "image/webp", heic: "image/heic", heif: "image/heif",
};

export const extensaoDe = (nome) => (nome.includes(".") ? nome.split(".").pop().toLowerCase() : "");

/** Confere tipo e tamanho de um File. Devolve { valor: { mime, ext } } ou { erro }. */
export function validarArquivo({ name, type, size }) {
  return validar(() => {
    const ext = extensaoDe(name);
    const mime = type || MIME_POR_EXTENSAO[ext] || "";
    if (!MIMES_ANEXO.includes(mime)) falha(`${name}: use PDF ou foto (JPG, PNG, WEBP, HEIC)`);
    if (size > TAMANHO_MAX_ANEXO) falha(`${name} passa de 10 MB`);
    return { mime, ext };
  });
}

export function validarCadastro(f) {
  return validar(() => {
    const email = str(f.email).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) falha("E-mail inválido");
    const senha = typeof f.senha === "string" ? f.senha : "";
    if (senha.length < 8) falha("A senha precisa ter pelo menos 8 caracteres");
    if (senha.length > 72) falha("Senha muito longa");
    if (senha !== f.confirmacao) falha("As senhas não conferem");
    return { email, senha };
  });
}
