/**
 * Cadastro rápido: um nome por linha (ou separados por vírgula).
 * Remove vazios e duplicados (sem diferenciar caixa), respeitando os nomes
 * que já existem na conta.
 */
export function nomesEmLote(
  texto: string,
  existentes: string[] = [],
): { novos: string[]; ignorados: string[]; invalidos: string[] } {
  const vistos = new Set(existentes.map((n) => n.trim().toLowerCase()));
  const novos: string[] = [];
  const ignorados: string[] = [];
  const invalidos: string[] = [];

  for (const bruto of texto.split(/[\n,;]/)) {
    const nome = bruto.replace(/\s+/g, " ").trim();
    if (!nome) continue;
    if (nome.length > 60) {
      invalidos.push(nome);
      continue;
    }
    const chave = nome.toLowerCase();
    if (vistos.has(chave)) {
      ignorados.push(nome);
      continue;
    }
    vistos.add(chave);
    novos.push(nome);
  }
  return { novos, ignorados, invalidos };
}
