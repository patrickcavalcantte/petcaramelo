import Link from "next/link";
import { exigirUsuario } from "@/lib/supabase/server";
import { carregarEventos, carregarGatos } from "@/lib/consultas";
import { criarGatosEmLote } from "@/app/acoes/gatos";
import { hojeISO, idade } from "@/lib/domain/datas";
import { formatarPeso } from "@/lib/formato";
import { Avisos, lerAvisos } from "@/components/Avisos";

export const metadata = { title: "Gatos" };

export default async function Gatos({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { erro, ok } = await lerAvisos(searchParams);
  const { supabase } = await exigirUsuario();
  const hoje = hojeISO();
  const [gatos, eventos] = await Promise.all([carregarGatos(supabase), carregarEventos(supabase)]);

  // eventos vêm do mais recente para o mais antigo: o primeiro peso é o atual
  const ultimoPeso = new Map<string, number>();
  for (const e of eventos) if (e.peso_kg !== null && !ultimoPeso.has(e.gato_id)) ultimoPeso.set(e.gato_id, e.peso_kg);

  const ativos = gatos.filter((g) => g.ativo);
  const arquivados = gatos.filter((g) => !g.ativo);

  return (
    <>
      <h1>Gatos {ativos.length > 0 && <span className="contagem">{ativos.length}</span>}</h1>
      <Avisos erro={erro} ok={ok} />

      {ativos.length > 0 && (
        <ul className="tabela-gatos">
          {ativos.map((g) => (
            <li key={g.id}>
              <Link href={`/gatos/${g.id}`}>{g.nome}</Link>
              <span>{g.nascimento ? idade(g.nascimento, hoje) ?? "" : <span className="suave">idade?</span>}</span>
              <span>
                {g.sexo === "macho" ? "macho" : g.sexo === "femea" ? "fêmea" : ""}
                {g.castrado ? ", castrado" : ""}
              </span>
              <span className="num">{ultimoPeso.has(g.id) ? formatarPeso(ultimoPeso.get(g.id)!) : ""}</span>
            </li>
          ))}
        </ul>
      )}

      <section className="bloco">
        <h2>Adicionar gatos</h2>
        <form action={criarGatosEmLote} className="form">
          <label>
            Nomes
            <textarea name="nomes" rows={6} placeholder={"Frajola\nMingau\nPipoca"} required />
            <small>Um por linha. Nomes repetidos são ignorados. Idade, sexo e o resto você completa na página de cada gato.</small>
          </label>
          <button className="botao" type="submit">
            Adicionar
          </button>
        </form>
      </section>

      {arquivados.length > 0 && (
        <details className="bloco">
          <summary>Arquivados ({arquivados.length})</summary>
          <ul className="lista-simples">
            {arquivados.map((g) => (
              <li key={g.id}>
                <Link href={`/gatos/${g.id}`}>{g.nome}</Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
