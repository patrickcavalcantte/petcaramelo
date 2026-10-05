import { z } from "zod";
import { isDataISO, diasEntre } from "./domain/datas";
import { parseReais } from "./domain/dinheiro";
import { CATEGORIAS_GASTO, type CategoriaGasto } from "./domain/gastos";

/**
 * Validação de tudo que chega dos formulários. Os formulários mandam
 * strings, então cada campo converte "" em undefined e trata vírgula
 * decimal brasileira.
 *
 * O banco repete as regras críticas (checks e RLS). Validar aqui serve
 * para dar mensagens legíveis; o banco é a última linha de defesa.
 */

const vazioParaUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const textoOpcional = (max: number) =>
  z.preprocess(vazioParaUndefined, z.string().trim().max(max, `Máximo de ${max} caracteres`).optional());

const dataObrigatoria = z
  .string({ error: "Informe a data" })
  .refine(isDataISO, "Data inválida");

const dataOpcional = z.preprocess(vazioParaUndefined, dataObrigatoria.optional());

const numeroBR = (msg: string) =>
  z.preprocess((v) => {
    if (typeof v !== "string") return v;
    const s = v.trim().replace(",", ".");
    return s === "" ? undefined : Number(s);
  }, z.number({ error: msg }).refine(Number.isFinite, msg));

const reaisOpcional = z.preprocess(
  vazioParaUndefined,
  z
    .string()
    .transform((s, ctx) => {
      const c = parseReais(s);
      if (c === null) {
        ctx.addIssue({ code: "custom", message: "Valor inválido. Use algo como 89,90" });
        return z.NEVER;
      }
      return c;
    })
    .optional(),
);

const uuid = z.uuid({ error: "Identificador inválido" });

export const TIPOS_EVENTO = {
  vacina: "Vacina",
  vermifugo: "Vermífugo",
  antipulgas: "Antipulgas",
  consulta: "Consulta",
  exame: "Exame",
  medicacao: "Medicação",
  pesagem: "Pesagem",
  cirurgia: "Cirurgia",
  outro: "Outro",
} as const;
export type TipoEvento = keyof typeof TIPOS_EVENTO;

const chaves = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

export function gatoSchema(hoje: string) {
  return z.object({
    nome: z.string().trim().min(1, "Informe o nome").max(60, "Nome muito longo"),
    nascimento: dataOpcional.refine(
      (d) => d === undefined || diasEntre(d, hoje) >= 0,
      "Nascimento não pode ser no futuro",
    ),
    sexo: z.preprocess(vazioParaUndefined, z.enum(["macho", "femea"]).optional()),
    castrado: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
    descricao: textoOpcional(200),
    microchip: textoOpcional(40),
    observacoes: textoOpcional(2000),
  });
}

export function eventoSchema(hoje: string) {
  return z
    .object({
      gatoIds: z
        .array(uuid)
        .min(1, "Selecione pelo menos um gato")
        .transform((ids) => [...new Set(ids)]),
      tipo: z.enum(chaves(TIPOS_EVENTO), { error: "Escolha o tipo" }),
      data: dataObrigatoria.refine((d) => diasEntre(d, hoje) >= 0, "A data não pode ser no futuro"),
      titulo: z.string().trim().min(1, "Informe um título, como V5 ou Hemograma").max(120),
      detalhes: textoOpcional(4000),
      pesoKg: z.preprocess(
        vazioParaUndefined,
        numeroBR("Peso inválido").refine((n) => n > 0 && n < 30, "Peso entre 0 e 30 kg").optional(),
      ),
      proximaData: dataOpcional,
      valorCentavos: reaisOpcional,
      loja: textoOpcional(80),
    })
    .superRefine((e, ctx) => {
      if (e.tipo === "pesagem" && e.pesoKg === undefined) {
        ctx.addIssue({ code: "custom", path: ["pesoKg"], message: "Pesagem precisa do peso" });
      }
      if (e.pesoKg !== undefined && e.gatoIds.length > 1) {
        ctx.addIssue({ code: "custom", path: ["pesoKg"], message: "Peso só para um gato por vez" });
      }
      if (e.proximaData && diasEntre(e.data, e.proximaData) <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["proximaData"],
          message: "A próxima data precisa ser depois da data do evento",
        });
      }
    });
}

export const itemEstoqueSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do item").max(80),
  categoria: z.enum(["racao", "areia", "outro"], { error: "Escolha a categoria" }),
  unidade: z.enum(["kg", "l", "un"], { error: "Escolha a unidade" }),
  consumoDiario: numeroBR("Consumo inválido").refine((n) => n >= 0 && n < 100_000, "Consumo inválido"),
  alertaDias: numeroBR("Aviso inválido").refine(
    (n) => Number.isInteger(n) && n >= 0 && n <= 90,
    "Aviso entre 0 e 90 dias",
  ),
});

export const ajusteConsumoSchema = z.object({
  itemId: uuid,
  consumoDiario: itemEstoqueSchema.shape.consumoDiario,
});

export function compraSchema(hoje: string) {
  return z.object({
    itemId: uuid,
    quantidade: numeroBR("Quantidade inválida").refine((n) => n > 0 && n < 1_000_000, "Quantidade precisa ser maior que zero"),
    data: dataObrigatoria.refine((d) => diasEntre(d, hoje) >= 0, "A data não pode ser no futuro"),
    valorCentavos: reaisOpcional,
    loja: textoOpcional(80),
  });
}

export function contagemSchema(hoje: string) {
  return z.object({
    itemId: uuid,
    quantidade: numeroBR("Quantidade inválida").refine((n) => n >= 0 && n < 1_000_000, "Quantidade inválida"),
    data: dataObrigatoria.refine((d) => diasEntre(d, hoje) >= 0, "A data não pode ser no futuro"),
  });
}

export function gastoSchema(hoje: string) {
  return z.object({
    data: dataObrigatoria.refine((d) => diasEntre(d, hoje) >= 0, "A data não pode ser no futuro"),
    valorCentavos: reaisOpcional.refine((v) => v !== undefined, "Informe o valor"),
    categoria: z.enum(chaves(CATEGORIAS_GASTO) as [CategoriaGasto, ...CategoriaGasto[]], {
      error: "Escolha a categoria",
    }),
    descricao: textoOpcional(200),
    loja: textoOpcional(80),
    gatoId: z.preprocess(vazioParaUndefined, uuid.optional()),
  });
}

export const MIMES_ANEXO = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;
export const TAMANHO_MAX_ANEXO = 10 * 1024 * 1024;

export function anexoSchema(userId: string) {
  return z
    .object({
      gatoId: uuid,
      eventoId: z.preprocess(vazioParaUndefined, uuid.optional()),
      storagePath: z.string().min(1).max(500),
      nomeArquivo: z.string().trim().min(1).max(200),
      mime: z.enum(MIMES_ANEXO, { error: "Tipo de arquivo não aceito. Use PDF ou foto." }),
      tamanhoBytes: z.number().int().positive().max(TAMANHO_MAX_ANEXO, "Arquivo acima de 10 MB"),
    })
    .refine((a) => a.storagePath.startsWith(`${userId}/${a.gatoId}/`) && !a.storagePath.includes(".."), {
      message: "Caminho de arquivo inválido",
      path: ["storagePath"],
    });
}

/** Primeira mensagem de erro, para mostrar na tela. */
export function primeiroErro(erro: z.ZodError): string {
  return erro.issues[0]?.message ?? "Dados inválidos";
}

/** FormData -> objeto simples. Campos repetidos (checkbox múltiplo) viram array quando listados. */
export function formParaObjeto(fd: FormData, camposLista: string[] = []): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v !== "string") continue;
    if (camposLista.includes(k)) continue;
    obj[k] = v;
  }
  for (const k of camposLista) obj[k] = fd.getAll(k).filter((v): v is string => typeof v === "string");
  return obj;
}
