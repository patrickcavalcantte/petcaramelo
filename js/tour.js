// Onboarding: o passeio que aparece uma vez, logo depois do primeiro login, e explica o que o app faz.
// O conteúdo e a regra de "já viu?" ficam aqui, sem DOM, para poder testar. A tela é viewTour, em views.js.

/**
 * Cada passo: icone (emoji dentro de um círculo), titulo, texto (parágrafos), e opcionalmente
 * fluxo (etapas em sequência) e dicas (lista curta).
 */
export const PASSOS = [
  {
    icone: "🐈",
    titulo: "Bem-vindo à Galera",
    texto: [
      "O Pet Caramelo guarda tudo sobre os seus gatos num lugar só: saúde, estoque de ração e areia, e gastos.",
      "Em poucos toques você vê o que está atrasado, o que está acabando e quanto a Galera custa por mês.",
    ],
  },
  {
    icone: "🐾",
    titulo: "Cadastre os gatos de uma vez",
    texto: [
      "Em Gatos, digite um nome por linha e pronto. Idade, sexo e o resto você completa depois, na ficha de cada um.",
      "Gato que foi embora ou faleceu pode ser arquivado: some das listas, mas o histórico fica guardado.",
    ],
  },
  {
    icone: "💉",
    titulo: "Vacinas, vermífugo e consultas",
    texto: [
      "Em Registrar cuidado, um mesmo registro vale para vários gatos, como o vermífugo da Galera inteira.",
      "Informe a próxima dose e ela aparece no painel quando estiver chegando ou atrasada. Fotos de laudos e receitas ficam guardadas na ficha de cada gato.",
    ],
  },
  {
    icone: "📦",
    titulo: "Estoque que se calcula sozinho",
    texto: [
      "Registre a compra, marque o dia em que abriu o pacote e, quando ele acabar, toque em Acabou.",
      "Com isso o app descobre quanto os gatos comem por dia, semana, mês e por gato, e avisa quando o pacote deve acabar.",
    ],
    fluxo: ["Comprei", "Abri o pacote", "Acabou"],
  },
  {
    icone: "💸",
    titulo: "Gastos sem digitar duas vezes",
    texto: [
      "Compras do estoque e cuidados com valor entram sozinhos nos gastos, já na categoria certa.",
      "Em Gastos você vê o total do mês, o que mais pesou e navega pelos meses anteriores.",
    ],
  },
  {
    icone: "👥",
    titulo: "Compartilhe com quem cuida junto",
    texto: [
      "Em Conta, toque em Convidar alguém e envie o código. Quem entrar com ele vê e edita a mesma Galera, sem cadastrar nada de novo.",
      "O que um registra aparece para o outro em instantes.",
    ],
    dicas: [
      "iPhone: no Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.",
      "Android: no menu do Chrome, toque em Instalar app ou Adicionar à tela inicial.",
    ],
    ultimo: true,
  },
];

export const chaveTour = (quem) => `pet-caramelo:tour:${quem}`;

/** O passeio ainda não foi visto por esta pessoa (ou, sem conta, neste aparelho)? Sem storage, não insiste. */
export function precisaTour(storage, quem) {
  try {
    return storage?.getItem(chaveTour(quem)) !== "1" && Boolean(storage);
  } catch {
    return false;
  }
}

export function marcarTour(storage, quem) {
  try { storage?.setItem(chaveTour(quem), "1"); } catch { /* sem storage: pode aparecer de novo, é só um passeio */ }
}

/** Passo vizinho, sem sair da lista. */
export const passoSeguinte = (n) => Math.min(n + 1, PASSOS.length - 1);
export const passoAnterior = (n) => Math.max(n - 1, 0);
export const ehUltimo = (n) => n >= PASSOS.length - 1;
