import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { exigirUsuario } from "@/lib/supabase/server";
import { carregarEventos } from "@/lib/consultas";
import { alternarAtivo, apagarGato, atualizarGato } from "@/app/acoes/gatos";
import { apagarAnexo, apagarEvento } from "@/app/acoes/saude";
import { calcularVencimentos } from "@/lib/domain/vencimentos";
import { formatarData, hojeISO, idade } from "@/lib/domain/datas";
import { formatarPeso, textoPrazo } from "@/lib/formato";
import { TIPOS_EVENTO } from "@/lib/schemas";
import { BUCKET_DOCUMENTOS } from "@/lib/env";
import type { Anexo, Gato } from "@/lib/tipos";
import { Avisos, lerAvisos } from "@/components/Avisos";
import { EventoForm } from "@/components/EventoForm";
import { EnviarDocumento } from "@/components/EnviarDocumento";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PaginaGato({ params, searchParams }: Props) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { erro, ok } = await lerAvisos(searchParams);
  const { supabase, userId } = await exigirUsuario();
  const hoje = hojeISO();
  const aqui = `/gatos/${id}`;

  const [{ data: gatoBruto }, eventos, { data: anexosBrutos }, todosEventos] = await Promise.all([
    supabase.from("gatos").select("*").eq("id", id).maybeSingle(),
    carregarEventos(supabase, id),
    supabase.from("anexos").select("*").eq("gato_id", id).order("criado_em", { ascending: false }),
    supabase.from("eventos_saude").select("titulo").limit(2000),
  ]);
  if (!gatoBruto) notFound();
  const gato = gatoBruto as Gato;
  const anexos = (anexosBrutos ?? []) as Anexo[];

  // URLs temporárias: o bucket é privado, cada link vale 1 hora.
  const links = new Map<string, string>();
  if (anexos.length) {
    const { data } = await supabase.storage
      .from(BUCKET_DOCUMENTOS)
      .createSignedUrls(anexos.map((a) => a.storage_path), 3600);
    for (const s of data ?? []) if (s.path && s.signedUrl) links.set(s.path, s.signedUrl);
  }
  const anexosPorEvento = new Map<string, Anexo[]>();
  const anexosSoltos: Anexo[] = [];
  for (const a of anexos) {
    if (a.evento_id) anexosPorEvento.set(a.evento_id, [...(anexosPorEvento.get(a.evento_id) ?? []), a]);
    else anexosSoltos.push(a);
  }

  const vencimentos = calcularVencimentos(
    eventos.map((e) => ({ id: e.id, gatoId: e.gato_id, tipo: e.tipo, titulo: e.titulo, data: e.data, proximaData: e.proxima_data })),
    hoje,
    60,
  );
  const pesos = eventos.filter((e) => e.peso_kg !== null);
  const titulosUsados = [...new Set(((todosEventos.data ?? []) as { titulo: string }[]).map((e) => e.titulo))].sort();

  const listaAnexos = (lista: Anexo[]) => (
    <ul className="anexos">
      {lista.map((a) => (
        <li key={a.id}>
          {links.get(a.storage_path) ? (
            <a href={links.get(a.storage_path)} target="_blank" rel="noopener noreferrer">
              {a.nome_arquivo}
            </a>
          ) : (
            <span>{a.nome_arquivo}</span>
          )}
          <form action={apagarAnexo}>
            <input type="hidden" name="id" value={a.id} />
            <input type="hidden" name="voltar" value={aqui} />
            <button className="link-botao perigo" type="submit" aria-label={`Apagar ${a.nome_arquivo}`}>
              apagar
            </button>
          </form>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <p className="trilha">
        <Link href="/gatos">Gatos</Link>
      </p>
      <header className="cabecalho-gato">
        <span className="inicial-grande" aria-hidden>
          {gato.nome.trim().charAt(0).toUpperCase()}
        </span>
        <div>
          <h1>{gato.nome}</h1>
          <p className="suave">
            {[
              gato.nascimento && idade(gato.nascimento, hoje),
              gato.sexo === "macho" ? "macho" : gato.sexo === "femea" ? "fêmea" : null,
              gato.castrado ? "castrado" : null,
              pesos[0]?.peso_kg ? formatarPeso(pesos[0].peso_kg) : null,
              !gato.ativo ? "arquivado" : null,
            ]
              .filter(Boolean)
              .join(", ") || "Complete os dados abaixo"}
          </p>
          {gato.descricao && <p>{gato.descricao}</p>}
        </div>
      </header>

      <Avisos erro={erro} ok={ok} />

      {vencimentos.length > 0 && (
        <section className="bloco">
          <h2>Pendências</h2>
          <ul className="lista-pendencias">
            {vencimentos.map((v) => (
              <li key={v.id} data-situacao={v.situacao}>
                <span>{v.titulo}</span>
                <span>{formatarData(v.proximaData)}</span>
                <span className="prazo">{textoPrazo(v)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="bloco">
        <h2>Histórico</h2>
        {eventos.length === 0 ? (
          <p className="suave">Nada registrado ainda. Comece pela última vacina ou pelo peso de hoje.</p>
        ) : (
          <ol className="linha-do-tempo">
            {eventos.map((e) => (
              <li key={e.id}>
                <time dateTime={e.data}>{formatarData(e.data)}</time>
                <div>
                  <p className="evento-titulo">
                    <span className="tipo">{TIPOS_EVENTO[e.tipo]}</span> {e.titulo}
                    {e.peso_kg !== null && <span className="num"> {formatarPeso(e.peso_kg)}</span>}
                  </p>
                  {e.detalhes && <p className="detalhes">{e.detalhes}</p>}
                  {e.proxima_data && <p className="suave">Próxima: {formatarData(e.proxima_data)}</p>}
                  {anexosPorEvento.get(e.id) && listaAnexos(anexosPorEvento.get(e.id)!)}
                  <form action={apagarEvento}>
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="voltar" value={aqui} />
                    <button className="link-botao perigo" type="submit">
                      apagar registro
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {gato.ativo && (
        <details className="bloco" open={eventos.length === 0}>
          <summary>Registrar cuidado para {gato.nome}</summary>
          <EventoForm hoje={hoje} voltar={aqui} titulosUsados={titulosUsados} gatoFixo={gato} />
        </details>
      )}

      <section className="bloco">
        <h2>Documentos</h2>
        {anexosSoltos.length > 0 ? listaAnexos(anexosSoltos) : <p className="suave">Nenhum documento solto.</p>}
        <EnviarDocumento
          userId={userId}
          gatoId={gato.id}
          eventos={eventos.slice(0, 30).map((e) => ({ id: e.id, rotulo: `${formatarData(e.data)} ${e.titulo}` }))}
        />
      </section>

      <details className="bloco">
        <summary>Editar dados</summary>
        <form action={atualizarGato} className="form">
          <input type="hidden" name="id" value={gato.id} />
          <label>
            Nome
            <input name="nome" defaultValue={gato.nome} required maxLength={60} />
          </label>
          <div className="linha-campos">
            <label>
              Nascimento (aproximado serve)
              <input type="date" name="nascimento" defaultValue={gato.nascimento ?? ""} max={hoje} />
            </label>
            <label>
              Sexo
              <select name="sexo" defaultValue={gato.sexo ?? ""}>
                <option value="">Não informado</option>
                <option value="femea">Fêmea</option>
                <option value="macho">Macho</option>
              </select>
            </label>
          </div>
          <label className="check">
            <input type="checkbox" name="castrado" defaultChecked={gato.castrado} /> Castrado
          </label>
          <label>
            Como reconhecer
            <input name="descricao" defaultValue={gato.descricao ?? ""} maxLength={200} placeholder="Frajola, mancha no nariz" />
          </label>
          <label>
            Microchip
            <input name="microchip" defaultValue={gato.microchip ?? ""} maxLength={40} />
          </label>
          <label>
            Observações
            <textarea name="observacoes" rows={3} defaultValue={gato.observacoes ?? ""} maxLength={2000} placeholder="Alergias, temperamento, o que funciona para dar remédio" />
          </label>
          <button className="botao" type="submit">
            Salvar dados
          </button>
        </form>
      </details>

      <details className="bloco zona-perigo">
        <summary>Arquivar ou apagar</summary>
        <form action={alternarAtivo} className="form">
          <input type="hidden" name="id" value={gato.id} />
          <input type="hidden" name="ativo" value={String(!gato.ativo)} />
          <p className="suave">
            {gato.ativo
              ? "Arquivar tira o gato das listas e pendências (adoção, falecimento) e mantém o histórico."
              : "Este gato está arquivado."}
          </p>
          <button className="botao botao-secundario" type="submit">
            {gato.ativo ? "Arquivar" : "Reativar"}
          </button>
        </form>
        <form action={apagarGato} className="form">
          <input type="hidden" name="id" value={gato.id} />
          <label>
            Para apagar tudo, inclusive documentos, digite {gato.nome}
            <input name="confirmacao" autoComplete="off" />
          </label>
          <button className="botao botao-perigo" type="submit">
            Apagar para sempre
          </button>
        </form>
      </details>
    </>
  );
}
