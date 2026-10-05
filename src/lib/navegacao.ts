import { redirect } from "next/navigation";

/** Aceita só caminhos internos ("/gatos"), nunca "//site.com" ou "https://...". */
export function destinoSeguro(valor: unknown, padrao = "/"): string {
  if (typeof valor !== "string") return padrao;
  if (!valor.startsWith("/") || valor.startsWith("//") || valor.includes("\\")) return padrao;
  return valor;
}

function comParametro(destino: string, chave: string, msg: string): string {
  const url = new URL(destino, "http://x");
  url.searchParams.delete("erro");
  url.searchParams.delete("ok");
  url.searchParams.set(chave, msg);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function voltarComErro(destino: string, msg: string): never {
  redirect(comParametro(destino, "erro", msg));
}

export function voltarComSucesso(destino: string, msg: string): never {
  redirect(comParametro(destino, "ok", msg));
}

/** Traduz erros comuns do Postgres/PostgREST para algo legível. */
export function mensagemDoBanco(erro: { code?: string; message?: string } | null, contexto = ""): string {
  if (!erro) return "Algo deu errado";
  switch (erro.code) {
    case "23505":
      return contexto ? `Já existe ${contexto} com esse nome` : "Esse registro já existe";
    case "23503":
      return "Registro relacionado não encontrado. Recarregue a página.";
    case "23514":
      return "Algum valor está fora do permitido";
    case "42501":
      return "Sem permissão para essa ação";
    case "P0002":
    case "22023":
      return erro.message ?? "Dados inválidos";
    default:
      console.error("Erro do banco:", erro);
      return "Não foi possível salvar. Tente de novo.";
  }
}
