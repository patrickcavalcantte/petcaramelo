export function Avisos({ erro, ok }: { erro?: string; ok?: string }) {
  if (!erro && !ok) return null;
  return (
    <p role={erro ? "alert" : "status"} className={erro ? "aviso aviso-erro" : "aviso aviso-ok"}>
      {erro ?? ok}
    </p>
  );
}

type Params = Promise<Record<string, string | string[] | undefined>>;

export async function lerAvisos(searchParams: Params) {
  const p = await searchParams;
  const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return { erro: um(p.erro), ok: um(p.ok), params: p };
}
