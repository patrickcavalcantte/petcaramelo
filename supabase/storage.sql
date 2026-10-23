-- Rode uma vez no Supabase. Bucket privado para laudos, receitas e carteirinhas.
-- Caminho dos arquivos: <user_id>/<gato_id>/<uuid>.<ext>
-- A primeira pasta é o dono; as políticas abaixo dependem disso.
-- Pode ser rodado de novo sem problema (recria as políticas).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos',
  'documentos',
  false,
  10485760, -- 10 MB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

drop policy if exists "documentos_ler_proprios" on storage.objects;
create policy "documentos_ler_proprios" on storage.objects
  for select to authenticated
  using (bucket_id = 'documentos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "documentos_enviar_proprios" on storage.objects;
create policy "documentos_enviar_proprios" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "documentos_apagar_proprios" on storage.objects;
create policy "documentos_apagar_proprios" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documentos' and (storage.foldername(name))[1] = (select auth.uid())::text);
