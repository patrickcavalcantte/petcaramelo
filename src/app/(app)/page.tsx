import Link from "next/link";
import { exigirUsuario } from "@/lib/supabase/server";
import { carregarEstoque, carregarEventos, carregarGatos } from "@/lib/consultas";
import { calcularVencimentos } from "@/lib/domain/vencimentos";
import { formatarData, hojeISO, intervaloDoMes } from "@/lib/domain/datas";
import { formatarReais } from "@/lib/domain/dinheiro";
import { CATEGORIAS_GASTO, resumirGastos, type GastoResumo } from "@/lib/domain/gastos";
import { formatarQuantidade, textoPrazo } from "@/lib/formato";

export default async function Painel() {
  const { supabase } = await exigirUsuario();
  const hoje = hojeISO();
  const mes = hoje.slice(0, 7);
  const { inicio, fimExclusivo } = intervaloDoMes(mes);

  const [gatos, eventos, estoque, gastosMes] = await Promise.all([
    carregarGatos(supabase, true),
    carregarEventos(supabase),
    carregarEstoque(supabase, hoje),
    supabase.from("gastos").select("valor_centavos, categoria").gte("data", inicio).lt("data", fimExclusivo),
  ]);

  const ativos = new Set(gatos.map((g) => g.id));
  const nomes = new Map(gatos.map((g) => [g.id, g.nome]));
  const vencimentos = calcularVencimentos(
    eventos
      .filter((e) => ativos.has(e.gato_id))
      .map((e) => ({ id: e.id, gatoId: e.gato_id, tipo: e.tipo, titulo: e.titulo, data: e.data, proximaData: e.proxima_data })),
    hoje,
    30,
  );
  const atrasadosPorGato = new Set(vencimentos.filter((v) => v.situacao === "atrasado").map((v) => v.gatoId));
  const alertasEstoque = estoque.filter((i) => i.estimativa.status === "baixo" || i.estimativa.status === "acabou");
  const resumo = resumirGastos(
    ((gastosMes.data ?? []) as { valor_centavos: number; categoria: GastoResumo["categoria"] }[]).map((g) => ({
      valorCentavos: g.valor_centavos,
      categoria: g.categoria,
    })),
  );

  if (gatos.length === 0) {
    return (
      <section className="vazio">
        <h1>Comece pelos gatos</h1>
        <p>Cadastre todos de uma vez, um nome por linha. Os detalhes de cada um podem vir depois.</p>
        <Link href="/gatos" className="botao">
          Cadastrar gatos
        </Link>
      </section>
    );
  }

  return (
    <div className="painel">
      <section aria-labelledby="t-pendencias">
        <h1 id="t-pendencias">Próximos 30 dias</h1>
        {vencimentos.length === 0 ? (
          <p className="suave">Nenhuma vacina, vermífugo ou retorno pendente.</p>
        ) : (
          <ul className="lista-pendencias">
            {vencimentos.map((v) => (
              <li key={v.id} data-situacao={v.situacao}>
                <Link href={`/gatos/${v.gatoId}`}>{nomes.get(v.gatoId)}</Link>
                <span>{v.titulo}</span>
                <span className="prazo">{textoPrazo(v)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="t-estoque">
        <h2 id="t-estoque">Estoque</h2>
        {estoque.length === 0 ? (
          <p className="suave">
            <Link href="/estoque">Cadastre a areia e a ração</Link> para saber quando vão acabar.
          </p>
        ) : alertasEstoque.length === 0 ? (
          <p className="suave">Tudo abastecido.</p>
        ) : (
          <ul className="lista-simples">
            {alertasEstoque.map((i) => (
              <li key={i.id} data-status={i.estimativa.status}>
                <strong>{i.nome}</strong>{" "}
                {i.estimativa.status === "acabou"
                  ? "deve ter acabado"
                  : `≈ ${formatarQuantidade(i.estimativa.quantidade ?? 0, i.unidade)}, acaba por volta de ${formatarData(i.estimativa.acabaEm!)}`}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="t-gastos">
        <h2 id="t-gastos">Gastos do mês</h2>
        <p className="numero-grande">{formatarReais(resumo.totalCentavos)}</p>
        {resumo.porCategoria.length > 0 && (
          <p className="suave">
            {resumo.porCategoria
              .slice(0, 3)
              .map((c) => `${CATEGORIAS_GASTO[c.categoria]} ${formatarReais(c.totalCentavos)}`)
              .join(", ")}
          </p>
        )}
        <Link href="/gastos">Ver gastos</Link>
      </section>

      <section aria-labelledby="t-colonia" className="secao-colonia">
        <h2 id="t-colonia">A colônia</h2>
        <ul className="plaquinhas">
          {gatos.map((g) => (
            <li key={g.id}>
              <Link href={`/gatos/${g.id}`} className="plaquinha" data-atraso={atrasadosPorGato.has(g.id) || undefined}>
                <span className="inicial" aria-hidden>
                  {g.nome.trim().charAt(0).toUpperCase()}
                </span>
                <span className="nome">{g.nome}</span>
                {atrasadosPorGato.has(g.id) && <span className="sr-only"> (tem pendência atrasada)</span>}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
