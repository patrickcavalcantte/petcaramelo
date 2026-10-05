"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirUsuario } from "@/lib/supabase/server";
import {
  ajusteConsumoSchema, compraSchema, contagemSchema, formParaObjeto, itemEstoqueSchema, primeiroErro,
} from "@/lib/schemas";
import { hojeISO } from "@/lib/domain/datas";
import { mensagemDoBanco, voltarComErro, voltarComSucesso } from "@/lib/navegacao";

const DESTINO = "/estoque";

export async function criarItem(formData: FormData) {
  const { supabase } = await exigirUsuario();
  const r = itemEstoqueSchema.safeParse(formParaObjeto(formData));
  if (!r.success) voltarComErro(DESTINO, primeiroErro(r.error));
  const i = r.data;

  const { error } = await supabase.from("itens_estoque").insert({
    nome: i.nome,
    categoria: i.categoria,
    unidade: i.unidade,
    consumo_diario: i.consumoDiario,
    alerta_dias: i.alertaDias,
  });
  if (error) voltarComErro(DESTINO, mensagemDoBanco(error, "um item"));

  revalidatePath("/", "layout");
  voltarComSucesso(DESTINO, `${i.nome} adicionado. Registre uma contagem para começar a estimativa.`);
}

export async function registrarCompra(formData: FormData) {
  const { supabase } = await exigirUsuario();
  const r = compraSchema(hojeISO()).safeParse(formParaObjeto(formData));
  if (!r.success) voltarComErro(DESTINO, primeiroErro(r.error));
  const c = r.data;

  const { error } = await supabase.rpc("registrar_compra", {
    p_item_id: c.itemId,
    p_quantidade: c.quantidade,
    p_data: c.data,
    p_valor_centavos: c.valorCentavos ?? null,
    p_loja: c.loja ?? null,
  });
  if (error) voltarComErro(DESTINO, mensagemDoBanco(error));

  revalidatePath("/", "layout");
  voltarComSucesso(DESTINO, c.valorCentavos ? "Compra registrada e lançada nos gastos" : "Compra registrada");
}

export async function registrarContagem(formData: FormData) {
  const { supabase } = await exigirUsuario();
  const r = contagemSchema(hojeISO()).safeParse(formParaObjeto(formData));
  if (!r.success) voltarComErro(DESTINO, primeiroErro(r.error));
  const c = r.data;

  const { error } = await supabase
    .from("movimentos_estoque")
    .insert({ item_id: c.itemId, tipo: "contagem", quantidade: c.quantidade, data: c.data });
  if (error) voltarComErro(DESTINO, mensagemDoBanco(error));

  revalidatePath("/", "layout");
  voltarComSucesso(DESTINO, "Contagem registrada");
}

export async function ajustarConsumo(formData: FormData) {
  const { supabase } = await exigirUsuario();
  const r = ajusteConsumoSchema.safeParse(formParaObjeto(formData));
  if (!r.success) voltarComErro(DESTINO, primeiroErro(r.error));

  const { error } = await supabase
    .from("itens_estoque")
    .update({ consumo_diario: r.data.consumoDiario })
    .eq("id", r.data.itemId);
  if (error) voltarComErro(DESTINO, mensagemDoBanco(error));

  revalidatePath("/", "layout");
  voltarComSucesso(DESTINO, "Consumo atualizado");
}

export async function apagarMovimento(formData: FormData) {
  const { supabase } = await exigirUsuario();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) voltarComErro(DESTINO, "Movimento não encontrado");
  // O gasto ligado a uma compra continua existindo: ele é dinheiro gasto de fato.
  const { error } = await supabase.from("movimentos_estoque").delete().eq("id", id.data);
  if (error) voltarComErro(DESTINO, mensagemDoBanco(error));
  revalidatePath("/", "layout");
  voltarComSucesso(DESTINO, "Movimento apagado. Se havia gasto, ele continua em Gastos.");
}

export async function arquivarItem(formData: FormData) {
  const { supabase } = await exigirUsuario();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) voltarComErro(DESTINO, "Item não encontrado");
  const { error } = await supabase.from("itens_estoque").update({ ativo: false }).eq("id", id.data);
  if (error) voltarComErro(DESTINO, mensagemDoBanco(error));
  revalidatePath("/", "layout");
  voltarComSucesso(DESTINO, "Item arquivado");
}
