// Telas: funções puras que devolvem HTML. Sem DOM, sem estado global; o app.js decide quando e onde desenhar.
// Todo texto que vem do usuário passa por esc().
import { esc } from "./dom.js";
import { formatarData, idade, deslocarMes, nomeDoMes, diasEntre, somarDias } from "./domain/datas.js";
import { formatarReais } from "./domain/dinheiro.js";
import { CATEGORIAS_GASTO, resumirGastos } from "./domain/gastos.js";
import { calcularVencimentos } from "./domain/vencimentos.js";
import { formatarConsumo, formatarPeso, formatarQuantidade, textoPrazo } from "./domain/formato.js";
import { TIPOS_EVENTO } from "./validate.js";
import { PASSOS, ehUltimo } from "./tour.js";
import {
  gatosAtivos, todosGatos, eventosDoGato, ultimoPeso, titulosUsados, eventosParaVencimento,
  anexosVivos, estoqueDe, gastosDoMes, gastosVivos,
} from "./logic.js";

export const PATA = `<svg class="marca-pata" viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="66" rx="22" ry="18"/><ellipse cx="22" cy="42" rx="9" ry="12" transform="rotate(-20 22 42)"/><ellipse cx="40" cy="26" rx="9" ry="13" transform="rotate(-6 40 26)"/><ellipse cx="60" cy="26" rx="9" ry="13" transform="rotate(6 60 26)"/><ellipse cx="78" cy="42" rx="9" ry="12" transform="rotate(20 78 42)"/></svg>`;

const inicial = (nome) => esc(nome.trim().charAt(0).toUpperCase());
const aviso = (flash) => (flash ? `<p class="aviso ${flash.tipo === "erro" ? "aviso-erro" : "aviso-ok"}" role="${flash.tipo === "erro" ? "alert" : "status"}">${esc(flash.msg)}</p>` : "");
const slotErro = `<p class="aviso aviso-erro" role="alert" data-erro hidden></p>`;
const sexoTxt = (g) => (g.sexo === "macho" ? "macho" : g.sexo === "femea" ? "fêmea" : "");

// ---------- Entrada ----------

const marcaGrande = `<h1 class="marca-grande">${PATA}Pet Caramelo</h1>`;

export function viewLogin({ flash, email = "", podeLocal = true } = {}) {
  return `<main class="login">
    ${marcaGrande}
    <p class="suave">Saúde, estoque e gastos da Galera.</p>
    ${aviso(flash)}
    <form data-acao="login" class="form">
      <label>E-mail <input type="email" name="email" autocomplete="email" value="${esc(email)}" required></label>
      <label>Senha <input type="password" name="senha" autocomplete="current-password" required></label>
      ${slotErro}
      <button class="botao" type="submit">Entrar</button>
    </form>
    <p class="suave">Não tem conta? <a href="#/cadastro">Criar conta</a> · <a href="#/esqueci">Esqueci a senha</a></p>
    ${podeLocal ? `<p class="suave modo-local">Prefere só testar? <button class="link-botao" type="button" data-click="modo-local">Usar sem conta</button>. Os dados ficam só neste aparelho.</p>` : ""}
  </main>`;
}

export function viewCadastro({ flash } = {}) {
  return `<main class="login">
    ${marcaGrande}
    <p class="suave">Crie sua conta. Você vai receber um e-mail para ativá-la.</p>
    ${aviso(flash)}
    <form data-acao="cadastro" class="form">
      <label>E-mail <input type="email" name="email" autocomplete="email" required></label>
      <label>Senha <input type="password" name="senha" autocomplete="new-password" minlength="8" required></label>
      <label>Confirmar senha <input type="password" name="confirmacao" autocomplete="new-password" minlength="8" required></label>
      ${slotErro}
      <button class="botao" type="submit">Criar conta</button>
    </form>
    <p class="suave">Já tem conta? <a href="#/entrar">Entrar</a></p>
  </main>`;
}

export function viewEsqueci({ flash } = {}) {
  return `<main class="login">
    ${marcaGrande}
    <p class="suave">Informe o e-mail da conta. Se ele existir, enviamos um link para criar uma nova senha.</p>
    ${aviso(flash)}
    <form data-acao="esqueci" class="form">
      <label>E-mail <input type="email" name="email" autocomplete="email" required></label>
      ${slotErro}
      <button class="botao" type="submit">Enviar link</button>
    </form>
    <p class="suave"><a href="#/entrar">Voltar para entrar</a></p>
  </main>`;
}

export function viewNovaSenha({ flash } = {}) {
  return `<main class="login">
    ${marcaGrande}
    <p class="suave">Escolha a nova senha.</p>
    ${aviso(flash)}
    <form data-acao="nova-senha" class="form">
      <label>Nova senha <input type="password" name="senha" autocomplete="new-password" minlength="8" required></label>
      <label>Confirmar senha <input type="password" name="confirmacao" autocomplete="new-password" minlength="8" required></label>
      ${slotErro}
      <button class="botao" type="submit">Salvar senha</button>
    </form>
  </main>`;
}

// ---------- Estrutura do app ----------

const NAV = [
  ["#/gatos", "gatos", "Gatos"],
  ["#/cuidado", "cuidado", "Registrar cuidado"],
  ["#/estoque", "estoque", "Estoque"],
  ["#/gastos", "gastos", "Gastos"],
];

const ICONE_MENU = `<svg class="icone-menu" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path class="m-linha-1" d="M4 7h16"/><path class="m-linha-2" d="M4 12h16"/><path class="m-linha-3" d="M4 17h16"/></svg>`;

export function shell(rota, conteudo, { signedIn, email, estadoSync = "" }) {
  const links = NAV.map(([href, nome, rotulo]) => `<a href="${href}"${rota === nome ? ' aria-current="page"' : ""}>${rotulo}</a>`).join("");
  const conta = `<a href="#/conta"${rota === "conta" ? ' aria-current="page"' : ""}>Conta</a>`;
  const sessao = signedIn
    ? `<button type="button" class="link-botao claro" data-click="sair">Sair</button>`
    : `<a class="link-botao claro" href="#/entrar">Entrar</a>`;
  // No celular a navegação vira uma gaveta aberta pelo botão; no computador ela fica à vista no cabeçalho.
  return `<header class="topo">
      <a href="#/" class="marca">${PATA}Pet Caramelo</a>
      <button type="button" class="menu-botao" data-click="menu" aria-expanded="false" aria-controls="menu-principal" aria-label="Abrir menu">${ICONE_MENU}</button>
      <nav id="menu-principal" class="menu" aria-label="Principal">
        <a class="so-menu" href="#/"${rota === "" ? ' aria-current="page"' : ""}>Início</a>
        ${links}${conta}
        <span class="menu-sessao">${sessao}</span>
      </nav>
    </header>
    <div class="menu-fundo" data-click="menu-fechar" hidden></div>
    <main class="conteudo">${conteudo}</main>
    <footer class="rodape-app"><span class="estado-sync" id="estado-sync">${esc(estadoSync)}</span></footer>`;
}

// ---------- Painel ----------

export function viewPainel(state, hoje, flash) {
  const gatos = gatosAtivos(state);
  if (gatos.length === 0) {
    return `<section class="vazio">
      <h1>Comece pelos gatos</h1>
      ${aviso(flash)}
      <p>Cadastre todos de uma vez, um nome por linha. Os detalhes de cada um podem vir depois.</p>
      <a href="#/gatos" class="botao">Cadastrar gatos</a>
    </section>`;
  }
  const nomes = new Map(gatos.map((g) => [g.id, g.nome]));
  const vencimentos = calcularVencimentos(eventosParaVencimento(state), hoje, 30);
  const atrasados = new Set(vencimentos.filter((v) => v.situacao === "atrasado").map((v) => v.gatoId));
  const estoque = estoqueDe(state, hoje);
  const alertas = estoque.filter((i) => i.estimativa.status === "baixo" || i.estimativa.status === "acabou");
  const resumo = resumirGastos(gastosDoMes(state, hoje.slice(0, 7)));

  const pendencias = vencimentos.length === 0
    ? `<p class="suave">Nenhuma vacina, vermífugo ou retorno pendente.</p>`
    : `<ul class="lista-pendencias">${vencimentos.map((v) => `<li data-situacao="${v.situacao}">
        <a href="#/gatos/${esc(v.gatoId)}">${esc(nomes.get(v.gatoId))}</a><span>${esc(v.titulo)}</span><span class="prazo">${textoPrazo(v)}</span></li>`).join("")}</ul>`;

  const blocoEstoque = estoque.length === 0
    ? `<p class="suave"><a href="#/estoque">Registre a compra de ração e areia</a> para saber quanto os gatos consomem.</p>`
    : alertas.length === 0
      ? `<p class="suave">Tudo abastecido.</p>`
      : `<ul class="lista-simples">${alertas.map((i) => `<li data-status="${i.estimativa.status}"><strong>${esc(i.nome)}</strong> ${
          i.estimativa.status === "acabou"
            ? "deve ter acabado"
            : `≈ ${formatarQuantidade(i.estimativa.quantidade ?? 0, i.unidade)}, acaba por volta de ${formatarData(i.estimativa.acabaEm)}`}</li>`).join("")}</ul>`;

  const topCategorias = resumo.porCategoria.slice(0, 3).map((c) => `${CATEGORIAS_GASTO[c.categoria] ?? c.categoria} ${formatarReais(c.totalCentavos)}`).join(", ");

  return `${aviso(flash)}<div class="painel">
    <section aria-labelledby="t-pendencias"><h1 id="t-pendencias">Próximos 30 dias</h1>${pendencias}</section>
    <section aria-labelledby="t-estoque"><h2 id="t-estoque">Estoque</h2>${blocoEstoque}</section>
    <section aria-labelledby="t-gastos"><h2 id="t-gastos">Gastos do mês</h2>
      <p class="numero-grande">${formatarReais(resumo.totalCentavos)}</p>
      ${topCategorias ? `<p class="suave">${esc(topCategorias)}</p>` : ""}
      <a href="#/gastos">Ver gastos</a></section>
    <section aria-labelledby="t-colonia" class="secao-colonia"><h2 id="t-colonia">A Galera</h2>
      <ul class="plaquinhas">${gatos.map((g) => `<li><a href="#/gatos/${esc(g.id)}" class="plaquinha"${atrasados.has(g.id) ? " data-atraso" : ""}>
        <span class="inicial" aria-hidden="true">${inicial(g.nome)}</span><span class="nome">${esc(g.nome)}</span>${atrasados.has(g.id) ? `<span class="sr-only"> (tem pendência atrasada)</span>` : ""}</a></li>`).join("")}</ul>
    </section></div>`;
}

// ---------- Gatos ----------

export function viewGatos(state, hoje, flash) {
  const todos = todosGatos(state);
  const ativos = todos.filter((g) => g.ativo).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const arquivados = todos.filter((g) => !g.ativo).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const tabela = ativos.length === 0 ? "" : `<ul class="tabela-gatos">${ativos.map((g) => {
    const peso = ultimoPeso(state, g.id);
    return `<li><a href="#/gatos/${esc(g.id)}">${esc(g.nome)}</a>
      <span>${g.nascimento ? esc(idade(g.nascimento, hoje) ?? "") : `<span class="suave">idade?</span>`}</span>
      <span>${sexoTxt(g)}${g.castrado ? ", castrado" : ""}</span>
      <span class="num">${peso !== null ? formatarPeso(peso) : ""}</span></li>`;
  }).join("")}</ul>`;

  return `<h1>Gatos ${ativos.length > 0 ? `<span class="contagem">${ativos.length}</span>` : ""}</h1>
    ${aviso(flash)}
    ${tabela}
    <section class="bloco"><h2>Adicionar gatos</h2>
      <form data-acao="gatos-lote" class="form">
        <label>Nomes <textarea name="nomes" rows="6" placeholder="Frajola&#10;Mingau&#10;Pipoca" required></textarea>
          <small>Um por linha. Nomes repetidos são ignorados. Idade, sexo e o resto você completa na página de cada gato.</small></label>
        ${slotErro}
        <button class="botao" type="submit">Adicionar</button>
      </form></section>
    ${arquivados.length > 0 ? `<details class="bloco"><summary>Arquivados (${arquivados.length})</summary>
      <ul class="lista-simples">${arquivados.map((g) => `<li><a href="#/gatos/${esc(g.id)}">${esc(g.nome)}</a></li>`).join("")}</ul></details>` : ""}`;
}

function formEvento({ hoje, titulos, gatoFixo, gatos = [] }) {
  const escolha = gatoFixo
    ? `<input type="hidden" name="gatoIds" value="${esc(gatoFixo.id)}">`
    : `<fieldset class="escolha-gatos"><legend>Para quais gatos</legend>
        <label class="check check-todos"><input type="checkbox" name="todos" data-todos> Todos os gatos ativos</label>
        <div class="grade-checks">${gatos.map((g) => `<label class="check"><input type="checkbox" name="gatoIds" value="${esc(g.id)}"> ${esc(g.nome)}</label>`).join("")}</div></fieldset>`;
  return `<form data-acao="evento" class="form">
    ${escolha}
    <div class="linha-campos">
      <label>Tipo <select name="tipo" required><option value="" disabled selected>Escolha</option>
        ${Object.entries(TIPOS_EVENTO).map(([v, r]) => `<option value="${v}">${r}</option>`).join("")}</select></label>
      <label>Data <input type="date" name="data" value="${hoje}" max="${hoje}" required></label>
    </div>
    <label>Título <input name="titulo" required maxlength="120" list="titulos-usados" placeholder="V5, Drontal, Hemograma, Retorno…">
      <datalist id="titulos-usados">${titulos.map((t) => `<option value="${esc(t)}"></option>`).join("")}</datalist>
      <small>Use sempre o mesmo título para a mesma coisa. É assim que o app sabe que a V5 deste ano substitui a do ano passado.</small></label>
    <div class="linha-campos">
      <label>Próxima dose ou retorno <input type="date" name="proximaData" min="${hoje}"></label>
      ${gatoFixo ? `<label>Peso (kg) <input name="pesoKg" inputmode="decimal" placeholder="4,3"></label>` : ""}
    </div>
    <div class="linha-campos">
      <label>Valor pago <input name="valorCentavos" inputmode="decimal" placeholder="R$ 0,00"></label>
      <label>Onde <input name="loja" maxlength="80" placeholder="Clínica, laboratório, loja"></label>
    </div>
    <label>Observações <textarea name="detalhes" rows="3" maxlength="4000" placeholder="Dose, resultado, o que o veterinário disse"></textarea></label>
    ${slotErro}
    <button type="submit" class="botao">Registrar</button>
  </form>`;
}

/** `podeAnexar`: só com conta (o arquivo vai para o Storage). */
export function viewGato(state, id, hoje, flash, { podeAnexar }) {
  const gato = todosGatos(state).find((g) => g.id === id);
  if (!gato) return `<p class="trilha"><a href="#/gatos">Gatos</a></p><h1>Gato não encontrado</h1><p class="suave">Ele pode ter sido apagado em outro aparelho.</p>`;

  const eventos = eventosDoGato(state, id);
  const anexos = anexosVivos(state).filter((a) => a.gatoId === id).sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  const vencimentos = calcularVencimentos(eventosParaVencimento(state, id), hoje, 60);
  const peso = ultimoPeso(state, id);
  const porEvento = new Map();
  for (const a of anexos) if (a.eventoId) porEvento.set(a.eventoId, [...(porEvento.get(a.eventoId) ?? []), a]);
  const soltos = anexos.filter((a) => !a.eventoId);

  const listaAnexos = (lista) => `<ul class="anexos">${lista.map((a) => `<li>
    <a data-doc="${esc(a.storagePath)}" target="_blank" rel="noopener noreferrer">${esc(a.nomeArquivo)}</a>
    <button type="button" class="link-botao perigo" data-click="anexo-apagar" data-id="${esc(a.id)}" aria-label="Apagar ${esc(a.nomeArquivo)}">apagar</button></li>`).join("")}</ul>`;

  const resumo = [
    gato.nascimento && idade(gato.nascimento, hoje),
    sexoTxt(gato) || null,
    gato.castrado ? "castrado" : null,
    peso !== null ? formatarPeso(peso) : null,
    !gato.ativo ? "arquivado" : null,
  ].filter(Boolean).join(", ") || "Complete os dados abaixo";

  const anexar = podeAnexar
    ? `<form data-acao="anexo-enviar" class="form">
        <input type="hidden" name="gatoId" value="${esc(id)}">
        <label>Arquivo <input type="file" name="arquivo" multiple accept=".pdf,image/jpeg,image/png,image/webp,.heic,.heif">
          <small>PDF ou foto do laudo, receita ou carteirinha. Até 10 MB cada.</small></label>
        ${eventos.length > 0 ? `<label>Ligar a um registro <select name="eventoId"><option value="">Nenhum, guardar solto</option>
          ${eventos.slice(0, 30).map((e) => `<option value="${esc(e.id)}">${esc(formatarData(e.data))} ${esc(e.titulo)}</option>`).join("")}</select></label>` : ""}
        ${slotErro}
        <button type="submit" class="botao">Guardar documento</button>
      </form>`
    : `<p class="suave">Para guardar documentos, <a href="#/entrar">entre na sua conta</a>. Eles ficam num cofre privado, separado do resto dos dados.</p>`;

  return `<p class="trilha"><a href="#/gatos">Gatos</a></p>
    <header class="cabecalho-gato"><span class="inicial-grande" aria-hidden="true">${inicial(gato.nome)}</span>
      <div><h1>${esc(gato.nome)}</h1><p class="suave">${esc(resumo)}</p>${gato.descricao ? `<p>${esc(gato.descricao)}</p>` : ""}</div></header>
    ${aviso(flash)}
    ${vencimentos.length > 0 ? `<section class="bloco"><h2>Pendências</h2><ul class="lista-pendencias">${vencimentos.map((v) => `<li data-situacao="${v.situacao}">
      <span>${esc(v.titulo)}</span><span>${formatarData(v.proximaData)}</span><span class="prazo">${textoPrazo(v)}</span></li>`).join("")}</ul></section>` : ""}
    <section class="bloco"><h2>Histórico</h2>
      ${eventos.length === 0 ? `<p class="suave">Nada registrado ainda. Comece pela última vacina ou pelo peso de hoje.</p>` : `<ol class="linha-do-tempo">${eventos.map((e) => `<li>
        <time datetime="${esc(e.data)}">${formatarData(e.data)}</time>
        <div><p class="evento-titulo"><span class="tipo">${esc(TIPOS_EVENTO[e.tipo] ?? e.tipo)}</span> ${esc(e.titulo)}${e.pesoKg !== null ? `<span class="num"> ${formatarPeso(e.pesoKg)}</span>` : ""}</p>
          ${e.detalhes ? `<p class="detalhes">${esc(e.detalhes)}</p>` : ""}
          ${e.proximaData ? `<p class="suave">Próxima: ${formatarData(e.proximaData)}</p>` : ""}
          ${porEvento.get(e.id) ? listaAnexos(porEvento.get(e.id)) : ""}
          <button type="button" class="link-botao perigo" data-click="evento-apagar" data-id="${esc(e.id)}">apagar registro</button></div></li>`).join("")}</ol>`}
    </section>
    ${gato.ativo ? `<details class="bloco"${eventos.length === 0 ? " open" : ""}><summary>Registrar cuidado para ${esc(gato.nome)}</summary>${formEvento({ hoje, titulos: titulosUsados(state), gatoFixo: gato })}</details>` : ""}
    <section class="bloco"><h2>Documentos</h2>${soltos.length > 0 ? listaAnexos(soltos) : `<p class="suave">Nenhum documento solto.</p>`}${anexar}</section>
    <details class="bloco"><summary>Editar dados</summary>
      <form data-acao="gato-editar" class="form"><input type="hidden" name="id" value="${esc(gato.id)}">
        <label>Nome <input name="nome" value="${esc(gato.nome)}" required maxlength="60"></label>
        <div class="linha-campos">
          <label>Nascimento (aproximado serve) <input type="date" name="nascimento" value="${esc(gato.nascimento ?? "")}" max="${hoje}"></label>
          <label>Sexo <select name="sexo">
            <option value=""${!gato.sexo ? " selected" : ""}>Não informado</option>
            <option value="femea"${gato.sexo === "femea" ? " selected" : ""}>Fêmea</option>
            <option value="macho"${gato.sexo === "macho" ? " selected" : ""}>Macho</option></select></label>
        </div>
        <label class="check"><input type="checkbox" name="castrado"${gato.castrado ? " checked" : ""}> Castrado</label>
        <label>Como reconhecer <input name="descricao" value="${esc(gato.descricao ?? "")}" maxlength="200" placeholder="Frajola, mancha no nariz"></label>
        <label>Microchip <input name="microchip" value="${esc(gato.microchip ?? "")}" maxlength="40"></label>
        <label>Observações <textarea name="observacoes" rows="3" maxlength="2000" placeholder="Alergias, temperamento, o que funciona para dar remédio">${esc(gato.observacoes ?? "")}</textarea></label>
        ${slotErro}
        <button class="botao" type="submit">Salvar dados</button>
      </form></details>
    <details class="bloco zona-perigo"><summary>Arquivar ou apagar</summary>
      <div class="form"><p class="suave">${gato.ativo ? "Arquivar tira o gato das listas e pendências (adoção, falecimento) e mantém o histórico." : "Este gato está arquivado."}</p>
        <button type="button" class="botao botao-secundario" data-click="gato-ativo" data-id="${esc(gato.id)}" data-ativo="${gato.ativo ? "0" : "1"}">${gato.ativo ? "Arquivar" : "Reativar"}</button></div>
      <form data-acao="gato-apagar" class="form"><input type="hidden" name="id" value="${esc(gato.id)}">
        <label>Para apagar tudo, inclusive documentos, digite ${esc(gato.nome)} <input name="confirmacao" autocomplete="off"></label>
        ${slotErro}
        <button class="botao botao-perigo" type="submit">Apagar para sempre</button></form></details>`;
}

// ---------- Registrar cuidado ----------

export function viewCuidado(state, hoje, flash) {
  const gatos = gatosAtivos(state).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return `<h1>Registrar cuidado</h1>
    <p class="suave">Para vários gatos de uma vez, como o vermífugo da Galera inteira. Peso se registra na página de cada gato.</p>
    ${aviso(flash)}
    ${gatos.length === 0 ? `<p><a href="#/gatos">Cadastre os gatos</a> primeiro.</p>` : formEvento({ hoje, titulos: titulosUsados(state), gatos })}`;
}

// ---------- Estoque ----------

const SELO = { sem_dados: "", ok: "em uso", baixo: "acabando", acabou: "acabou" };

/** Tamanho da última compra ou pacote aberto: sugestão para o próximo pacote. */
const ultimaCompra = (i) => [...i.movimentos].reverse().find((m) => m.tipo === "compra" || m.tipo === "abertura")?.quantidade ?? "";

function cartaoItem(i, hoje, nGatos) {
  const { situacao: s, estimativa: e, consumo: media } = i;
  const campoItem = `<input type="hidden" name="itemId" value="${esc(i.id)}">`;
  const nomeEsc = esc(i.nome);

  let estado;
  if (s.tipo === "vazio") {
    estado = `<p class="suave">Nenhuma compra registrada.</p>`;
  } else if (s.tipo === "acabou") {
    estado = `<p><strong>Acabou em ${formatarData(s.acabouEm)}.</strong> Quando comprar de novo, registre a compra acima.</p>`;
  } else {
    const quando = (n) => (n === 0 ? "hoje" : n === 1 ? "1 dia" : `${n} dias`);
    if (s.aberto) {
      const dias = diasEntre(s.aberto.desde, hoje);
      let previsao = "";
      if (i.consumoEfetivo > 0) {
        const fim = somarDias(s.aberto.desde, Math.round(s.aberto.pacote / i.consumoEfetivo));
        previsao = diasEntre(hoje, fim) >= 0
          ? ` Pelo consumo médio, deve acabar por volta de ${formatarData(fim)}.`
          : ` Pelo consumo médio já era para ter acabado. Se acabou, toque em “Acabou”.`;
      }
      estado = `<p><strong>Pacote aberto em ${formatarData(s.aberto.desde)}</strong> (${quando(dias)}): ${formatarQuantidade(s.aberto.pacote, i.unidade)}.${previsao}</p>`;
    } else {
      estado = `<p>Comprou ${formatarQuantidade(s.comprado, i.unidade)} (desde ${formatarData(s.desde)}). <strong>Ainda sem pacote aberto.</strong> Quando abrir um, toque em “Abri o pacote” para marcar a data.</p>`;
    }
  }

  const blocoMedia = media
    ? `<div class="media-consumo"><h3>Quanto os gatos consomem</h3>
        <dl>
          ${nGatos > 0 ? `<div><dt>Por gato, por dia</dt><dd>${formatarConsumo(media.porDia / nGatos, i.unidade)}</dd></div>
          <div><dt>Por gato, por mês</dt><dd>${formatarConsumo((media.porDia / nGatos) * 30, i.unidade)}</dd></div>` : ""}
          <div><dt>Todos, por dia</dt><dd>${formatarConsumo(media.porDia, i.unidade)}</dd></div>
          <div><dt>Todos, por semana</dt><dd>${formatarConsumo(media.porDia * 7, i.unidade)}</dd></div>
          <div><dt>Todos, por mês</dt><dd>${formatarConsumo(media.porDia * 30, i.unidade)}</dd></div>
        </dl>
        <small>Calculado em ${media.periodos} ${media.periodos === 1 ? "período" : "períodos"} (${media.dias} dias, ${formatarConsumo(media.consumido, i.unidade)})${nGatos > 0 ? `, dividido por ${nGatos} ${nGatos === 1 ? "gato ativo" : "gatos ativos"} hoje` : ""}. Cada vez que você marca “Acabou”, a média se atualiza.</small>
      </div>`
    : s.tipo !== "vazio"
      ? `<p class="suave">Marque “Abri o pacote” e, quando acabar, “Acabou”: assim o app vê quanto os gatos consomem.</p>`
      : "";

  // Pacote aberto depois de um "acabou": a estimativa de estoque ainda não sabe disso, então não mostra "acabou".
  const status = s.tipo === "acabou" ? "acabou" : s.aberto && e.status === "acabou" ? "ok" : e.status;
  const selo = s.tipo === "em_uso" ? (SELO[status] || "em uso") : s.tipo === "acabou" ? "acabou" : "";

  return `<section class="bloco item-estoque" data-status="${status}">
    <header><h2>${nomeEsc}</h2>${selo ? `<span class="selo">${selo}</span>` : ""}</header>
    ${estado}
    ${blocoMedia}
    <div class="acoes-item">
      ${s.tipo !== "vazio" ? `<details${s.tipo === "em_uso" && !s.aberto ? " open" : ""}><summary>Abri o pacote</summary><form data-acao="abertura" class="form">${campoItem}
        <div class="linha-campos"><label>Dia em que abriu <input type="date" name="data" value="${hoje}" max="${hoje}" required></label>
          <label>Tamanho do pacote (${esc(i.unidade)}) <input name="quantidade" inputmode="decimal" required value="${esc(String(ultimaCompra(i)).replace(".", ","))}"></label></div>
        ${slotErro}<button class="botao" type="submit">Salvar abertura</button></form></details>` : ""}
      ${s.tipo === "em_uso" ? `<details><summary>Acabou</summary><form data-acao="acabou" class="form">${campoItem}
        <label>Dia em que acabou <input type="date" name="data" value="${hoje}" max="${hoje}" min="${esc(s.aberto?.desde ?? s.desde)}" required></label>
        ${slotErro}<button class="botao" type="submit">Acabou</button></form></details>` : ""}
      <button type="button" class="link-botao" data-click="comprar-de-novo" data-nome="${nomeEsc}" data-unidade="${esc(i.unidade)}">Comprei mais</button>
      <details><summary>Mais opções</summary>
        <form data-acao="contagem" class="form">${campoItem}
          <div class="linha-campos"><label>Contei, tem agora (${esc(i.unidade)}) <input name="quantidade" inputmode="decimal" required></label>
            <label>Data <input type="date" name="data" value="${hoje}" max="${hoje}" required></label></div>
          <small>Para conferir o que sobrou. Se você usa “Abri o pacote”, a média vem da data de abertura e do “Acabou”, não desta contagem.</small>
          ${slotErro}<button class="botao botao-secundario" type="submit">Registrar contagem</button></form>
        <button type="button" class="link-botao perigo" data-click="item-arquivar" data-id="${esc(i.id)}">Arquivar item</button>
      </details>
    </div>
    ${i.movimentos.length > 0 ? `<details><summary>Histórico</summary><ul class="lista-simples">${i.movimentos.slice(-10).reverse().map((m) => `<li>
      ${formatarData(m.data)}: ${m.tipo === "compra" ? `comprou ${formatarQuantidade(m.quantidade, i.unidade)}` : m.tipo === "abertura" ? `abriu pacote de ${formatarQuantidade(m.quantidade, i.unidade)}` : m.quantidade === 0 ? "acabou" : `contou ${formatarQuantidade(m.quantidade, i.unidade)}`}
      <button type="button" class="link-botao perigo" data-click="mov-apagar" data-id="${esc(m.id)}">apagar</button></li>`).join("")}</ul></details>` : ""}
  </section>`;
}

export function viewEstoque(state, hoje, flash) {
  const itens = estoqueDe(state, hoje);
  const nGatos = gatosAtivos(state).length;
  const primeira = itens.length === 0;

  return `<h1>Estoque</h1>
    <p class="suave">Registre o que comprou. Quando abrir um pacote, marque a data; quando acabar, toque em “Acabou”. O app calcula quanto os gatos consomem.</p>
    ${aviso(flash)}
    <section class="bloco"><h2>Comprei</h2>
      <form data-acao="compra" class="form">
        <div class="linha-campos">
          <label>O que <input name="nome" required maxlength="80" list="itens-estoque" placeholder="Ração, Areia…" value="${primeira ? "Ração" : ""}" autocomplete="off">
            <datalist id="itens-estoque">${itens.map((i) => `<option value="${esc(i.nome)}"></option>`).join("")}</datalist></label>
          <label>Quanto <span class="linha-unidade"><input name="quantidade" inputmode="decimal" required placeholder="15">
            <select name="unidade" aria-label="Unidade"><option value="kg" selected>kg</option><option value="l">litros</option><option value="un">unidades</option></select></span></label>
        </div>
        <div class="linha-campos">
          <label>Data <input type="date" name="data" value="${hoje}" max="${hoje}" required></label>
          <label>Valor pago (opcional) <input name="valorCentavos" inputmode="decimal" placeholder="R$ 0,00"></label>
        </div>
        <label>Loja (opcional) <input name="loja" maxlength="80"></label>
        <small>Com valor, a compra também entra em Gastos.</small>
        ${slotErro}
        <button class="botao" type="submit">Registrar compra</button>
      </form></section>
    ${itens.map((i) => cartaoItem(i, hoje, nGatos)).join("")}`;
}

// ---------- Gastos ----------

export function viewGastos(state, hoje, mesPedido, flash) {
  const mesAtual = hoje.slice(0, 7);
  const valido = /^\d{4}-(0[1-9]|1[0-2])$/.test(mesPedido ?? "") ? mesPedido : mesAtual;
  const mes = valido > mesAtual ? mesAtual : valido;
  const gastos = gastosDoMes(state, mes);
  const gatos = todosGatos(state);
  const nomes = new Map(gatos.map((g) => [g.id, g.nome]));
  const resumo = resumirGastos(gastos);

  return `<h1>Gastos</h1>
    <nav class="navega-mes" aria-label="Mês"><a href="#/gastos?mes=${deslocarMes(mes, -1)}">Mês anterior</a><strong>${nomeDoMes(mes)}</strong>
      ${mes < mesAtual ? `<a href="#/gastos?mes=${deslocarMes(mes, 1)}">Próximo mês</a>` : "<span></span>"}</nav>
    ${aviso(flash)}
    <p class="numero-grande">${formatarReais(resumo.totalCentavos)}</p>
    ${resumo.porCategoria.length > 0 ? `<ul class="barras">${resumo.porCategoria.map((c) => `<li><span>${esc(CATEGORIAS_GASTO[c.categoria] ?? c.categoria)}</span>
      <span class="barra" style="--fracao:${c.fracao}" aria-hidden="true"></span><span class="num">${formatarReais(c.totalCentavos)}</span></li>`).join("")}</ul>` : ""}
    ${gastos.length === 0 ? `<p class="suave">Nenhum gasto em ${nomeDoMes(mes)}.</p>` : `<ul class="tabela-gastos">${gastos.map((g) => `<li>
      <time datetime="${esc(g.data)}">${formatarData(g.data).slice(0, 5)}</time>
      <span>${esc(CATEGORIAS_GASTO[g.categoria] ?? g.categoria)}${g.descricao ? `<span class="suave"> ${esc(g.descricao)}</span>` : ""}${g.gatoId && nomes.get(g.gatoId) ? `<span class="suave"> (${esc(nomes.get(g.gatoId))})</span>` : ""}</span>
      <span class="num">${formatarReais(g.valorCentavos)}</span>
      <button type="button" class="link-botao perigo" data-click="gasto-apagar" data-id="${esc(g.id)}" aria-label="Apagar gasto">apagar</button></li>`).join("")}</ul>`}
    <section class="bloco"><h2>Lançar gasto</h2>
      <form data-acao="gasto-novo" class="form">
        <div class="linha-campos"><label>Valor <input name="valorCentavos" inputmode="decimal" required placeholder="R$ 0,00"></label>
          <label>Data <input type="date" name="data" value="${hoje}" max="${hoje}" required></label></div>
        <div class="linha-campos">
          <label>Categoria <select name="categoria" required><option value="" disabled selected>Escolha</option>${Object.entries(CATEGORIAS_GASTO).map(([v, r]) => `<option value="${v}">${r}</option>`).join("")}</select></label>
          <label>Gato (opcional) <select name="gatoId"><option value="">Galera toda</option>${gatosAtivos(state).map((g) => `<option value="${esc(g.id)}">${esc(g.nome)}</option>`).join("")}</select></label>
        </div>
        <div class="linha-campos"><label>Descrição <input name="descricao" maxlength="200"></label><label>Loja <input name="loja" maxlength="80"></label></div>
        <small>Compras de ração e areia ficam melhores pelo Estoque: lançam o gasto e atualizam a estimativa juntas.</small>
        ${slotErro}
        <button class="botao" type="submit">Lançar gasto</button>
      </form></section>`;
}

// ---------- Conta ----------

export function viewConta({ signedIn, email }, flash) {
  const galera = `<section class="bloco" id="galera"><h2>Galera compartilhada</h2>
        <p class="suave">Quem estiver na Galera vê e edita os mesmos gatos, estoque e gastos. Cada um entra com a própria conta.</p>
        <ul id="membros" class="lista-simples" aria-live="polite"><li class="suave">Carregando…</li></ul>
        <div class="form">
          <button type="button" class="botao botao-secundario" data-click="convite-novo">Convidar alguém</button>
          <div id="convite-resultado" class="convite" role="status" hidden></div>
        </div>
        <details><summary>Entrar na Galera de outra pessoa</summary>
          <form data-acao="convite-aceitar" class="form">
            <label>Código do convite <input name="codigo" autocomplete="off" autocapitalize="characters" spellcheck="false" required placeholder="ABCD-EF23"></label>
            <small>Os dados que esta conta tem hoje serão descartados e você passa a ver os da Galera do convite.</small>
            ${slotErro}
            <button class="botao" type="submit">Entrar na Galera</button>
          </form></details>
        <button type="button" class="link-botao perigo" id="btn-sair-galera" data-click="galera-sair" hidden>Sair desta Galera</button>
      </section>`;
  return `<h1>Conta</h1>${aviso(flash)}
    ${signedIn ? `<section class="bloco"><h2>${esc(email)}</h2>
        <p class="suave">Seus dados ficam neste aparelho e são copiados para a Galera na nuvem, para você abrir em outro celular.</p>
        <button type="button" class="botao botao-secundario" data-click="sair">Sair</button></section>
      ${galera}
      <section class="bloco zona-perigo"><h2>Excluir conta</h2>
        <p class="suave">Apaga a sua conta. Se você for a única pessoa da Galera, apaga também todos os gatos, o histórico, o estoque, os gastos e os documentos; se houver mais gente, a Galera continua com eles. Não dá para desfazer.</p>
        <button type="button" class="botao botao-perigo" data-click="excluir-conta">Excluir minha conta</button>
        <p class="aviso aviso-erro" role="alert" data-erro hidden></p></section>`
      : `<section class="bloco"><h2>Só neste aparelho</h2>
        <p class="suave">Você está usando o app sem conta. Os dados ficam só neste navegador: limpar os dados do site ou trocar de celular apaga tudo. Com uma conta você também pode compartilhar a Galera com outra pessoa.</p>
        <a class="botao" href="#/entrar">Entrar ou criar conta</a></section>`}
    <section class="bloco"><h2>Primeiros passos</h2>
      <p class="suave">Quer rever a apresentação do app?</p>
      <a class="botao botao-secundario" href="#/boas-vindas">Ver o passeio de novo</a></section>
    <section class="bloco"><h2>Privacidade</h2>
      <p class="suave">O app guarda o que você registra: nomes e dados dos gatos, vacinas, consultas, exames, estoque, gastos e documentos. Nada é vendido. Com conta, os dados ficam no Supabase e só quem está na sua Galera consegue ler ou alterar (as regras valem no próprio banco). Sem conta, ficam só no seu navegador.</p></section>`;
}

// ---------- Onboarding ----------

export function viewTour(n) {
  const p = PASSOS[n];
  const total = PASSOS.length;
  const ultimo = ehUltimo(n);
  const pontos = PASSOS.map((_, i) => `<span class="tour-ponto${i === n ? " ativo" : ""}"></span>`).join("");
  return `<main class="tour" aria-labelledby="tour-titulo">
    <header class="tour-topo">
      <span class="tour-marca">${PATA}Pet Caramelo</span>
      ${ultimo ? "" : `<button type="button" class="link-botao" data-click="tour-pular">Pular</button>`}
    </header>
    <div class="tour-corpo">
      <div class="tour-icone" aria-hidden="true">${p.icone}</div>
      <p class="tour-passo">Passo ${n + 1} de ${total}</p>
      <h1 id="tour-titulo">${esc(p.titulo)}</h1>
      ${p.texto.map((t) => `<p>${esc(t)}</p>`).join("")}
      ${p.fluxo ? `<ol class="tour-fluxo" aria-label="Sequência">${p.fluxo.map((e) => `<li>${esc(e)}</li>`).join("")}</ol>` : ""}
      ${p.dicas ? `<ul class="tour-dicas">${p.dicas.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}
    </div>
    <div class="tour-pontos" role="img" aria-label="Passo ${n + 1} de ${total}">${pontos}</div>
    <footer class="tour-rodape">
      ${n > 0 ? `<button type="button" class="botao botao-secundario" data-click="tour-volta">Voltar</button>` : `<span></span>`}
      <button type="button" class="botao" data-click="${ultimo ? "tour-fim" : "tour-prox"}">${ultimo ? "Começar" : "Próximo"}</button>
    </footer>
  </main>`;
}
