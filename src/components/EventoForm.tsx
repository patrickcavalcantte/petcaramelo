import { registrarEventos } from "@/app/acoes/saude";
import { TIPOS_EVENTO } from "@/lib/schemas";
import type { Gato } from "@/lib/tipos";

type Props = {
  hoje: string;
  voltar: string;
  titulosUsados: string[];
  /** Um gato fixo (página do gato) ou a lista para escolher (registro em lote). */
  gatoFixo?: Gato;
  gatos?: Gato[];
};

export function EventoForm({ hoje, voltar, titulosUsados, gatoFixo, gatos = [] }: Props) {
  return (
    <form action={registrarEventos} className="form">
      <input type="hidden" name="voltar" value={voltar} />

      {gatoFixo ? (
        <input type="hidden" name="gatoIds" value={gatoFixo.id} />
      ) : (
        <fieldset className="escolha-gatos">
          <legend>Para quais gatos</legend>
          <label className="check check-todos">
            <input type="checkbox" name="todos" /> Todos os gatos ativos
          </label>
          <div className="grade-checks">
            {gatos.map((g) => (
              <label key={g.id} className="check">
                <input type="checkbox" name="gatoIds" value={g.id} /> {g.nome}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="linha-campos">
        <label>
          Tipo
          <select name="tipo" required defaultValue="">
            <option value="" disabled>
              Escolha
            </option>
            {Object.entries(TIPOS_EVENTO).map(([v, rotulo]) => (
              <option key={v} value={v}>
                {rotulo}
              </option>
            ))}
          </select>
        </label>
        <label>
          Data
          <input type="date" name="data" defaultValue={hoje} max={hoje} required />
        </label>
      </div>

      <label>
        Título
        <input
          name="titulo"
          required
          maxLength={120}
          list="titulos-usados"
          placeholder="V5, Drontal, Hemograma, Retorno…"
        />
        <datalist id="titulos-usados">
          {titulosUsados.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <small>Use sempre o mesmo título para a mesma coisa. É assim que o app sabe que a V5 deste ano substitui a do ano passado.</small>
      </label>

      <div className="linha-campos">
        <label>
          Próxima dose ou retorno
          <input type="date" name="proximaData" min={hoje} />
        </label>
        {gatoFixo && (
          <label>
            Peso (kg)
            <input name="pesoKg" inputMode="decimal" placeholder="4,3" />
          </label>
        )}
      </div>

      <div className="linha-campos">
        <label>
          Valor pago
          <input name="valorCentavos" inputMode="decimal" placeholder="R$ 0,00" />
        </label>
        <label>
          Onde
          <input name="loja" maxLength={80} placeholder="Clínica, laboratório, loja" />
        </label>
      </div>

      <label>
        Observações
        <textarea name="detalhes" rows={3} maxLength={4000} placeholder="Dose, resultado, o que o veterinário disse" />
      </label>

      <button type="submit" className="botao">
        Registrar
      </button>
    </form>
  );
}
