function obrigatoria(nome: string, valor: string | undefined): string {
  if (!valor) {
    throw new Error(`Variável de ambiente ${nome} não configurada. Veja .env.example.`);
  }
  return valor;
}

// Acesso literal (process.env.X) para o Next conseguir embutir no bundle do navegador.
export const SUPABASE_URL = obrigatoria("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
export const SUPABASE_KEY = obrigatoria(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export const BUCKET_DOCUMENTOS = "documentos";
