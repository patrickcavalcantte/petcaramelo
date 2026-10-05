import Link from "next/link";
import { exigirUsuario } from "@/lib/supabase/server";
import { carregarGatos } from "@/lib/consultas";
import { hojeISO } from "@/lib/domain/datas";
import { Avisos, lerAvisos } from "@/components/Avisos";
import { EventoForm } from "@/components/EventoForm";

export const metadata = { title: "Registrar cuidado" };

export default async function RegistrarCuidado({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { erro, ok } = await lerAvisos(searchParams);
  const { supabase } = await exigirUsuario();
  const [gatos, { data: titulos }] = await Promise.all([
    carregarGatos(supabase, true),
    supabase.from("eventos_saude").select("titulo").limit(2000),
  ]);
  const titulosUsados = [...new Set(((titulos ?? []) as { titulo: string }[]).map((t) => t.titulo))].sort();

  return (
    <>
      <h1>Registrar cuidado</h1>
      <p className="suave">
        Para vários gatos de uma vez, como o vermífugo da colônia inteira. Peso se registra na página de cada gato.
      </p>
      <Avisos erro={erro} ok={ok} />
      {gatos.length === 0 ? (
        <p>
          <Link href="/gatos">Cadastre os gatos</Link> primeiro.
        </p>
      ) : (
        <EventoForm hoje={hojeISO()} voltar="/saude/novo" titulosUsados={titulosUsados} gatos={gatos} />
      )}
    </>
  );
}
