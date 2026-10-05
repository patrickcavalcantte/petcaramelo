/**
 * Dinheiro sempre em centavos (inteiro). Float para dinheiro dá
 * 0.1 + 0.2 = 0.30000000000000004, e isso aparece na soma do mês.
 */

/**
 * Converte o que a pessoa digita em centavos.
 * Aceita "89,90", "R$ 1.234,56", "1234.5", "45". Devolve null se não der.
 *
 * Regra para o ponto: com vírgula presente, ponto é milhar. Sem vírgula,
 * ponto seguido de 1 ou 2 dígitos no fim é decimal ("89.9"); caso contrário
 * é milhar ("1.234").
 */
export function parseReais(entrada: string): number | null {
  let s = entrada.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (s === "" || !/^[\d.,]+$/.test(s)) return null;

  if (s.includes(",")) {
    if (s.split(",").length > 2) return null;
    const [inteira, dec] = s.split(",");
    if (!/^\d{1,2}$/.test(dec)) return null;
    if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(inteira)) return null;
    s = `${inteira.replace(/\./g, "")}.${dec}`;
  } else if (/^\d+\.\d{1,2}$/.test(s)) {
    // decimal com ponto
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  } else if (!/^\d+$/.test(s)) {
    return null;
  }

  const [int, dec = ""] = s.split(".");
  const centavos = Number(int) * 100 + Number(dec.padEnd(2, "0"));
  return Number.isSafeInteger(centavos) && centavos > 0 ? centavos : null;
}

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatarReais(centavos: number): string {
  return fmt.format(centavos / 100);
}

/** Para preencher inputs: 8990 -> "89,90" */
export function centavosParaInput(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}
