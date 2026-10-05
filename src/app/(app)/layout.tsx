import Link from "next/link";
import { sair } from "@/app/acoes/auth";
import { exigirUsuario } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // O proxy já redireciona, mas a checagem aqui garante que nenhuma página
  // renderize sem sessão válida, mesmo se o matcher mudar.
  await exigirUsuario();
  return (
    <>
      <header className="topo">
        <Link href="/" className="marca">
          Gatil
        </Link>
        <nav aria-label="Principal">
          <Link href="/gatos">Gatos</Link>
          <Link href="/saude/novo">Registrar cuidado</Link>
          <Link href="/estoque">Estoque</Link>
          <Link href="/gastos">Gastos</Link>
        </nav>
        <form action={sair}>
          <button type="submit" className="link-botao">
            Sair
          </button>
        </form>
      </header>
      <main className="conteudo">{children}</main>
    </>
  );
}
