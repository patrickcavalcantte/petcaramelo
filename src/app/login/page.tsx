import { entrar } from "@/app/acoes/auth";
import { Avisos, lerAvisos } from "@/components/Avisos";

export const metadata = { title: "Entrar" };

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { erro } = await lerAvisos(searchParams);
  return (
    <main className="login">
      <h1 className="marca-grande">Gatil</h1>
      <p className="suave">Saúde, estoque e gastos da colônia.</p>
      <Avisos erro={erro} />
      <form action={entrar} className="form">
        <label>
          E-mail
          <input type="email" name="email" autoComplete="email" required />
        </label>
        <label>
          Senha
          <input type="password" name="senha" autoComplete="current-password" required />
        </label>
        <button className="botao" type="submit">
          Entrar
        </button>
      </form>
    </main>
  );
}
