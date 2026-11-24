-- =====================================================================
--  Handback · Entregas parecidas demais
--  Para cada entrega analisada, guarda só uma "impressão digital" do texto
--  (números, não o texto) e os códigos dos arquivos. Assim dá para avisar
--  quando duas equipes da mesma aula mandaram algo muito parecido.
-- =====================================================================
create table public.impressoes_entregas (
  entrega_id uuid primary key references public.entregas (id) on delete cascade,
  org_id uuid not null references public.organizacoes (id) on delete cascade,
  etapa_id uuid not null references public.etapas (id) on delete cascade,
  grupo_id uuid not null references public.grupos (id) on delete cascade,
  assinatura bigint[] not null default '{}',
  arquivos text[] not null default '{}',
  palavras integer not null default 0,
  criada_em timestamptz not null default now()
);
create index impressoes_etapa_idx on public.impressoes_entregas (etapa_id);
alter table public.impressoes_entregas enable row level security;
create policy "quem avalia ve as impressoes" on public.impressoes_entregas
  for select to authenticated using (public.pode_avaliar_org(org_id));
revoke all on public.impressoes_entregas from anon, authenticated;
grant select on public.impressoes_entregas to authenticated;
grant select, insert, update, delete on public.impressoes_entregas to service_role;
