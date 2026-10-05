"use server";
import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/supabase/server";
import { gatoSchema, primeiroErro, formParaObjeto } from "@/lib/schemas";
import { hojeISO } from "@/lib/domain/datas";
import { nomesEmLote } from "@/lib/domain/lote";
import { BUCKET_DOCUMENTOS } from "@/lib/env";
import { destinoSeguro, mensagemDoBanco, voltarComErro, voltarComSucesso } from "@/lib/navegacao";
import { z } from "zod";

export async function criarGatosEmLote(formData: FormData) {
  const { supabase } = await exigirUsuario();
  const { data: existentes, error: e1 } = await supabase.from("gatos").select("nome");
  if (e1) voltarComErro("/gatos", mensagemDoBanco(e1));

  const { novos, ignorados, invalidos } = nomesEmLote(
    String(formData.get("nomes") ?? ""),
    (existentes ?? []).map((g: { nome: string }) => g.nome),
  );
  if (invalidos.length) voltarComErro("/gatos", `Nome com mais de 60 caracteres: ${invalidos[0].slice(0, 20)}…`);
  if (novos.length === 0) {
    voltarComErro("/gatos", ignorados.length ? "Esses gatos já estão cadastrados" : "Escreva pelo menos um nome");
  }

  const { error } = await supabase.from("gatos").insert(novos.map((nome) => ({ nome })));
  if (error) voltarComErro("/gatos", mensagemDoBanco(error, "um gato"));

  revalidatePath("/", "layout");
  const extra = ignorados.length ? ` (${ignorados.length} já existiam)` : "";
  voltarComSucesso("/gatos", `${novos.length} ${novos.length === 1 ? "gato adicionado" : "gatos adicionados"}${extra}`);
}

export async function atualizarGato(formData: FormData) {
  const { supabase } = await exigirUsuario();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) voltarComErro("/gatos", "Gato não encontrado");
  const destino = `/gatos/${id.data}`;

  const r = gatoSchema(hojeISO()).safeParse(formParaObjeto(formData));
  if (!r.success) voltarComErro(destino, primeiroErro(r.error));
  const g = r.data;

  const { error } = await supabase
    .from("gatos")
    .update({
      nome: g.nome,
      nascimento: g.nascimento ?? null,
      sexo: g.sexo ?? null,
      castrado: g.castrado,
      descricao: g.descricao ?? null,
      microchip: g.microchip ?? null,
      observacoes: g.observacoes ?? null,
    })
    .eq("id", id.data);
  if (error) voltarComErro(destino, mensagemDoBanco(error, "um gato"));

  revalidatePath("/", "layout");
  voltarComSucesso(destino, "Dados salvos");
}

export async function alternarAtivo(formData: FormData) {
  const { supabase } = await exigirUsuario();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) voltarComErro("/gatos", "Gato não encontrado");
  const ativo = formData.get("ativo") === "true";

  const { error } = await supabase.from("gatos").update({ ativo }).eq("id", id.data);
  if (error) voltarComErro(`/gatos/${id.data}`, mensagemDoBanco(error));

  revalidatePath("/", "layout");
  voltarComSucesso(`/gatos/${id.data}`, ativo ? "Gato de volta à lista" : "Gato arquivado. O histórico continua aqui.");
}

/**
 * Apaga o gato, os eventos e os anexos. Os arquivos do Storage são removidos
 * antes, porque o banco apagaria as linhas em cascata mas deixaria os
 * arquivos órfãos no bucket.
 */
export async function apagarGato(formData: FormData) {
  const { supabase } = await exigirUsuario();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) voltarComErro("/gatos", "Gato não encontrado");
  const destino = `/gatos/${id.data}`;

  const confirmacao = String(formData.get("confirmacao") ?? "").trim().toLowerCase();
  const { data: gato } = await supabase.from("gatos").select("nome").eq("id", id.data).maybeSingle();
  if (!gato) voltarComErro("/gatos", "Gato não encontrado");
  if (confirmacao !== gato.nome.trim().toLowerCase()) {
    voltarComErro(destino, "Digite o nome do gato para confirmar");
  }

  const { data: anexos } = await supabase.from("anexos").select("storage_path").eq("gato_id", id.data);
  const caminhos = (anexos ?? []).map((a: { storage_path: string }) => a.storage_path);
  if (caminhos.length) {
    const { error } = await supabase.storage.from(BUCKET_DOCUMENTOS).remove(caminhos);
    if (error) voltarComErro(destino, "Não consegui apagar os documentos. Nada foi removido.");
  }

  const { error } = await supabase.from("gatos").delete().eq("id", id.data);
  if (error) voltarComErro(destino, mensagemDoBanco(error));

  revalidatePath("/", "layout");
  voltarComSucesso(destinoSeguro("/gatos"), `${gato.nome} foi apagado`);
}
