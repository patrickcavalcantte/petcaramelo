// Login, Galera compartilhada e documentos no Supabase. Sem URL/chave em config.js, o app segue só com localStorage.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const enabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Laudos, receitas e carteirinhas: bucket privado, uma pasta por Galera e por gato (ver supabase/storage.sql).
const BUCKET = "documentos";

let client = null;
let user = null;
let galeraId = null; // a Galera desta conta (cada conta participa de uma só)
let versao = 0; // versão do estado que baixamos por último: a gravação só vale se ninguém gravou depois
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
export const galera = () => galeraId;

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
  galeraId = null;
  versao = 0;
}

// ---------- Galera: o estado compartilhado ----------

/** Descobre a Galera da conta; na primeira vez cria uma, já com o estado que a pessoa tinha no aparelho. */
export async function garantirGalera(estadoLocal) {
  if (galeraId) return galeraId;
  const c = await getClient();
  const { data, error } = await c.rpc("obter_ou_criar_galera", { p_state: estadoLocal });
  if (error) throw error;
  galeraId = data;
  return galeraId;
}

/** Baixa o estado da Galera e guarda a versão dele. Devolve null se ainda não há. */
export async function pull() {
  const c = await getClient();
  const { data, error } = await c.from("galera_estado").select("state, versao").eq("galera_id", galeraId).maybeSingle();
  if (error) throw error;
  versao = data?.versao ?? 0;
  return data?.state ?? null;
}

/** Grava sobre a versão que baixamos. Devolve false se outra pessoa gravou antes (o app junta e tenta de novo). */
export async function push(estado) {
  const c = await getClient();
  const { data, error } = await c.rpc("salvar_estado", { p_galera: galeraId, p_state: estado, p_versao: versao });
  if (error) throw error;
  if (data === null) return false;
  versao = data;
  return true;
}

/** Roda `fn` depois de 1 s sem novas alterações, para não sincronizar a cada toque. */
export function agendar(fn) {
  if (!user) return;
  clearTimeout(timer);
  timer = setTimeout(fn, 1000);
}

// ---------- Galera: pessoas e convites ----------

/** [{ user_id, email, sou_eu }] */
export async function membros() {
  const c = await getClient();
  const { data, error } = await c.rpc("membros_da_galera", { p_galera: galeraId });
  if (error) throw error;
  return data ?? [];
}

/** Gera um código de uso único, válido por 7 dias. */
export async function criarConvite() {
  const c = await getClient();
  const { data, error } = await c.rpc("criar_convite", { p_galera: galeraId });
  if (error) throw error;
  return data;
}

/** Entra na Galera do convite. A Galera desta conta passa a ser a dele, então esquecemos a atual. */
export async function aceitarConvite(codigo) {
  const c = await getClient();
  const { data, error } = await c.rpc("aceitar_convite", { p_codigo: codigo });
  if (error) throw error;
  galeraId = data;
  versao = 0;
  return galeraId;
}

export async function sairDaGalera() {
  const c = await getClient();
  const { error } = await c.rpc("sair_da_galera");
  if (error) throw error;
  galeraId = null;
  versao = 0;
}

// ---------- Documentos ----------

/** Envia o arquivo direto do navegador para o Storage. Devolve o caminho. */
export async function uploadDocument(gatoId, file, mime, ext) {
  const c = await getClient();
  const path = `${galeraId}/${gatoId}/${crypto.randomUUID()}.${ext || "bin"}`;
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
 * Apaga a conta (pela função delete_my_account, supabase/excluir-conta.sql: sai da Galera e remove o usuário).
 * `paths` são os arquivos a apagar antes: só passe quando a pessoa é a única da Galera, senão os documentos
 * são dos outros também.
 */
export async function deleteAccount(paths = []) {
  await removeDocuments(paths);
  const c = await getClient();
  clearTimeout(timer);
  const { error } = await c.rpc("delete_my_account");
  if (error) throw error;
  await c.auth.signOut().catch(() => {});
  user = null;
  galeraId = null;
  versao = 0;
}
