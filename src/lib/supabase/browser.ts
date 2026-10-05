"use client";
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL } from "../env";

let cliente: ReturnType<typeof createBrowserClient> | undefined;

export function clienteNavegador() {
  cliente ??= createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
  return cliente;
}
