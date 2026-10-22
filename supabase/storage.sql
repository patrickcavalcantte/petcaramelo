-- Rode uma vez no Supabase. Bucket privado para laudos, receitas e carteirinhas.
-- Caminho dos arquivos: <user_id>/<gato_id>/<uuid>.<ext>
-- A primeira pasta é o dono; as políticas abaixo dependem disso.
-- (Se você já rodou 0002_storage.sql da versão anterior, o bucket e as políticas já existem: não precisa rodar de novo.)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos',
  'documentos',
  false,
  10485760, -- 10 MB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

create policy "documentos_ler_proprios" on storage.objects
  for select to authenticated
  using (bucket_id = 'documentos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "documentos_enviar_proprios" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "documentos_apagar_proprios" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documentos' and (storage.foldername(name))[1] = (select auth.uid())::text);
