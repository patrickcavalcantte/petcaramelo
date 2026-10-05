"use server";
import { redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/server";
import { voltarComErro } from "@/lib/navegacao";

export async function entrar(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  if (!email || !senha) voltarComErro("/login", "Informe e-mail e senha");

  const supabase = await clienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  // Mensagem genérica de propósito: não revela se o e-mail existe.
  if (error) voltarComErro("/login", "E-mail ou senha incorretos");
  redirect("/");
}

export async function sair() {
  const supabase = await clienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
