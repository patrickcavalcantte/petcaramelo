-- Gatil: schema inicial
-- Convenções:
--   * todo registro pertence a um usuário (user_id) e é protegido por RLS;
--   * chaves estrangeiras compostas (id, user_id) impedem que um registro
--     aponte para dados de outra conta, mesmo conhecendo o UUID
--     (FKs ignoram RLS, então sem isso a proteção teria uma brecha);
--   * dinheiro em centavos (integer), datas de calendário em `date`.

-- ---------------------------------------------------------------------------
-- Gatos
-- ---------------------------------------------------------------------------
create table public.gatos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome        text not null check (char_length(btrim(nome)) between 1 and 60),
  nascimento  date,
  sexo        text check (sexo in ('macho', 'femea')),
  castrado    boolean not null default false,
  descricao   text check (char_length(descricao) <= 200),
  microchip   text check (char_length(microchip) <= 40),
  observacoes text check (char_length(observacoes) <= 2000),
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now(),
  unique (id, user_id)
);

-- Nomes únicos por conta, sem diferenciar maiúsculas: evita "Mingau" e "mingau".
create unique index gatos_nome_unico on public.gatos (user_id, lower(btrim(nome)));

-- ---------------------------------------------------------------------------
-- Gastos (vem antes de eventos/estoque porque ambos referenciam gastos)
-- ---------------------------------------------------------------------------
create table public.gastos (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data           date not null default current_date,
  valor_centavos integer not null check (valor_centavos > 0 and valor_centavos <= 100000000),
  categoria      text not null check (categoria in (
                   'racao', 'areia', 'remedio', 'consulta', 'exame',
                   'vacina', 'cirurgia', 'petisco', 'higiene', 'outro')),
  descricao      text check (char_length(descricao) <= 200),
  loja           text check (char_length(loja) <= 80),
  gato_id        uuid,
  criado_em      timestamptz not null default now(),
  unique (id, user_id),
  foreign key (gato_id, user_id) references public.gatos (id, user_id)
    on delete set null (gato_id)
);

create index gastos_user_data on public.gastos (user_id, data desc);

-- ---------------------------------------------------------------------------
-- Eventos de saúde
-- ---------------------------------------------------------------------------
create table public.eventos_saude (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  gato_id      uuid not null,
  tipo         text not null check (tipo in (
                 'vacina', 'vermifugo', 'antipulgas', 'consulta', 'exame',
                 'medicacao', 'pesagem', 'cirurgia', 'outro')),
  data         date not null,
  titulo       text not null check (char_length(btrim(titulo)) between 1 and 120),
  detalhes     text check (char_length(detalhes) <= 4000),
  peso_kg      numeric(5, 2) check (peso_kg > 0 and peso_kg < 30),
  proxima_data date,
  gasto_id     uuid,
  criado_em    timestamptz not null default now(),
  unique (id, user_id),
  foreign key (gato_id, user_id) references public.gatos (id, user_id) on delete cascade,
  foreign key (gasto_id, user_id) references public.gastos (id, user_id)
    on delete set null (gasto_id),
  check (proxima_data is null or proxima_data > data),
  check (tipo <> 'pesagem' or peso_kg is not null)
);

create index eventos_gato_data on public.eventos_saude (gato_id, data desc);
create index eventos_user_proxima on public.eventos_saude (user_id, proxima_data)
  where proxima_data is not null;

-- ---------------------------------------------------------------------------
-- Anexos (PDFs e fotos de laudos, receitas, carteirinhas)
-- O arquivo vive no Storage; aqui fica só o metadado.
-- ---------------------------------------------------------------------------
create table public.anexos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  gato_id       uuid not null,
  evento_id     uuid,
  storage_path  text not null unique,
  nome_arquivo  text not null check (char_length(nome_arquivo) <= 200),
  mime          text not null,
  tamanho_bytes integer not null check (tamanho_bytes > 0),
  criado_em     timestamptz not null default now(),
  foreign key (gato_id, user_id) references public.gatos (id, user_id) on delete cascade,
  foreign key (evento_id, user_id) references public.eventos_saude (id, user_id) on delete cascade,
  -- o caminho precisa começar com a pasta do dono: "<user_id>/..."
  check (split_part(storage_path, '/', 1) = user_id::text)
);

create index anexos_gato on public.anexos (gato_id);

-- ---------------------------------------------------------------------------
-- Estoque
-- Não guardamos "quantidade atual": ela é estimada a partir de contagens,
-- compras e do consumo diário. Assim ninguém precisa dar baixa todo dia.
-- ---------------------------------------------------------------------------
create table public.itens_estoque (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome           text not null check (char_length(btrim(nome)) between 1 and 80),
  categoria      text not null check (categoria in ('racao', 'areia', 'outro')),
  unidade        text not null check (unidade in ('kg', 'l', 'un')),
  consumo_diario numeric(8, 3) not null default 0 check (consumo_diario >= 0),
  alerta_dias    integer not null default 7 check (alerta_dias between 0 and 90),
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  unique (id, user_id)
);

create unique index itens_nome_unico on public.itens_estoque (user_id, lower(btrim(nome)));

create table public.movimentos_estoque (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id    uuid not null,
  tipo       text not null check (tipo in ('compra', 'contagem')),
  quantidade numeric(10, 3) not null check (quantidade >= 0),
  data       date not null default current_date,
  gasto_id   uuid,
  criado_em  timestamptz not null default now(),
  foreign key (item_id, user_id) references public.itens_estoque (id, user_id) on delete cascade,
  foreign key (gasto_id, user_id) references public.gastos (id, user_id)
    on delete set null (gasto_id),
  check (tipo <> 'compra' or quantidade > 0)
);

create index movimentos_item_data on public.movimentos_estoque (item_id, data, criado_em);

-- ---------------------------------------------------------------------------
-- RLS: cada pessoa só enxerga e altera o que é seu.
-- `(select auth.uid())` é avaliado uma vez por consulta (recomendação do Supabase).
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['gatos', 'gastos', 'eventos_saude', 'anexos', 'itens_estoque', 'movimentos_estoque']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t || '_dono', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Funções transacionais (security invoker: rodam com as permissões e o RLS
-- de quem chama). Usadas quando uma ação cria registros em mais de uma tabela.
-- ---------------------------------------------------------------------------

-- Registra uma compra de estoque e, se houver valor, o gasto correspondente.
create function public.registrar_compra(
  p_item_id uuid,
  p_quantidade numeric,
  p_data date,
  p_valor_centavos integer default null,
  p_loja text default null
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_categoria text;
  v_nome text;
  v_gasto_id uuid;
  v_mov_id uuid;
begin
  select i.categoria, i.nome into v_categoria, v_nome
  from public.itens_estoque i
  where i.id = p_item_id;

  if not found then
    raise exception 'Item de estoque não encontrado' using errcode = 'P0002';
  end if;

  if p_valor_centavos is not null then
    insert into public.gastos (data, valor_centavos, categoria, descricao, loja)
    values (p_data, p_valor_centavos, v_categoria, v_nome, nullif(btrim(p_loja), ''))
    returning id into v_gasto_id;
  end if;

  insert into public.movimentos_estoque (item_id, tipo, quantidade, data, gasto_id)
  values (p_item_id, 'compra', p_quantidade, p_data, v_gasto_id)
  returning id into v_mov_id;

  return v_mov_id;
end;
$$;

-- Registra o mesmo evento para um ou mais gatos (ex.: vermífugo na colônia
-- toda) e, se houver valor, um único gasto. O gasto fica ligado ao gato
-- apenas quando o evento é de um gato só.
create function public.registrar_eventos(
  p_gato_ids uuid[],
  p_tipo text,
  p_data date,
  p_titulo text,
  p_detalhes text default null,
  p_peso_kg numeric default null,
  p_proxima_data date default null,
  p_valor_centavos integer default null,
  p_loja text default null
) returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_qtd integer := coalesce(array_length(p_gato_ids, 1), 0);
  v_gasto_id uuid;
  v_categoria text;
  v_inseridos integer;
begin
  if v_qtd = 0 then
    raise exception 'Selecione pelo menos um gato' using errcode = '22023';
  end if;

  if p_peso_kg is not null and v_qtd > 1 then
    raise exception 'Peso só pode ser registrado para um gato por vez' using errcode = '22023';
  end if;

  if p_valor_centavos is not null then
    v_categoria := case p_tipo
      when 'vacina' then 'vacina'
      when 'consulta' then 'consulta'
      when 'exame' then 'exame'
      when 'cirurgia' then 'cirurgia'
      when 'medicacao' then 'remedio'
      when 'vermifugo' then 'remedio'
      when 'antipulgas' then 'remedio'
      else 'outro'
    end;

    insert into public.gastos (data, valor_centavos, categoria, descricao, loja, gato_id)
    values (
      p_data, p_valor_centavos, v_categoria, btrim(p_titulo), nullif(btrim(p_loja), ''),
      case when v_qtd = 1 then p_gato_ids[1] end
    )
    returning id into v_gasto_id;
  end if;

  insert into public.eventos_saude
    (gato_id, tipo, data, titulo, detalhes, peso_kg, proxima_data, gasto_id)
  select g, p_tipo, p_data, btrim(p_titulo), nullif(btrim(p_detalhes), ''),
         p_peso_kg, p_proxima_data, v_gasto_id
  from unnest(p_gato_ids) as g;

  get diagnostics v_inseridos = row_count;
  return v_inseridos;
end;
$$;

revoke execute on function public.registrar_compra(uuid, numeric, date, integer, text) from public, anon;
revoke execute on function public.registrar_eventos(uuid[], text, date, text, text, numeric, date, integer, text) from public, anon;
grant execute on function public.registrar_compra(uuid, numeric, date, integer, text) to authenticated;
grant execute on function public.registrar_eventos(uuid[], text, date, text, text, numeric, date, integer, text) to authenticated;
