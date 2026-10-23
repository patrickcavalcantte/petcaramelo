-- Rode este arquivo no Supabase (SQL Editor > New query > Run). Pode rodar de novo sem problema.
--
-- Os dados pertencem a uma GALERA, não a uma pessoa: o estado inteiro do app (gatos, saúde, estoque,
-- gastos) é um JSON por Galera, e as pessoas entram nela como membros (um casal vê e edita a mesma Galera).
-- Cada pessoa participa de uma Galera só. Convidar alguém gera um código de uso único, válido por 7 dias.
--
-- Toda escrita que cruza tabelas passa por função (security definer), para o app não precisar de
-- permissão de escrita direta em galeras, membros e convites.

create table if not exists public.galeras (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null default 'Galera',
  criado_por uuid references auth.users (id) on delete set null,
  criado_em  timestamptz not null default now()
);

create table if not exists public.galera_membros (
  galera_id uuid not null references public.galeras (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  entrou_em timestamptz not null default now(),
  primary key (galera_id, user_id),
  unique (user_id) -- uma Galera por pessoa
);

create table if not exists public.galera_estado (
  galera_id  uuid primary key references public.galeras (id) on delete cascade,
  state      jsonb not null,
  versao     integer not null default 1, -- trava otimista: duas pessoas gravando ao mesmo tempo
  updated_at timestamptz not null default now()
);

create table if not exists public.galera_convites (
  codigo     text primary key,
  galera_id  uuid not null references public.galeras (id) on delete cascade,
  criado_por uuid references auth.users (id) on delete set null,
  expira_em  timestamptz not null,
  usado_por  uuid references auth.users (id) on delete set null,
  usado_em   timestamptz
);

alter table public.galeras         enable row level security;
alter table public.galera_membros  enable row level security;
alter table public.galera_estado   enable row level security;
alter table public.galera_convites enable row level security; -- sem políticas: só as funções abaixo mexem

-- Sou membro desta Galera? security definer para as políticas não recaírem em recursão.
create or replace function public.sou_membro(p_galera uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.galera_membros m
    where m.galera_id = p_galera and m.user_id = (select auth.uid())
  );
$$;

drop policy if exists "membro le a galera" on public.galeras;
create policy "membro le a galera" on public.galeras
  for select to authenticated using (public.sou_membro(id));

drop policy if exists "membro le os membros" on public.galera_membros;
create policy "membro le os membros" on public.galera_membros
  for select to authenticated using (public.sou_membro(galera_id));

drop policy if exists "membro le o estado" on public.galera_estado;
create policy "membro le o estado" on public.galera_estado
  for select to authenticated using (public.sou_membro(galera_id));

drop policy if exists "membro atualiza o estado" on public.galera_estado;
create policy "membro atualiza o estado" on public.galera_estado
  for update to authenticated
  using (public.sou_membro(galera_id))
  with check (public.sou_membro(galera_id));

-- Primeira vez de uma conta: cria a Galera dela, já com o estado que ela tinha no aparelho.
-- Se já participa de uma, devolve essa. O lock evita duas Galeras se dois aparelhos entrarem juntos.
create or replace function public.obter_ou_criar_galera(p_state jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));

  select galera_id into v_id from public.galera_membros where user_id = auth.uid();
  if v_id is null then
    insert into public.galeras (criado_por) values (auth.uid()) returning id into v_id;
    insert into public.galera_membros (galera_id, user_id) values (v_id, auth.uid());
    insert into public.galera_estado (galera_id, state) values (v_id, coalesce(p_state, '{}'::jsonb));
  end if;
  return v_id;
end;
$$;

-- Grava só se a versão ainda for a que a pessoa leu. Devolve a nova versão, ou null se alguém gravou antes
-- (o app então baixa, junta e tenta de novo). security invoker: as políticas acima valem.
create or replace function public.salvar_estado(p_galera uuid, p_state jsonb, p_versao integer)
returns integer
language sql
security invoker
set search_path = ''
as $$
  update public.galera_estado
     set state = p_state, versao = versao + 1, updated_at = now()
   where galera_id = p_galera and versao = p_versao
  returning versao;
$$;

-- Quem está na Galera (e-mail para mostrar na tela).
create or replace function public.membros_da_galera(p_galera uuid)
returns table (user_id uuid, email text, sou_eu boolean)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not public.sou_membro(p_galera) then
    raise exception 'Você não participa desta Galera';
  end if;
  return query
    select m.user_id, u.email::text, m.user_id = auth.uid()
      from public.galera_membros m
      join auth.users u on u.id = m.user_id
     where m.galera_id = p_galera
     order by m.entrou_em;
end;
$$;

-- Código de convite: 8 letras/números sem caracteres confundíveis, uso único, 7 dias.
create or replace function public.criar_convite(p_galera uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32 símbolos: 256 / 32 sem viés
  v_bytes bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  v_codigo text := '';
  i integer;
begin
  if not public.sou_membro(p_galera) then
    raise exception 'Você não participa desta Galera';
  end if;
  delete from public.galera_convites where expira_em < now() - interval '30 days';
  for i in 0..7 loop
    v_codigo := v_codigo || substr(v_alfabeto, 1 + (get_byte(v_bytes, i) % 32), 1);
  end loop;
  insert into public.galera_convites (codigo, galera_id, criado_por, expira_em)
  values (v_codigo, p_galera, auth.uid(), now() + interval '7 days');
  return v_codigo;
end;
$$;

-- Entra na Galera do convite. Se a pessoa tinha uma Galera só dela, ela é descartada (o app avisa antes);
-- se a atual tem outras pessoas, recusa: é preciso sair dela primeiro.
create or replace function public.aceitar_convite(p_codigo text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo text := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
  v_convite public.galera_convites%rowtype;
  v_atual uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));

  select * into v_convite from public.galera_convites
   where codigo = v_codigo and usado_em is null and expira_em > now()
   for update;
  if not found then
    raise exception 'Convite inválido ou expirado';
  end if;

  select galera_id into v_atual from public.galera_membros where user_id = auth.uid();
  if v_atual = v_convite.galera_id then
    return v_atual;
  end if;
  if v_atual is not null then
    if exists (select 1 from public.galera_membros where galera_id = v_atual and user_id <> auth.uid()) then
      raise exception 'Você já participa de outra Galera. Saia dela antes de entrar nesta';
    end if;
    delete from public.galeras where id = v_atual; -- a Galera solitária some, com membro e estado (cascade)
  end if;

  insert into public.galera_membros (galera_id, user_id) values (v_convite.galera_id, auth.uid());
  update public.galera_convites set usado_por = auth.uid(), usado_em = now() where codigo = v_convite.codigo;
  return v_convite.galera_id;
end;
$$;

-- Sai da Galera. Se era a última pessoa, a Galera é apagada.
create or replace function public.sair_da_galera()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select galera_id into v_id from public.galera_membros where user_id = auth.uid();
  if v_id is null then
    return;
  end if;
  delete from public.galera_membros where galera_id = v_id and user_id = auth.uid();
  if not exists (select 1 from public.galera_membros where galera_id = v_id) then
    delete from public.galeras where id = v_id;
  end if;
end;
$$;

-- Só quem está logado chama as funções.
revoke all on function public.sou_membro(uuid) from public, anon;
revoke all on function public.obter_ou_criar_galera(jsonb) from public, anon;
revoke all on function public.salvar_estado(uuid, jsonb, integer) from public, anon;
revoke all on function public.membros_da_galera(uuid) from public, anon;
revoke all on function public.criar_convite(uuid) from public, anon;
revoke all on function public.aceitar_convite(text) from public, anon;
revoke all on function public.sair_da_galera() from public, anon;
grant execute on function public.sou_membro(uuid) to authenticated;
grant execute on function public.obter_ou_criar_galera(jsonb) to authenticated;
grant execute on function public.salvar_estado(uuid, jsonb, integer) to authenticated;
grant execute on function public.membros_da_galera(uuid) to authenticated;
grant execute on function public.criar_convite(uuid) to authenticated;
grant execute on function public.aceitar_convite(text) to authenticated;
grant execute on function public.sair_da_galera() to authenticated;

-- Versão anterior: uma linha de estado por usuário (app_state). Se houver dados, vira a Galera da pessoa.
do $$
declare
  r record;
  v_id uuid;
begin
  if to_regclass('public.app_state') is not null then
    for r in select user_id, state from public.app_state loop
      if not exists (select 1 from public.galera_membros where user_id = r.user_id) then
        insert into public.galeras (criado_por) values (r.user_id) returning id into v_id;
        insert into public.galera_membros (galera_id, user_id) values (v_id, r.user_id);
        insert into public.galera_estado (galera_id, state) values (v_id, r.state);
      end if;
    end loop;
    drop table public.app_state;
  end if;
end;
$$;
