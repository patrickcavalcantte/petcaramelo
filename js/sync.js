// Sincronização com o Supabase. Sem URL/chave em config.js, o app segue só com localStorage.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const enabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Laudos, receitas e carteirinhas: bucket privado, uma pasta por usuário e por gato (ver supabase/storage.sql).
const BUCKET = "documentos";

let client = null;
let user = null;
let timer = null;

// O link de recuperação de senha volta para o app com type=recovery na URL.
let recovering = /type=recovery/.test(window.location.hash + window.location.search);
export const isRecovery = () => recovering;
export const linkExpired = () => /error_code=otp_expired|error=access_denied/.test(window.location.hash);

async function getClient() {
  if (!client) {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    client.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") recovering = true; });
  }
  return client;
}

export const email = () => user?.email ?? null;
export const userId = () => user?.id ?? null;
export const signedIn = () => user !== null;

/** Restaura a sessão salva neste aparelho. Devolve o usuário ou null. */
export async function start() {
  const c = await getClient();
  const { data } = await c.auth.getSession();
  user = data.session?.user ?? null;
  return user;
}

export async function signIn(emailAddr, password) {
  const c = await getClient();
  const { data, error } = await c.auth.signInWithPassword({ email: emailAddr, password });
  if (error) throw error;
  user = data.user;
}

/** Devolve true se o Supabase pediu confirmação por e-mail antes do primeiro login. */
export async function signUp(emailAddr, password) {
  const c = await getClient();
  const { data, error } = await c.auth.signUp({
    email: emailAddr,
    password,
    options: { emailRedirectTo: window.location.origin + window.location.pathname },
  });
  if (error) throw error;
  user = data.session?.user ?? null;
  return data.session === null;
}

/** Envia o link para criar nova senha. Não revela se o e-mail tem conta. */
export async function resetPassword(emailAddr) {
  const c = await getClient();
  const { error } = await c.auth.resetPasswordForEmail(emailAddr, { redirectTo: window.location.origin + window.location.pathname });
  if (error) throw error;
}

/** Define a nova senha da sessão aberta pelo link de recuperação. */
export async function updatePassword(password) {
  const c = await getClient();
  const { error } = await c.auth.updateUser({ password });
  if (error) throw error;
  recovering = false;
  window.history.replaceState(null, "", window.location.pathname);
}

export async function signOut() {
  clearTimeout(timer);
  const c = await getClient();
  await c.auth.signOut();
  user = null;
}

export async function pull() {
  const c = await getClient();
  const { data, error } = await c.from("app_state").select("state").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  return data?.state ?? null;
}

export async function push(state) {
  const c = await getClient();
  const { error } = await c.from("app_state").upsert({ user_id: user.id, state, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** Envia depois de 1 s sem novas alterações, para não gravar a cada toque. */
export function schedulePush(state, onError, onDone = () => {}) {
  if (!user) return;
  clearTimeout(timer);
  timer = setTimeout(() => push(state).then(onDone, onError), 1000);
}

// ---------- Documentos ----------

/** Envia o arquivo direto do navegador para o Storage. Devolve o caminho. */
export async function uploadDocument(gatoId, file, mime, ext) {
  const c = await getClient();
  const path = `${user.id}/${gatoId}/${crypto.randomUUID()}.${ext || "bin"}`;
  const { error } = await c.storage.from(BUCKET).upload(path, file, { contentType: mime, upsert: false });
  if (error) throw error;
  return path;
}

/** Link temporário (1 hora) para abrir um documento. */
export async function documentUrl(path) {
  const c = await getClient();
  const { data, error } = await c.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function removeDocuments(paths) {
  if (!paths.length) return;
  const c = await getClient();
  const { error } = await c.storage.from(BUCKET).remove(paths);
  if (error) throw error;
}

/**
 * Apaga a conta e tudo dela: os arquivos no Storage (o banco não apaga arquivos em cascata) e,
 * pela função delete_my_account (supabase/excluir-conta.sql), o usuário e a linha de app_state.
 */
export async function deleteAccount(paths = []) {
  await removeDocuments(paths);
  const c = await getClient();
  clearTimeout(timer);
  const { error } = await c.rpc("delete_my_account");
  if (error) throw error;
  await c.auth.signOut().catch(() => {});
  user = null;
}
