"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirUsuario } from "@/lib/supabase/server";
import { anexoSchema, eventoSchema, formParaObjeto, primeiroErro } from "@/lib/schemas";
import { hojeISO } from "@/lib/domain/datas";
import { BUCKET_DOCUMENTOS } from "@/lib/env";
import { destinoSeguro, mensagemDoBanco, voltarComErro, voltarComSucesso } from "@/lib/navegacao";

export async function registrarEventos(formData: FormData) {
  const { supabase } = await exigirUsuario();
  const destino = destinoSeguro(formData.get("voltar"), "/saude/novo");
  const bruto = formParaObjeto(formData, ["gatoIds"]);

  // "Todos os gatos" resolve no servidor, sem depender de JavaScript na página.
  if (formData.get("todos") === "on") {
    const { data, error } = await supabase.from("gatos").select("id").eq("ativo", true);
    if (error) voltarComErro(destino, mensagemDoBanco(error));
    bruto.gatoIds = (data ?? []).map((g: { id: string }) => g.id);
  }

  const r = eventoSchema(hojeISO()).safeParse(bruto);
  if (!r.success) voltarComErro(destino, primeiroErro(r.error));
  const e = r.data;

  const { data: qtd, error } = await supabase.rpc("registrar_eventos", {
    p_gato_ids: e.gatoIds,
    p_tipo: e.tipo,
    p_data: e.data,
    p_titulo: e.titulo,
    p_detalhes: e.detalhes ?? null,
    p_peso_kg: e.pesoKg ?? null,
    p_proxima_data: e.proximaData ?? null,
    p_valor_centavos: e.valorCentavos ?? null,
    p_loja: e.loja ?? null,
  });
  if (error) voltarComErro(destino, mensagemDoBanco(error));

  revalidatePath("/", "layout");
  voltarComSucesso(destino, qtd === 1 ? "Registrado" : `Registrado para ${qtd} gatos`);
}

export async function apagarEvento(formData: FormData) {
  const { supabase } = await exigirUsuario();
  const destino = destinoSeguro(formData.get("voltar"), "/");
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) voltarComErro(destino, "Registro não encontrado");

  const { data: anexos } = await supabase.from("anexos").select("storage_path").eq("evento_id", id.data);
  const caminhos = (anexos ?? []).map((a: { storage_path: string }) => a.storage_path);
  if (caminhos.length) {
    const { error } = await supabase.storage.from(BUCKET_DOCUMENTOS).remove(caminhos);
    if (error) voltarComErro(destino, "Não consegui apagar os documentos. Nada foi removido.");
  }

  const { error } = await supabase.from("eventos_saude").delete().eq("id", id.data);
  if (error) voltarComErro(destino, mensagemDoBanco(error));

  revalidatePath("/", "layout");
  voltarComSucesso(destino, "Registro apagado");
}

/**
 * Chamada pelo navegador depois de enviar o arquivo direto ao Storage.
 * O upload não passa pelo servidor da Vercel de propósito: funções lá
 * aceitam corpos de até ~4,5 MB, e foto de laudo passa disso fácil.
 */
export async function registrarAnexo(dados: unknown): Promise<{ erro?: string }> {
  const { supabase, userId } = await exigirUsuario();
  const r = anexoSchema(userId).safeParse(dados);
  if (!r.success) return { erro: primeiroErro(r.error) };
  const a = r.data;

  const { error } = await supabase.from("anexos").insert({
    gato_id: a.gatoId,
    evento_id: a.eventoId ?? null,
    storage_path: a.storagePath,
    nome_arquivo: a.nomeArquivo,
    mime: a.mime,
    tamanho_bytes: a.tamanhoBytes,
  });
  if (error) return { erro: mensagemDoBanco(error) };

  revalidatePath(`/gatos/${a.gatoId}`);
  return {};
}

export async function apagarAnexo(formData: FormData) {
  const { supabase } = await exigirUsuario();
  const destino = destinoSeguro(formData.get("voltar"), "/");
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) voltarComErro(destino, "Documento não encontrado");

  const { data: anexo } = await supabase.from("anexos").select("storage_path").eq("id", id.data).maybeSingle();
  if (!anexo) voltarComErro(destino, "Documento não encontrado");

  const { error: eStorage } = await supabase.storage.from(BUCKET_DOCUMENTOS).remove([anexo.storage_path]);
  if (eStorage) voltarComErro(destino, "Não consegui apagar o arquivo");
  const { error } = await supabase.from("anexos").delete().eq("id", id.data);
  if (error) voltarComErro(destino, mensagemDoBanco(error));

  revalidatePath(destino);
  voltarComSucesso(destino, "Documento apagado");
}
