import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL } from "../env";

const ROTAS_PUBLICAS = ["/login"];

/** Renova a sessão a cada requisição e manda quem não está logado para /login. */
export async function atualizarSessao(request: NextRequest) {
  let resposta = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(lista, headers) {
        lista.forEach(({ name, value }) => request.cookies.set(name, value));
        resposta = NextResponse.next({ request });
        lista.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => resposta.headers.set(k, v));
      },
    },
  });

  // Não coloque código entre a criação do cliente e esta chamada.
  const { data } = await supabase.auth.getClaims();
  const logado = Boolean(data?.claims?.sub);
  const caminho = request.nextUrl.pathname;
  const publica = ROTAS_PUBLICAS.some((r) => caminho === r || caminho.startsWith(`${r}/`));

  if (!logado && !publica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (logado && caminho === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return resposta;
}
