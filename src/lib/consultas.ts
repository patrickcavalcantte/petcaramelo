import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { estimarEstoque, consumoObservado, type Estimativa } from "./domain/estoque";
import type { EventoSaude, Gato, ItemEstoque, MovimentoEstoque } from "./tipos";

/**
 * Consultas compartilhadas entre páginas. Para uma colônia de dezenas de
 * gatos, carregar todos os eventos e movimentos e calcular em memória é
 * simples e rápido. Se um dia passar de alguns milhares de linhas, vale
 * mover o cálculo de vencimentos para uma view no Postgres.
 */

export async function carregarGatos(supabase: SupabaseClient, apenasAtivos = false): Promise<Gato[]> {
  let q = supabase.from("gatos").select("*").order("nome");
  if (apenasAtivos) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) throw error;
  return data as Gato[];
}

export async function carregarEventos(supabase: SupabaseClient, gatoId?: string): Promise<EventoSaude[]> {
  let q = supabase
    .from("eventos_saude")
    .select("id, gato_id, tipo, data, titulo, detalhes, peso_kg, proxima_data, gasto_id, criado_em")
    .order("data", { ascending: false })
    .order("criado_em", { ascending: false })
    .limit(5000);
  if (gatoId) q = q.eq("gato_id", gatoId);
  const { data, error } = await q;
  if (error) throw error;
  return (data as EventoSaude[]).map((e) => ({ ...e, peso_kg: e.peso_kg === null ? null : Number(e.peso_kg) }));
}

export type ItemComEstimativa = ItemEstoque & {
  estimativa: Estimativa;
  consumoObservado: number | null;
  movimentos: MovimentoEstoque[];
};

export async function carregarEstoque(supabase: SupabaseClient, hoje: string): Promise<ItemComEstimativa[]> {
  const [{ data: itens, error: e1 }, { data: movs, error: e2 }] = await Promise.all([
    supabase.from("itens_estoque").select("*").eq("ativo", true).order("nome"),
    supabase
      .from("movimentos_estoque")
      .select("id, item_id, tipo, quantidade, data, criado_em")
      .order("data")
      .order("criado_em"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const porItem = new Map<string, MovimentoEstoque[]>();
  for (const m of (movs ?? []) as MovimentoEstoque[]) {
    const lista = porItem.get(m.item_id) ?? [];
    lista.push({ ...m, quantidade: Number(m.quantidade) });
    porItem.set(m.item_id, lista);
  }

  return ((itens ?? []) as ItemEstoque[]).map((i) => {
    const consumo = Number(i.consumo_diario);
    const movimentos = porItem.get(i.id) ?? [];
    const paraCalculo = movimentos.map((m) => ({
      tipo: m.tipo,
      quantidade: m.quantidade,
      data: m.data,
      criadoEm: m.criado_em,
    }));
    return {
      ...i,
      consumo_diario: consumo,
      estimativa: estimarEstoque(paraCalculo, consumo, hoje, i.alerta_dias),
      consumoObservado: consumoObservado(paraCalculo),
      movimentos,
    };
  });
}
