// Tipos das linhas do banco, escritos à mão para o MVP.
// Próximo passo: gerar com `supabase gen types typescript` e tipar o cliente.
import type { CategoriaGasto } from "./domain/gastos";
import type { TipoEvento } from "./schemas";

export type Gato = {
  id: string;
  nome: string;
  nascimento: string | null;
  sexo: "macho" | "femea" | null;
  castrado: boolean;
  descricao: string | null;
  microchip: string | null;
  observacoes: string | null;
  ativo: boolean;
};

export type EventoSaude = {
  id: string;
  gato_id: string;
  tipo: TipoEvento;
  data: string;
  titulo: string;
  detalhes: string | null;
  peso_kg: number | null;
  proxima_data: string | null;
  gasto_id: string | null;
  criado_em: string;
};

export type Anexo = {
  id: string;
  gato_id: string;
  evento_id: string | null;
  storage_path: string;
  nome_arquivo: string;
  mime: string;
  tamanho_bytes: number;
  criado_em: string;
};

export type ItemEstoque = {
  id: string;
  nome: string;
  categoria: "racao" | "areia" | "outro";
  unidade: "kg" | "l" | "un";
  consumo_diario: number;
  alerta_dias: number;
  ativo: boolean;
};

export type MovimentoEstoque = {
  id: string;
  item_id: string;
  tipo: "compra" | "contagem";
  quantidade: number;
  data: string;
  criado_em: string;
};

export type Gasto = {
  id: string;
  data: string;
  valor_centavos: number;
  categoria: CategoriaGasto;
  descricao: string | null;
  loja: string | null;
  gato_id: string | null;
};
