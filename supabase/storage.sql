-- Rode no Supabase depois do schema.sql. Pode rodar de novo sem problema.
-- Bucket privado para laudos, receitas e carteirinhas.
-- Caminho dos arquivos: <galera_id>/<gato_id>/<uuid>.<ext>
-- A primeira pasta é a Galera: qualquer membro dela lê, envia e apaga; ninguém mais.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos',
  'documentos',
  false,
  10485760, -- 10 MB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

-- A pasta precisa ser um UUID antes de virar uuid (o case evita erro de conversão em caminhos estranhos).
create or replace function public.pasta_e_minha(p_nome text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select case
    when (storage.foldername(p_nome))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.sou_membro(((storage.foldername(p_nome))[1])::uuid)
    else false
  end;
$$;

revoke all on function public.pasta_e_minha(text) from public, anon;
grant execute on function public.pasta_e_minha(text) to authenticated;

drop policy if exists "documentos_ler_proprios" on storage.objects;
drop policy if exists "documentos_enviar_proprios" on storage.objects;
drop policy if exists "documentos_apagar_proprios" on storage.objects;
drop policy if exists "documentos_ler_galera" on storage.objects;
drop policy if exists "documentos_enviar_galera" on storage.objects;
drop policy if exists "documentos_apagar_galera" on storage.objects;

create policy "documentos_ler_galera" on storage.objects
  for select to authenticated
  using (bucket_id = 'documentos' and public.pasta_e_minha(name));

create policy "documentos_enviar_galera" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentos' and public.pasta_e_minha(name));

create policy "documentos_apagar_galera" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documentos' and public.pasta_e_minha(name));
