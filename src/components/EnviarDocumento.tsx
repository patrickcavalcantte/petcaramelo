"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clienteNavegador } from "@/lib/supabase/browser";
import { registrarAnexo } from "@/app/acoes/saude";
import { BUCKET_DOCUMENTOS } from "@/lib/env";
import { MIMES_ANEXO, TAMANHO_MAX_ANEXO } from "@/lib/schemas";

type Props = {
  userId: string;
  gatoId: string;
  eventos: { id: string; rotulo: string }[];
};

// Alguns navegadores mandam HEIC (foto de iPhone) com tipo vazio.
const POR_EXTENSAO: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

function extensao(nome: string) {
  return nome.split(".").pop()?.toLowerCase() ?? "";
}

export function EnviarDocumento({ userId, gatoId, eventos }: Props) {
  const router = useRouter();
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [eventoId, setEventoId] = useState("");
  const [estado, setEstado] = useState<{ tipo: "parado" | "enviando" | "erro" | "ok"; msg?: string }>({
    tipo: "parado",
  });

  async function enviar() {
    const arquivos = Array.from(arquivoRef.current?.files ?? []);
    if (arquivos.length === 0) {
      setEstado({ tipo: "erro", msg: "Escolha um arquivo" });
      return;
    }
    const supabase = clienteNavegador();
    setEstado({ tipo: "enviando", msg: `Enviando ${arquivos.length === 1 ? "arquivo" : `${arquivos.length} arquivos`}…` });

    for (const arquivo of arquivos) {
      const ext = extensao(arquivo.name);
      const mime = arquivo.type || POR_EXTENSAO[ext] || "";
      if (!(MIMES_ANEXO as readonly string[]).includes(mime)) {
        setEstado({ tipo: "erro", msg: `${arquivo.name}: use PDF ou foto (JPG, PNG, WEBP, HEIC)` });
        return;
      }
      if (arquivo.size > TAMANHO_MAX_ANEXO) {
        setEstado({ tipo: "erro", msg: `${arquivo.name} passa de 10 MB` });
        return;
      }

      const caminho = `${userId}/${gatoId}/${crypto.randomUUID()}.${ext || "bin"}`;
      const { error: eUpload } = await supabase.storage
        .from(BUCKET_DOCUMENTOS)
        .upload(caminho, arquivo, { contentType: mime, upsert: false });
      if (eUpload) {
        setEstado({ tipo: "erro", msg: `Falha ao enviar ${arquivo.name}. Tente de novo.` });
        return;
      }

      const r = await registrarAnexo({
        gatoId,
        eventoId: eventoId || undefined,
        storagePath: caminho,
        nomeArquivo: arquivo.name,
        mime,
        tamanhoBytes: arquivo.size,
      });
      if (r.erro) {
        // Desfaz o upload para não deixar arquivo sem registro no bucket.
        await supabase.storage.from(BUCKET_DOCUMENTOS).remove([caminho]);
        setEstado({ tipo: "erro", msg: r.erro });
        return;
      }
    }

    if (arquivoRef.current) arquivoRef.current.value = "";
    setEstado({ tipo: "ok", msg: arquivos.length === 1 ? "Documento guardado" : "Documentos guardados" });
    router.refresh();
  }

  const enviando = estado.tipo === "enviando";
  return (
    <div className="form">
      <label>
        Arquivo
        <input
          ref={arquivoRef}
          type="file"
          multiple
          accept=".pdf,image/jpeg,image/png,image/webp,.heic,.heif"
          disabled={enviando}
        />
        <small>PDF ou foto do laudo, receita ou carteirinha. Até 10 MB cada.</small>
      </label>
      {eventos.length > 0 && (
        <label>
          Ligar a um registro
          <select value={eventoId} onChange={(e) => setEventoId(e.target.value)} disabled={enviando}>
            <option value="">Nenhum, guardar solto</option>
            {eventos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.rotulo}
              </option>
            ))}
          </select>
        </label>
      )}
      <button type="button" className="botao" onClick={enviar} disabled={enviando}>
        {enviando ? "Enviando…" : "Guardar documento"}
      </button>
      {estado.msg && (
        <p role={estado.tipo === "erro" ? "alert" : "status"} className={`aviso ${estado.tipo === "erro" ? "aviso-erro" : "aviso-ok"}`}>
          {estado.msg}
        </p>
      )}
    </div>
  );
}
