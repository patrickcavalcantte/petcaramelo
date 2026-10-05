"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirUsuario } from "@/lib/supabase/server";
import { formParaObjeto, gastoSchema, primeiroErro } from "@/lib/schemas";
import { hojeISO } from "@/lib/domain/datas";
import { destinoSeguro, mensagemDoBanco, voltarComErro, voltarComSucesso } from "@/lib/navegacao";

export async function criarGasto(formData: FormData) {
  const { supabase } = await exigirUsuario();
  const destino = destinoSeguro(formData.get("voltar"), "/gastos");
  const r = gastoSchema(hojeISO()).safeParse(formParaObjeto(formData));
  if (!r.success) voltarComErro(destino, primeiroErro(r.error));
  const g = r.data;

  const { error } = await supabase.from("gastos").insert({
    data: g.data,
    valor_centavos: g.valorCentavos,
    categoria: g.categoria,
    descricao: g.descricao ?? null,
    loja: g.loja ?? null,
    gato_id: g.gatoId ?? null,
  });
  if (error) voltarComErro(destino, mensagemDoBanco(error));

  revalidatePath("/", "layout");
  voltarComSucesso(destino, "Gasto lançado");
}

export async function apagarGasto(formData: FormData) {
  const { supabase } = await exigirUsuario();
  const destino = destinoSeguro(formData.get("voltar"), "/gastos");
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) voltarComErro(destino, "Gasto não encontrado");

  const { error } = await supabase.from("gastos").delete().eq("id", id.data);
  if (error) voltarComErro(destino, mensagemDoBanco(error));

  revalidatePath("/", "layout");
  voltarComSucesso(destino, "Gasto apagado");
}
