// Interface e eventos. As regras ficam em logic.js e domain/, as telas em views.js, a nuvem em sync.js.
import * as sync from "./sync.js";
import { watchForUpdates } from "./update.js";
import { hojeISO } from "./domain/datas.js";
import {
  emptyState, hasUserData, createStore, mergeStates, gatosAtivos, todosGatos, anexosVivos,
  addGatos, updateGato, setGatoAtivo, deleteGato, registrarEventos, deleteEvento, addAnexo, deleteAnexo,
  comprarItem, abrirPacote, arquivarItem, registrarContagem, deleteMovimento, criarGasto, deleteGasto,
} from "./logic.js";
import {
  validarGato, validarEvento, validarCompra, validarAbertura, validarContagem, validarGasto,
  validarArquivo, validarCadastro,
} from "./validate.js";
import {
  viewLogin, viewCadastro, viewEsqueci, viewNovaSenha, shell, viewPainel, viewGatos, viewGato,
  viewCuidado, viewEstoque, viewGastos, viewConta,
} from "./views.js";

const root = document.getElementById("root");
const OWNER_KEY = "pet-caramelo:dono"; // de quem são os dados deste aparelho
const LOCAL_KEY = "pet-caramelo:sem-conta"; // escolheu usar sem conta

const safeStorage = () => { try { return window.localStorage; } catch { return null; } };
const store = createStore(safeStorage());
let state = store.load();
let flash = null; // { tipo: "ok" | "erro", msg }, mostrado uma vez na próxima tela
let localMode = (() => { try { return localStorage.getItem(LOCAL_KEY) === "1"; } catch { return false; } })();
let offlineBoot = false; // não deu para carregar o Supabase: segue só com o aparelho
let syncText = "";

// ---------- Estado e sincronização ----------

function setSync(texto) {
  syncText = texto;
  const el = document.getElementById("estado-sync");
  if (el) el.textContent = texto;
}

const textoSyncOcioso = () => (sync.signedIn() ? "Sincronizado com a sua conta" : "Só neste aparelho");

/** Guarda no aparelho e agenda o envio para a conta. */
function commit(next, redraw = true) {
  state = { ...next, savedAt: new Date().toISOString() };
  if (!store.save(state)) console.warn("Não foi possível salvar. O que você registrar fica só nesta aba.");
  if (sync.signedIn()) setSync("Sincronizando…");
  sync.schedulePush(
    state,
    (err) => { console.warn("Não foi possível sincronizar agora.", err); setSync("Não consegui sincronizar. Tento de novo na próxima alteração."); },
    () => setSync(textoSyncOcioso()),
  );
  if (redraw) render();
}

/**
 * De quem são os dados deste aparelho? Uma marca guarda a conta dona. Se for outra, descartamos.
 * Sem marca (uso anterior ao login) e num login explícito, perguntamos antes de juntar com a conta.
 */
function settleLocalOwnership(askAdopt) {
  const id = sync.userId();
  if (!id) return;
  try {
    const owner = localStorage.getItem(OWNER_KEY);
    if (owner && owner !== id) {
      state = emptyState();
      store.save(state);
    } else if (!owner && askAdopt && hasUserData(state)) {
      const join = confirm(
        `Este aparelho já tem dados salvos de antes do login.\n\nOK: juntar esses dados com a conta ${sync.email()}.\nCancelar: começar esta conta do zero (os dados deste aparelho serão apagados daqui).`,
      );
      if (!join) {
        state = emptyState();
        store.save(state);
      }
    }
    localStorage.setItem(OWNER_KEY, id);
  } catch { /* sem storage: segue sem a marca */ }
}

/** Junta o que está neste aparelho com o que está na conta e grava o resultado nos dois lados. Devolve true se mudou algo aqui. */
async function reconcile(askAdopt = false) {
  try {
    settleLocalOwnership(askAdopt);
    const remote = await sync.pull();
    const merged = mergeStates(state, remote);
    const changedHere = JSON.stringify(merged) !== JSON.stringify(state);
    state = merged;
    if (changedHere) store.save(state);
    if (!remote || JSON.stringify(merged) !== JSON.stringify(remote)) await sync.push(state);
    setSync(textoSyncOcioso());
    return changedHere;
  } catch (err) {
    console.warn("Não foi possível sincronizar agora. O app segue com os dados deste aparelho.", err);
    setSync("Sem sincronização agora. O app segue com os dados deste aparelho.");
    return false;
  }
}

function limparAparelho() {
  state = emptyState();
  store.save(state);
  try { localStorage.removeItem(OWNER_KEY); } catch { /* ignorado */ }
}

// ---------- Rotas e desenho ----------

function rota() {
  const [caminho, consulta = ""] = (location.hash.replace(/^#/, "") || "/").split("?");
  return { partes: caminho.split("/").filter(Boolean), params: new URLSearchParams(consulta) };
}

const ROTAS_ENTRADA = new Set(["entrar", "cadastro", "esqueci"]);
const podeUsarApp = () => sync.signedIn() || localMode || !sync.enabled || offlineBoot;

function render() {
  document.body.classList.remove("menu-aberto");
  const f = flash;
  flash = null;
  const { partes, params } = rota();
  const p0 = partes[0] ?? "";
  const hoje = hojeISO();

  if (sync.enabled && !offlineBoot && sync.isRecovery()) {
    root.innerHTML = viewNovaSenha({ flash: f });
    return;
  }
  if (ROTAS_ENTRADA.has(p0) || !podeUsarApp()) {
    if (sync.signedIn()) { location.hash = "#/"; return; }
    const tela = p0 === "cadastro" ? viewCadastro({ flash: f }) : p0 === "esqueci" ? viewEsqueci({ flash: f }) : viewLogin({ flash: f });
    root.innerHTML = tela;
    return;
  }

  const sessao = { signedIn: sync.signedIn(), email: sync.email(), estadoSync: syncText || textoSyncOcioso() };
  const podeAnexar = sync.signedIn();
  let nome = p0;
  let html;
  switch (p0) {
    case "gatos":
      html = partes[1] ? viewGato(state, partes[1], hoje, f, { podeAnexar }) : viewGatos(state, hoje, f);
      break;
    case "cuidado": html = viewCuidado(state, hoje, f); break;
    case "estoque": html = viewEstoque(state, hoje, f); break;
    case "gastos": html = viewGastos(state, hoje, params.get("mes"), f); break;
    case "conta": html = viewConta(sessao, f); break;
    default: nome = ""; html = viewPainel(state, hoje, f);
  }
  root.innerHTML = shell(nome, html, sessao);
  resolverDocumentos();
}

/** Os documentos ficam num bucket privado: cada link é assinado na hora, vale 1 hora. */
function resolverDocumentos() {
  for (const a of root.querySelectorAll("a[data-doc]")) {
    sync.documentUrl(a.dataset.doc).then((url) => { a.href = url; }).catch(() => { a.title = "Não consegui abrir agora"; });
  }
}

const emFoco = () => { const a = document.activeElement; return a && root.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName); };

// ---------- Formulários ----------

function formObj(form) {
  const o = {};
  for (const [k, v] of new FormData(form).entries()) if (typeof v === "string" && !(k in o)) o[k] = v;
  return o;
}

function mostrarErro(onde, msg) {
  const el = onde.querySelector?.("[data-erro]");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  el.scrollIntoView?.({ block: "nearest" });
}

const pronto = (msg) => { flash = { tipo: "ok", msg }; };
const agora = () => new Date();

/** Cada ação recebe o formulário e os campos. Erro de validação aparece no próprio formulário, sem redesenhar a tela. */
const ACOES = {
  async login(form, f) {
    const email = (f.email ?? "").trim();
    if (!email || !f.senha) return mostrarErro(form, "Informe e-mail e senha");
    try {
      await sync.signIn(email, f.senha);
    } catch {
      // Mensagem genérica de propósito: não revela se o e-mail existe.
      return mostrarErro(form, "E-mail ou senha incorretos");
    }
    await entrouNaConta();
  },

  async cadastro(form, f) {
    const r = validarCadastro(f);
    if (r.erro) return mostrarErro(form, r.erro);
    let precisaConfirmar;
    try {
      precisaConfirmar = await sync.signUp(r.valor.email, r.valor.senha);
    } catch (err) {
      console.error("Erro no cadastro:", err);
      return mostrarErro(form, "Não foi possível criar a conta. Tente de novo.");
    }
    if (!precisaConfirmar) return entrouNaConta();
    // Mesma resposta para e-mail novo ou já cadastrado: não revela quem tem conta.
    pronto("Enviamos um link de confirmação para o seu e-mail. Ative a conta e depois entre.");
    irPara("#/entrar");
  },

  async esqueci(form, f) {
    const email = (f.email ?? "").trim();
    if (!email) return mostrarErro(form, "Informe o e-mail");
    await sync.resetPassword(email).catch((err) => console.warn("Recuperação de senha:", err));
    pronto("Se esse e-mail tem conta, enviamos um link para criar uma nova senha.");
    irPara("#/entrar");
  },

  async "nova-senha"(form, f) {
    const r = validarCadastro({ email: "a@a.aa", senha: f.senha, confirmacao: f.confirmacao });
    if (r.erro) return mostrarErro(form, r.erro);
    try {
      await sync.updatePassword(f.senha);
    } catch {
      return mostrarErro(form, "Não foi possível salvar a senha. Peça um novo link.");
    }
    pronto("Senha atualizada.");
    await entrouNaConta();
  },

  "gatos-lote"(form, f) {
    const r = addGatos(state, f.nomes ?? "", agora());
    if (r.novos.length === 0) {
      const motivo = r.invalidos.length ? "Nome muito longo (máximo de 60 caracteres)." : r.ignorados.length ? "Esses nomes já estão cadastrados." : "Informe pelo menos um nome.";
      return mostrarErro(form, motivo);
    }
    const extra = r.ignorados.length ? ` (${r.ignorados.length} repetido${r.ignorados.length > 1 ? "s" : ""} ignorado${r.ignorados.length > 1 ? "s" : ""})` : "";
    pronto(`${r.novos.length === 1 ? "1 gato adicionado" : `${r.novos.length} gatos adicionados`}${extra}`);
    commit(r.state);
  },

  "gato-editar"(form, f) {
    const r = validarGato(f, hojeISO());
    if (r.erro) return mostrarErro(form, r.erro);
    pronto("Dados salvos");
    commit(updateGato(state, f.id, r.valor, agora()));
  },

  async "gato-apagar"(form, f) {
    const gato = todosGatos(state).find((g) => g.id === f.id);
    if (!gato) return mostrarErro(form, "Gato não encontrado");
    if ((f.confirmacao ?? "").trim().toLowerCase() !== gato.nome.trim().toLowerCase()) return mostrarErro(form, `Digite ${gato.nome} para confirmar`);
    const { state: novo, paths } = deleteGato(state, f.id, agora());
    if (!(await apagarArquivos(paths, form))) return;
    commit(novo, false);
    pronto(`${gato.nome} foi apagado`);
    irPara("#/gatos");
  },

  evento(form, f) {
    const todos = form.elements.todos?.checked;
    const gatoIds = todos
      ? gatosAtivos(state).map((g) => g.id)
      : [...form.querySelectorAll("input[name=gatoIds]")].filter((i) => i.type === "hidden" || i.checked).map((i) => i.value);
    const r = validarEvento({ ...f, gatoIds }, hojeISO());
    if (r.erro) return mostrarErro(form, r.erro);
    pronto(gatoIds.length === 1 ? "Registrado" : `Registrado para ${gatoIds.length} gatos`);
    commit(registrarEventos(state, r.valor, agora()));
  },

  async "anexo-enviar"(form, f) {
    const arquivos = [...(form.elements.arquivo?.files ?? [])];
    if (arquivos.length === 0) return mostrarErro(form, "Escolha um arquivo");
    const botao = form.querySelector("button[type=submit]");
    botao.disabled = true;
    botao.textContent = "Enviando…";
    let enviados = 0;
    try {
      for (const arquivo of arquivos) {
        const v = validarArquivo(arquivo);
        if (v.erro) { mostrarErro(form, v.erro); break; }
        const caminho = await sync.uploadDocument(f.gatoId, arquivo, v.valor.mime, v.valor.ext);
        state = addAnexo(state, {
          gatoId: f.gatoId, eventoId: f.eventoId || null, storagePath: caminho,
          nomeArquivo: arquivo.name, mime: v.valor.mime, tamanhoBytes: arquivo.size,
        }, agora());
        commit(state, false);
        enviados += 1;
      }
    } catch (err) {
      console.warn("Falha ao enviar documento.", err);
      mostrarErro(form, "Falha ao enviar o arquivo. Tente de novo.");
    }
    if (enviados > 0) {
      pronto(enviados === 1 ? "Documento guardado" : "Documentos guardados");
      render();
    } else {
      botao.disabled = false;
      botao.textContent = "Guardar documento";
    }
  },

  compra(form, f) {
    const r = validarCompra(f, hojeISO());
    if (r.erro) return mostrarErro(form, r.erro);
    pronto(r.valor.valorCentavos ? "Compra registrada e lançada nos gastos. Quando acabar, toque em Acabou." : "Compra registrada. Quando acabar, toque em Acabou.");
    commit(comprarItem(state, r.valor, agora()));
  },

  contagem(form, f) {
    const r = validarContagem(f, hojeISO());
    if (r.erro) return mostrarErro(form, r.erro);
    pronto("Contagem registrada");
    commit(registrarContagem(state, r.valor, agora()));
  },

  abertura(form, f) {
    const r = validarAbertura(f, hojeISO());
    if (r.erro) return mostrarErro(form, r.erro);
    pronto("Pacote aberto registrado. Quando acabar, toque em Acabou.");
    commit(abrirPacote(state, r.valor, agora()));
  },

  /** "Acabou" é uma contagem com zero: fecha o período e alimenta a média real. */
  acabou(form, f) {
    const r = validarContagem({ ...f, quantidade: "0" }, hojeISO());
    if (r.erro) return mostrarErro(form, r.erro);
    pronto("Registrado. A média de consumo foi atualizada.");
    commit(registrarContagem(state, r.valor, agora()));
  },

  "gasto-novo"(form, f) {
    const r = validarGasto(f, hojeISO());
    if (r.erro) return mostrarErro(form, r.erro);
    pronto("Gasto lançado");
    commit(criarGasto(state, r.valor, agora()));
  },
};

root.addEventListener("submit", async (e) => {
  const form = e.target.closest("form[data-acao]");
  if (!form) return;
  e.preventDefault();
  const acao = ACOES[form.dataset.acao];
  if (!acao) return;
  for (const el of form.querySelectorAll("[data-erro]")) el.hidden = true;
  try {
    await acao(form, formObj(form));
  } catch (err) {
    console.error(err);
    mostrarErro(form, "Algo deu errado. Tente de novo.");
  }
});

root.addEventListener("change", (e) => {
  // "Todos os gatos ativos" marca e desmarca a lista inteira.
  if (e.target.matches?.("[data-todos]")) {
    for (const c of e.target.form.querySelectorAll("input[name=gatoIds]")) c.checked = e.target.checked;
  }
});

// ---------- Botões de ação ----------

/** Apaga arquivos do Storage antes de mexer no estado: se falhar, nada muda. */
async function apagarArquivos(paths, onde) {
  if (paths.length === 0) return true;
  try {
    await sync.removeDocuments(paths);
    return true;
  } catch (err) {
    console.warn("Não foi possível apagar os documentos.", err);
    mostrarErro(onde, "Não consegui apagar os documentos. Nada foi removido.");
    return false;
  }
}

function irPara(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

/** Depois de entrar (ou criar a conta sem confirmação): junta os dados e abre o painel. */
async function entrouNaConta() {
  localMode = false;
  try { localStorage.removeItem(LOCAL_KEY); } catch { /* ignorado */ }
  await reconcile(true);
  irPara("#/");
}

async function sair() {
  try { await sync.push(state); } catch { /* sem rede: o que não subiu fica só neste aparelho */ }
  await sync.signOut().catch(() => {});
  limparAparelho();
  localMode = false;
  try { localStorage.removeItem(LOCAL_KEY); } catch { /* ignorado */ }
  irPara("#/entrar");
}

async function excluirConta(botao) {
  const onde = botao.closest("section");
  if (!confirm("Excluir sua conta e todos os seus dados (gatos, histórico, estoque, gastos e documentos)?\n\nIsso não pode ser desfeito.")) return;
  botao.disabled = true;
  try {
    await sync.deleteAccount(anexosVivos(state).map((a) => a.storagePath));
  } catch (err) {
    console.warn("Não foi possível excluir a conta agora.", err);
    botao.disabled = false;
    return mostrarErro(onde, "Não foi possível excluir agora. Tente de novo em instantes.");
  }
  limparAparelho();
  pronto("Conta excluída. Seus dados foram apagados.");
  irPara("#/entrar");
}

/** Gaveta de navegação do celular. */
function abrirMenu(aberto) {
  const topo = root.querySelector(".topo");
  const botao = topo?.querySelector(".menu-botao");
  if (!botao) return;
  botao.setAttribute("aria-expanded", String(aberto));
  botao.setAttribute("aria-label", aberto ? "Fechar menu" : "Abrir menu");
  topo.toggleAttribute("data-aberto", aberto);
  root.querySelector(".menu-fundo").hidden = !aberto;
  document.body.classList.toggle("menu-aberto", aberto);
}

const menuAberto = () => root.querySelector(".menu-botao")?.getAttribute("aria-expanded") === "true";

const CLIQUES = {
  menu: () => abrirMenu(!menuAberto()),
  "menu-fechar": () => abrirMenu(false),
  "modo-local"() {
    localMode = true;
    try { localStorage.setItem(LOCAL_KEY, "1"); } catch { /* vale só nesta sessão */ }
    irPara("#/");
  },
  sair: () => sair(),
  "excluir-conta": (el) => excluirConta(el),

  "gato-ativo"(el) {
    const ativo = el.dataset.ativo === "1";
    pronto(ativo ? "Gato reativado" : "Gato arquivado");
    commit(setGatoAtivo(state, el.dataset.id, ativo, agora()));
  },

  async "evento-apagar"(el) {
    if (!confirm("Apagar este registro?")) return;
    const { state: novo, paths } = deleteEvento(state, el.dataset.id, agora());
    if (!(await apagarArquivos(paths, el.closest("li")))) return;
    pronto("Registro apagado");
    commit(novo);
  },

  async "anexo-apagar"(el) {
    if (!confirm("Apagar este documento?")) return;
    const anexo = anexosVivos(state).find((a) => a.id === el.dataset.id);
    if (!anexo) return;
    if (!(await apagarArquivos([anexo.storagePath], el.closest("section, li")))) return;
    pronto("Documento apagado");
    commit(deleteAnexo(state, anexo.id, agora()));
  },

  /** Atalho do cartão do item: leva o nome para o formulário de compra. */
  "comprar-de-novo"(el) {
    const form = root.querySelector("form[data-acao=compra]");
    if (!form) return;
    form.elements.nome.value = el.dataset.nome;
    form.elements.unidade.value = el.dataset.unidade;
    form.scrollIntoView({ block: "center" });
    form.elements.quantidade.focus();
  },

  "item-arquivar"(el) {
    pronto("Item arquivado");
    commit(arquivarItem(state, el.dataset.id, agora()));
  },

  "mov-apagar"(el) {
    pronto("Movimento apagado. Se havia gasto, ele continua em Gastos.");
    commit(deleteMovimento(state, el.dataset.id, agora()));
  },

  "gasto-apagar"(el) {
    if (!confirm("Apagar este gasto?")) return;
    pronto("Gasto apagado");
    commit(deleteGasto(state, el.dataset.id, agora()));
  },
};

root.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-click]");
  if (!el) return;
  const acao = CLIQUES[el.dataset.click];
  if (!acao) return;
  try {
    await acao(el);
  } catch (err) {
    console.error(err);
  }
});

root.addEventListener("click", (e) => {
  if (e.target.closest(".menu a, .menu button")) abrirMenu(false);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && menuAberto()) {
    abrirMenu(false);
    root.querySelector(".menu-botao")?.focus();
  }
});

// Girar o celular ou abrir numa tela larga: a gaveta não faz sentido lá.
matchMedia("(min-width: 721px)").addEventListener("change", (e) => { if (e.matches) abrirMenu(false); });

// ---------- Início ----------

addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });

// Ao voltar para a aba, puxa o que mudou em outro aparelho. Não redesenha enquanto a pessoa digita.
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible" || !sync.signedIn()) return;
  if (await reconcile(false) && !emFoco()) render();
});

async function boot() {
  watchForUpdates();
  if (sync.enabled) {
    try {
      await sync.start();
    } catch (err) {
      console.warn("Não foi possível carregar o Supabase. O app segue só com este aparelho.", err);
      offlineBoot = true;
    }
  }
  if (sync.signedIn()) await reconcile(false);
  if (sync.enabled && !offlineBoot && sync.linkExpired()) {
    flash = { tipo: "erro", msg: "Esse link expirou. Peça um novo em “Esqueci a senha”." };
  }
  syncText = textoSyncOcioso();
  render();
}

boot();
