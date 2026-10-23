// Sincronização com mais de uma pessoa gravando: baixa, junta e só então grava, com checagem de versão.
// Se alguém gravou entre o download e a gravação, o `push` recusa (devolve false) e tentamos de novo
// já com o que a outra pessoa acabou de fazer. Sem dependência de DOM nem de rede: tudo entra por parâmetro.

/**
 * @param local       () => estado deste aparelho (lido depois do download: a pessoa pode ter mexido nesse meio-tempo)
 * @param pull        async () => estado remoto, ou null se ainda não há
 * @param push        async (estado) => true se gravou, false se a versão mudou
 * @param merge       (local, remoto) => estado junto
 * @param gravarLocal (estado) => guarda no aparelho
 * @returns { mudouAqui } se o que veio da nuvem alterou o estado deste aparelho
 */
export async function reconciliar({ local, pull, push, merge, gravarLocal, tentativas = 4 }) {
  let mudouAqui = false;
  for (let i = 0; i < tentativas; i += 1) {
    const remoto = await pull();
    const atual = local();
    const junto = merge(atual, remoto);
    if (JSON.stringify(junto) !== JSON.stringify(atual)) {
      gravarLocal(junto);
      mudouAqui = true;
    }
    if (remoto && JSON.stringify(junto) === JSON.stringify(remoto)) return { mudouAqui }; // nada a enviar
    if (await push(junto)) return { mudouAqui };
  }
  throw new Error("Muitas alterações ao mesmo tempo. Tente de novo.");
}

/** Código de convite como a pessoa digita ("abcd-efgh", " ABCD EFGH ") -> "ABCDEFGH". */
export const normalizarCodigo = (texto) => String(texto ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** "ABCDEFGH" -> "ABCD-EFGH", para mostrar e ditar. */
export const formatarCodigo = (codigo) => `${codigo.slice(0, 4)}-${codigo.slice(4)}`;
