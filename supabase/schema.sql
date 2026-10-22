-- Rode este arquivo uma vez no Supabase: SQL Editor > New query > Run.
-- Uma linha por usuário, com o estado inteiro do app em JSON (gatos, saúde, estoque, gastos).
-- Se este projeto ainda tem as tabelas da versão Next.js (gatos, eventos_saude, ...), elas não são
-- mais usadas e podem ser apagadas depois de conferir que nada ali precisa ser aproveitado.

create table if not exists public.app_state (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  state      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

-- Cada conta só enxerga e altera a própria linha.
create policy "le o proprio estado" on public.app_state
  for select to authenticated using (user_id = (select auth.uid()));

create policy "cria o proprio estado" on public.app_state
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy "atualiza o proprio estado" on public.app_state
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
