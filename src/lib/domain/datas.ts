/**
 * Datas de calendário como strings "YYYY-MM-DD".
 *
 * Por quê: a Vercel roda em UTC. Se usássemos `new Date()` direto, depois
 * das 21h no Brasil o "hoje" do servidor já seria amanhã, e um vencimento
 * apareceria como atrasado um dia antes. Toda conta de dias passa por aqui.
 */

const FUSO = "America/Sao_Paulo";
const RE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_DIA = 86_400_000;

export function hojeISO(agora: Date = new Date(), fuso: string = FUSO): string {
  // en-CA formata como YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

export function isDataISO(valor: string): boolean {
  const m = RE_ISO.exec(valor);
  if (!m) return false;
  const [, a, mes, d] = m.map(Number);
  const dt = new Date(Date.UTC(a, mes - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === mes - 1 && dt.getUTCDate() === d;
}

function paraUTC(iso: string): number {
  if (!isDataISO(iso)) throw new Error(`Data inválida: ${iso}`);
  const [a, m, d] = iso.split("-").map(Number);
  return Date.UTC(a, m - 1, d);
}

/** Dias de `de` até `ate` (positivo se `ate` for depois). */
export function diasEntre(de: string, ate: string): number {
  return Math.round((paraUTC(ate) - paraUTC(de)) / MS_DIA);
}

export function somarDias(iso: string, dias: number): string {
  return new Date(paraUTC(iso) + dias * MS_DIA).toISOString().slice(0, 10);
}

export function formatarData(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** Idade legível: "3 anos e 2 meses", "8 meses", "menos de 1 mês". */
export function idade(nascimento: string, hoje: string): string | null {
  if (!isDataISO(nascimento) || diasEntre(nascimento, hoje) < 0) return null;
  const [an, mn, dn] = nascimento.split("-").map(Number);
  const [ah, mh, dh] = hoje.split("-").map(Number);
  let meses = (ah - an) * 12 + (mh - mn);
  if (dh < dn) meses -= 1;
  if (meses < 1) return "menos de 1 mês";
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const txtAnos = anos === 1 ? "1 ano" : `${anos} anos`;
  const txtMeses = resto === 1 ? "1 mês" : `${resto} meses`;
  if (anos === 0) return txtMeses;
  if (resto === 0) return txtAnos;
  return `${txtAnos} e ${txtMeses}`;
}

/** "2026-10" -> { inicio: "2026-10-01", fimExclusivo: "2026-11-01" } */
export function intervaloDoMes(mes: string): { inicio: string; fimExclusivo: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(mes);
  if (!m) throw new Error(`Mês inválido: ${mes}`);
  const ano = Number(m[1]);
  const mm = Number(m[2]);
  if (mm < 1 || mm > 12) throw new Error(`Mês inválido: ${mes}`);
  const prox = mm === 12 ? `${ano + 1}-01` : `${ano}-${String(mm + 1).padStart(2, "0")}`;
  return { inicio: `${mes}-01`, fimExclusivo: `${prox}-01` };
}

export function deslocarMes(mes: string, delta: number): string {
  const [a, m] = mes.split("-").map(Number);
  const total = a * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

const NOMES_MES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function nomeDoMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return `${NOMES_MES[m - 1]} de ${a}`;
}
