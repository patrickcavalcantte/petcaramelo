import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { SUPABASE_KEY, SUPABASE_URL } from "../env";

/** Um cliente por requisição. Nunca reaproveite entre requisições. */
export async function clienteServidor() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(lista) {
        try {
          lista.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server Components não podem gravar cookies. O proxy renova a sessão,
          // então ignorar aqui é seguro.
        }
      },
    },
  });
}

/**
 * Exige login e devolve o cliente e o id do usuário.
 * getClaims() valida o JWT; getSession() sozinho confiaria no cookie sem checar.
 * cache() faz layout e página dividirem a mesma checagem na mesma requisição.
 */
export const exigirUsuario = cache(async () => {
  const supabase = await clienteServidor();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  return { supabase, userId };
});
