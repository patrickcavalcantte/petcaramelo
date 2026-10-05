import Link from "next/link";
import { exigirUsuario } from "@/lib/supabase/server";
import { carregarGatos } from "@/lib/consultas";
import { apagarGasto, criarGasto } from "@/app/acoes/gastos";
import { deslocarMes, formatarData, hojeISO, intervaloDoMes, nomeDoMes } from "@/lib/domain/datas";
import { formatarReais } from "@/lib/domain/dinheiro";
import { CATEGORIAS_GASTO, resumirGastos } from "@/lib/domain/gastos";
import type { Gasto } from "@/lib/tipos";
import { Avisos, lerAvisos } from "@/components/Avisos";

export const metadata = { title: "Gastos" };

export default async function Gastos({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { erro, ok, params } = await lerAvisos(searchParams);
  const { supabase } = await exigirUsuario();
  const hoje = hojeISO();
  const mesAtual = hoje.slice(0, 7);
  const pedido = typeof params.mes === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.mes) ? params.mes : mesAtual;
  const mes = pedido > mesAtual ? mesAtual : pedido;
  const { inicio, fimExclusivo } = intervaloDoMes(mes);
  const aqui = `/gastos?mes=${mes}`;

  const [{ data, error }, gatos] = await Promise.all([
    supabase
      .from("gastos")
      .select("id, data, valor_centavos, categoria, descricao, loja, gato_id")
      .gte("data", inicio)
      .lt("data", fimExclusivo)
      .order("data", { ascending: false })
      .order("criado_em", { ascending: false }),
    carregarGatos(supabase),
  ]);
  if (error) throw error;
  const gastos = (data ?? []) as Gasto[];
  const nomes = new Map(gatos.map((g) => [g.id, g.nome]));
  const resumo = resumirGastos(gastos.map((g) => ({ valorCentavos: g.valor_centavos, categoria: g.categoria })));

  return (
    <>
      <h1>Gastos</h1>
      <nav className="navega-mes" aria-label="Mês">
        <Link href={`/gastos?mes=${deslocarMes(mes, -1)}`}>Mês anterior</Link>
        <strong>{nomeDoMes(mes)}</strong>
        {mes < mesAtual ? <Link href={`/gastos?mes=${deslocarMes(mes, 1)}`}>Próximo mês</Link> : <span />}
      </nav>
      <Avisos erro={erro} ok={ok} />

      <p className="numero-grande">{formatarReais(resumo.totalCentavos)}</p>
      {resumo.porCategoria.length > 0 && (
        <ul className="barras">
          {resumo.porCategoria.map((c) => (
            <li key={c.categoria}>
              <span>{CATEGORIAS_GASTO[c.categoria]}</span>
              <span className="barra" style={{ "--fracao": c.fracao } as React.CSSProperties} aria-hidden />
              <span className="num">{formatarReais(c.totalCentavos)}</span>
            </li>
          ))}
        </ul>
      )}

      {gastos.length === 0 ? (
        <p className="suave">Nenhum gasto em {nomeDoMes(mes)}.</p>
      ) : (
        <ul className="tabela-gastos">
          {gastos.map((g) => (
            <li key={g.id}>
              <time dateTime={g.data}>{formatarData(g.data).slice(0, 5)}</time>
              <span>
                {CATEGORIAS_GASTO[g.categoria]}
                {g.descricao && <span className="suave"> {g.descricao}</span>}
                {g.gato_id && nomes.get(g.gato_id) && <span className="suave"> ({nomes.get(g.gato_id)})</span>}
              </span>
              <span className="num">{formatarReais(g.valor_centavos)}</span>
              <form action={apagarGasto}>
                <input type="hidden" name="id" value={g.id} />
                <input type="hidden" name="voltar" value={aqui} />
                <button className="link-botao perigo" type="submit" aria-label="Apagar gasto">
                  apagar
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <section className="bloco">
        <h2>Lançar gasto</h2>
        <form action={criarGasto} className="form">
          <input type="hidden" name="voltar" value={aqui} />
          <div className="linha-campos">
            <label>
              Valor
              <input name="valorCentavos" inputMode="decimal" required placeholder="R$ 0,00" />
            </label>
            <label>
              Data
              <input type="date" name="data" defaultValue={hoje} max={hoje} required />
            </label>
          </div>
          <div className="linha-campos">
            <label>
              Categoria
              <select name="categoria" required defaultValue="">
                <option value="" disabled>
                  Escolha
                </option>
                {Object.entries(CATEGORIAS_GASTO).map(([v, r]) => (
                  <option key={v} value={v}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Gato (opcional)
              <select name="gatoId" defaultValue="">
                <option value="">Colônia toda</option>
                {gatos
                  .filter((g) => g.ativo)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nome}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="linha-campos">
            <label>
              Descrição
              <input name="descricao" maxLength={200} />
            </label>
            <label>
              Loja
              <input name="loja" maxLength={80} />
            </label>
          </div>
          <small>Compras de ração e areia ficam melhores pelo Estoque: lançam o gasto e atualizam a estimativa juntas.</small>
          <button className="botao" type="submit">
            Lançar gasto
          </button>
        </form>
      </section>
    </>
  );
}
