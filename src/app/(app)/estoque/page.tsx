import { exigirUsuario } from "@/lib/supabase/server";
import { carregarEstoque } from "@/lib/consultas";
import {
  ajustarConsumo, apagarMovimento, arquivarItem, criarItem, registrarCompra, registrarContagem,
} from "@/app/acoes/estoque";
import { formatarData, hojeISO } from "@/lib/domain/datas";
import { formatarQuantidade } from "@/lib/formato";
import { Avisos, lerAvisos } from "@/components/Avisos";

export const metadata = { title: "Estoque" };

const STATUS = { sem_dados: "sem contagem", ok: "ok", baixo: "acabando", acabou: "acabou" } as const;

export default async function Estoque({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { erro, ok } = await lerAvisos(searchParams);
  const { supabase } = await exigirUsuario();
  const hoje = hojeISO();
  const itens = await carregarEstoque(supabase, hoje);

  return (
    <>
      <h1>Estoque</h1>
      <p className="suave">
        O app estima quanto sobrou a partir da última contagem, das compras e do consumo diário. Conte de vez em quando
        para corrigir a estimativa.
      </p>
      <Avisos erro={erro} ok={ok} />

      {itens.map((i) => {
        const e = i.estimativa;
        const sugestao =
          i.consumoObservado !== null && Math.abs(i.consumoObservado - i.consumo_diario) / Math.max(i.consumo_diario, 0.001) > 0.15
            ? i.consumoObservado
            : null;
        return (
          <section key={i.id} className="bloco item-estoque" data-status={e.status}>
            <header>
              <h2>{i.nome}</h2>
              <span className="selo">{STATUS[e.status]}</span>
            </header>
            {e.quantidade === null ? (
              <p>Registre uma contagem para começar.</p>
            ) : (
              <p className="numero-grande">
                ≈ {formatarQuantidade(e.quantidade, i.unidade)}
                {e.acabaEm && (
                  <span className="suave">
                    {" "}
                    dura até {formatarData(e.acabaEm)} ({e.diasRestantes} {e.diasRestantes === 1 ? "dia" : "dias"})
                  </span>
                )}
              </p>
            )}
            <p className="suave">
              Consumo: {formatarQuantidade(i.consumo_diario, i.unidade)} por dia
              {sugestao !== null && (
                <>. Pelas suas contagens, o real tem sido {formatarQuantidade(sugestao, i.unidade)} por dia.</>
              )}
            </p>

            <div className="acoes-item">
              <details>
                <summary>Comprei</summary>
                <form action={registrarCompra} className="form">
                  <input type="hidden" name="itemId" value={i.id} />
                  <div className="linha-campos">
                    <label>
                      Quantidade ({i.unidade})
                      <input name="quantidade" inputMode="decimal" required />
                    </label>
                    <label>
                      Data
                      <input type="date" name="data" defaultValue={hoje} max={hoje} required />
                    </label>
                  </div>
                  <div className="linha-campos">
                    <label>
                      Valor pago
                      <input name="valorCentavos" inputMode="decimal" placeholder="R$ 0,00" />
                    </label>
                    <label>
                      Loja
                      <input name="loja" maxLength={80} />
                    </label>
                  </div>
                  <small>Com valor, a compra também entra em Gastos.</small>
                  <button className="botao" type="submit">
                    Registrar compra
                  </button>
                </form>
              </details>
              <details>
                <summary>Contei</summary>
                <form action={registrarContagem} className="form">
                  <input type="hidden" name="itemId" value={i.id} />
                  <div className="linha-campos">
                    <label>
                      Tem agora ({i.unidade})
                      <input name="quantidade" inputMode="decimal" required />
                    </label>
                    <label>
                      Data
                      <input type="date" name="data" defaultValue={hoje} max={hoje} required />
                    </label>
                  </div>
                  <button className="botao" type="submit">
                    Registrar contagem
                  </button>
                </form>
              </details>
              <details>
                <summary>Ajustar</summary>
                <form action={ajustarConsumo} className="form">
                  <input type="hidden" name="itemId" value={i.id} />
                  <label>
                    Consumo por dia ({i.unidade})
                    <input
                      name="consumoDiario"
                      inputMode="decimal"
                      defaultValue={String(sugestao ?? i.consumo_diario).replace(".", ",")}
                      required
                    />
                  </label>
                  <button className="botao" type="submit">
                    Salvar consumo
                  </button>
                </form>
                <form action={arquivarItem}>
                  <input type="hidden" name="id" value={i.id} />
                  <button className="link-botao perigo" type="submit">
                    Arquivar item
                  </button>
                </form>
              </details>
            </div>

            {i.movimentos.length > 0 && (
              <details>
                <summary>Movimentos recentes</summary>
                <ul className="lista-simples">
                  {i.movimentos
                    .slice(-8)
                    .reverse()
                    .map((m) => (
                      <li key={m.id}>
                        {formatarData(m.data)}: {m.tipo === "compra" ? "comprou" : "contou"}{" "}
                        {formatarQuantidade(m.quantidade, i.unidade)}
                        <form action={apagarMovimento} className="inline">
                          <input type="hidden" name="id" value={m.id} />
                          <button className="link-botao perigo" type="submit">
                            apagar
                          </button>
                        </form>
                      </li>
                    ))}
                </ul>
              </details>
            )}
          </section>
        );
      })}

      <section className="bloco">
        <h2>Novo item</h2>
        <form action={criarItem} className="form">
          <label>
            Nome
            <input name="nome" required maxLength={80} placeholder="Areia de sílica, Ração renal" />
          </label>
          <div className="linha-campos">
            <label>
              Categoria
              <select name="categoria" defaultValue="racao">
                <option value="racao">Ração</option>
                <option value="areia">Areia</option>
                <option value="outro">Outro</option>
              </select>
            </label>
            <label>
              Unidade
              <select name="unidade" defaultValue="kg">
                <option value="kg">kg</option>
                <option value="l">litro</option>
                <option value="un">unidade</option>
              </select>
            </label>
          </div>
          <div className="linha-campos">
            <label>
              Consumo por dia
              <input name="consumoDiario" inputMode="decimal" required placeholder="1,1" />
              <small>Chute inicial. Ex.: 18 gatos × 60 g de ração ≈ 1,1 kg por dia.</small>
            </label>
            <label>
              Avisar com quantos dias
              <input name="alertaDias" inputMode="numeric" defaultValue="7" required />
            </label>
          </div>
          <button className="botao" type="submit">
            Adicionar item
          </button>
        </form>
      </section>
    </>
  );
}
