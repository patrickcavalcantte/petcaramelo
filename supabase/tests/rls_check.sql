-- Verificação de isolamento entre contas e das funções transacionais.
-- Roda dentro de uma transação e desfaz tudo no fim.
-- Uso (Supabase local):  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_check.sql
-- Qualquer falha interrompe o script com uma mensagem "FALHOU: ...".

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@teste.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@teste.local');

-- Helper: troca o usuário "logado" da sessão.
create function pg_temp.logar(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), true);
end $$;

set local role authenticated;

-- ---------------------------------------------------------------- conta A
select pg_temp.logar('00000000-0000-0000-0000-00000000000a') \gset

insert into public.gatos (id, nome) values
  ('10000000-0000-0000-0000-000000000001', 'Frajola'),
  ('10000000-0000-0000-0000-000000000002', 'Mingau');

-- nome duplicado ignorando caixa deve falhar
do $$ begin
  insert into public.gatos (nome) values ('  frajola ');
  raise exception 'FALHOU: aceitou nome duplicado';
exception when unique_violation then null;
end $$;

-- evento em lote para os dois gatos, com um único gasto
do $$
declare n int; g int;
begin
  n := public.registrar_eventos(
    array['10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002']::uuid[],
    'vermifugo', '2026-10-01', 'Drontal', null, null, '2027-01-01', 9000, 'Petshop');
  if n <> 2 then raise exception 'FALHOU: esperava 2 eventos, veio %', n; end if;
  select count(*) into g from public.gastos;
  if g <> 1 then raise exception 'FALHOU: esperava 1 gasto, veio %', g; end if;
  if (select gato_id from public.gastos) is not null then
    raise exception 'FALHOU: gasto de lote não deveria ter gato';
  end if;
end $$;

-- peso em lote é recusado
do $$ begin
  perform public.registrar_eventos(
    array['10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002']::uuid[],
    'pesagem', '2026-10-01', 'Pesagem', null, 4.2, null, null, null);
  raise exception 'FALHOU: aceitou peso em lote';
exception when invalid_parameter_value then null;
end $$;

-- estoque: compra com valor gera gasto de categoria do item
insert into public.itens_estoque (id, nome, categoria, unidade, consumo_diario)
values ('20000000-0000-0000-0000-000000000001', 'Areia de sílica', 'areia', 'kg', 1.5);

do $$ begin
  perform public.registrar_compra('20000000-0000-0000-0000-000000000001', 12, '2026-10-02', 15990, 'Loja X');
  if not exists (select 1 from public.gastos where categoria = 'areia' and valor_centavos = 15990) then
    raise exception 'FALHOU: compra não gerou gasto de areia';
  end if;
end $$;

-- ---------------------------------------------------------------- conta B
select pg_temp.logar('00000000-0000-0000-0000-00000000000b') \gset

do $$ begin
  if (select count(*) from public.gatos) <> 0 then raise exception 'FALHOU: B vê gatos de A'; end if;
  if (select count(*) from public.gastos) <> 0 then raise exception 'FALHOU: B vê gastos de A'; end if;
  if (select count(*) from public.eventos_saude) <> 0 then raise exception 'FALHOU: B vê eventos de A'; end if;
  if (select count(*) from public.movimentos_estoque) <> 0 then raise exception 'FALHOU: B vê estoque de A'; end if;
end $$;

-- B tenta apagar/alterar dados de A: não afeta nada
update public.gatos set nome = 'hackeado';
delete from public.gastos;

-- B tenta criar evento apontando para gato de A (conhece o UUID): FK composta barra
do $$ begin
  insert into public.eventos_saude (gato_id, tipo, data, titulo)
  values ('10000000-0000-0000-0000-000000000001', 'consulta', '2026-10-03', 'Invasão');
  raise exception 'FALHOU: B criou evento no gato de A';
exception when foreign_key_violation then null;
end $$;

-- B tenta forjar user_id de A: RLS barra
do $$ begin
  insert into public.gatos (user_id, nome) values ('00000000-0000-0000-0000-00000000000a', 'Intruso');
  raise exception 'FALHOU: B inseriu com user_id de A';
exception when insufficient_privilege then null;
end $$;

-- B tenta registrar compra no item de A pela função: não encontra
do $$ begin
  perform public.registrar_compra('20000000-0000-0000-0000-000000000001', 5, '2026-10-03');
  raise exception 'FALHOU: B comprou no item de A';
exception when no_data_found then null;
end $$;

-- anexo com caminho fora da pasta do dono é recusado
do $$ begin
  insert into public.gatos (id, nome) values ('10000000-0000-0000-0000-0000000000b1', 'Tigrão');
  insert into public.anexos (gato_id, storage_path, nome_arquivo, mime, tamanho_bytes)
  values ('10000000-0000-0000-0000-0000000000b1',
          '00000000-0000-0000-0000-00000000000a/x/laudo.pdf', 'laudo.pdf', 'application/pdf', 1000);
  raise exception 'FALHOU: aceitou anexo na pasta de outra conta';
exception when check_violation then null;
end $$;

-- ---------------------------------------------------------------- volta para A
select pg_temp.logar('00000000-0000-0000-0000-00000000000a') \gset

do $$ begin
  if (select count(*) from public.gatos where nome = 'hackeado') <> 0 then
    raise exception 'FALHOU: B alterou gato de A';
  end if;
  if (select count(*) from public.gastos) <> 2 then
    raise exception 'FALHOU: B apagou gastos de A';
  end if;
end $$;

-- apagar gato remove eventos (cascade) e desliga gasto (set null), sem apagar o gasto
do $$ begin
  insert into public.gastos (id, valor_centavos, categoria, gato_id)
  values ('30000000-0000-0000-0000-000000000001', 5000, 'consulta', '10000000-0000-0000-0000-000000000002');
  delete from public.gatos where id = '10000000-0000-0000-0000-000000000002';
  if exists (select 1 from public.eventos_saude where gato_id = '10000000-0000-0000-0000-000000000002') then
    raise exception 'FALHOU: eventos do gato apagado ficaram';
  end if;
  if (select gato_id from public.gastos where id = '30000000-0000-0000-0000-000000000001') is not null then
    raise exception 'FALHOU: gasto continuou ligado ao gato apagado';
  end if;
end $$;

-- sem login não enxerga nada
select pg_temp.logar(null) \gset
do $$ begin
  if (select count(*) from public.gatos) <> 0 then raise exception 'FALHOU: anônimo vê gatos'; end if;
end $$;

reset role;
rollback;

\echo 'rls_check: tudo certo'
