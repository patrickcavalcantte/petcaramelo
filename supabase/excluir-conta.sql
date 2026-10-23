-- Rode no Supabase depois do schema.sql. Pode rodar de novo sem problema.
-- Permite que cada pessoa exclua a própria conta pelo app.
--
-- Os arquivos do Storage são apagados pelo app antes desta chamada (o Supabase não deixa apagar arquivos
-- direto por SQL), e só quando a pessoa é a única da Galera: se há mais gente, os documentos são deles também.
-- Sair da Galera vem primeiro: se era a última pessoa, a Galera e o estado dela somem junto.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  perform public.sair_da_galera();
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
