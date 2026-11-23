-- =====================================================================
--  Handback · Avisos e lembretes
--  - avisos: o sininho de cada pessoa (entrega nova, análise pronta,
--    prazo chegando, atraso, devolutiva enviada por um colega).
--  - preferências: como cada pessoa quer saber (resumo do dia por
--    e-mail, notificação no celular) e de quê.
--  - lembretes de prazo para os alunos, por turma, enviados uma vez por
--    dia pelo Gmail de quem ligou.
-- =====================================================================

create table public.avisos (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid not null references public.organizacoes (id) on delete cascade,
  tipo text not null check (tipo in ('entrega', 'ia', 'prazo', 'atraso', 'enviada', 'sistema')),
  titulo text not null check (length(titulo) <= 200),
  texto text not null default '' check (length(texto) <= 500),
  link text not null default '' check (link = '' or link ~ '^/app/'),
  criado_em timestamptz not null default now(),
  lido_em timestamptz,
  push_em timestamptz
);
create index avisos_user_idx on public.avisos (user_id, criado_em desc);
create index avisos_push_idx on public.avisos (criado_em) where push_em is null;
alter table public.avisos enable row level security;
revoke all on public.avisos from anon, authenticated;
grant select, update (lido_em) on public.avisos to authenticated;
grant select, insert, update, delete on public.avisos to service_role;
create policy "cada um ve os seus avisos" on public.avisos
  for select to authenticated using (user_id = auth.uid());
create policy "cada um marca os seus como lidos" on public.avisos
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.preferencias_avisos (
  user_id uuid primary key references auth.users (id) on delete cascade,
  resumo_email boolean not null default true,
  celular boolean not null default false,
  tipos text[] not null default '{entrega,ia,prazo,atraso}'
    check (tipos <@ array['entrega', 'ia', 'prazo', 'atraso', 'enviada']::text[]),
  atualizado_em timestamptz not null default now()
);
alter table public.preferencias_avisos enable row level security;
revoke all on public.preferencias_avisos from anon, authenticated;
grant select, insert, update on public.preferencias_avisos to authenticated;
grant select on public.preferencias_avisos to service_role;
create policy "cada um ve as suas preferencias" on public.preferencias_avisos
  for select to authenticated using (user_id = auth.uid());
create policy "cada um cria as suas preferencias" on public.preferencias_avisos
  for insert to authenticated with check (user_id = auth.uid());
create policy "cada um muda as suas preferencias" on public.preferencias_avisos
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Aparelhos que recebem notificação (Web Push). Só o servidor lê.
create table public.aparelhos_push (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh text not null check (length(p256dh) <= 200),
  auth text not null check (length(auth) <= 100),
  criado_em timestamptz not null default now()
);
create index aparelhos_push_user_idx on public.aparelhos_push (user_id);
alter table public.aparelhos_push enable row level security;
revoke all on public.aparelhos_push from anon, authenticated;
grant select, insert, update, delete on public.aparelhos_push to service_role;

-- Chaves do Web Push do Handback (geradas uma vez pelo servidor; a privada fica cifrada).
create table public.config_plataforma (
  chave text primary key,
  valor text not null,
  criado_em timestamptz not null default now()
);
alter table public.config_plataforma enable row level security;
revoke all on public.config_plataforma from anon, authenticated;
grant select, insert on public.config_plataforma to service_role;

-- Lembretes de prazo para os alunos (por turma)
alter table public.turmas
  add column lembrete_abre boolean not null default false,
  add column lembrete_dois_dias boolean not null default false,
  add column lembrete_no_dia boolean not null default false,
  add column lembrete_por uuid references auth.users (id) on delete set null;

create table public.lembretes_enviados (
  etapa_id uuid not null references public.etapas (id) on delete cascade,
  grupo_id uuid not null references public.grupos (id) on delete cascade,
  tipo text not null check (tipo in ('abre', 'dois_dias', 'no_dia')),
  enviado_em timestamptz not null default now(),
  ok boolean not null default true,
  erro text not null default '',
  primary key (etapa_id, grupo_id, tipo)
);
alter table public.lembretes_enviados enable row level security;
revoke all on public.lembretes_enviados from anon, authenticated;
grant select, insert, update on public.lembretes_enviados to service_role;

-- Um resumo por pessoa por dia, no máximo.
create table public.resumos_enviados (
  user_id uuid not null references auth.users (id) on delete cascade,
  dia date not null,
  enviado_em timestamptz not null default now(),
  primary key (user_id, dia)
);
alter table public.resumos_enviados enable row level security;
revoke all on public.resumos_enviados from anon, authenticated;
grant select, insert on public.resumos_enviados to service_role;

-- ---------------------------------------------------------------------
-- Criar avisos para quem avalia na turma (respeitando as preferências)
-- ---------------------------------------------------------------------
create function public.avisar_equipe(p_org uuid, p_tipo text, p_titulo text, p_texto text, p_link text, p_menos uuid default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.avisos (user_id, org_id, tipo, titulo, texto, link)
  select m.user_id, p_org, p_tipo, left(p_titulo, 200), left(coalesce(p_texto, ''), 500), coalesce(p_link, '')
  from public.membros m
  left join public.preferencias_avisos p on p.user_id = m.user_id
  where m.org_id = p_org
    and m.papel in ('admin', 'avaliador')
    and m.user_id is distinct from p_menos
    and p_tipo = any (coalesce(p.tipos, '{entrega,ia,prazo,atraso}'::text[]));
$$;
revoke execute on function public.avisar_equipe(uuid, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.avisar_equipe(uuid, text, text, text, text, uuid) to service_role;

create function public.aviso_de_entrega()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
  v_grupo text;
  v_etapa text;
begin
  select o.slug into v_slug from public.organizacoes o where o.id = new.org_id;
  select g.nome into v_grupo from public.grupos g where g.id = new.grupo_id;
  select e.titulo into v_etapa from public.etapas e where e.id = new.etapa_id;
  perform public.avisar_equipe(
    new.org_id,
    case when new.atrasada then 'atraso' else 'entrega' end,
    coalesce(v_grupo, 'Uma equipe') || case when new.atrasada then ' entregou com atraso' else ' entregou' end,
    coalesce(v_etapa, ''),
    '/app/' || v_slug || '/entregas/' || new.id,
    new.registrada_por
  );
  return new;
end;
$$;
create trigger avisos_entrega after insert on public.entregas
  for each row execute function public.aviso_de_entrega();

create function public.aviso_de_analise()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
  v_grupo text;
  v_etapa text;
  v_por uuid;
begin
  select o.slug into v_slug from public.organizacoes o where o.id = new.org_id;
  select g.nome, e.titulo into v_grupo, v_etapa
    from public.entregas x join public.grupos g on g.id = x.grupo_id join public.etapas e on e.id = x.etapa_id
    where x.id = new.entrega_id;
  if new.status = 'pronta' and old.status is distinct from 'pronta' then
    perform public.avisar_equipe(new.org_id, 'ia', 'Análise pronta: ' || coalesce(v_grupo, ''),
      coalesce(v_etapa, '') || case when new.conceito_ia is not null then ' · conceito ' || new.conceito_ia else '' end || '. Falta revisar.',
      '/app/' || v_slug || '/entregas/' || new.entrega_id, new.iniciada_por);
  elsif new.envio_status = 'enviada' and old.envio_status is distinct from 'enviada' then
    v_por := new.enviada_por;
    perform public.avisar_equipe(new.org_id, 'enviada',
      'Devolutiva enviada: ' || coalesce(v_grupo, ''),
      coalesce(v_etapa, '') || coalesce(' · por ' || (select u.email from auth.users u where u.id = v_por), ''),
      '/app/' || v_slug || '/entregas/' || new.entrega_id, v_por);
  end if;
  return new;
end;
$$;
create trigger avisos_analise after update of status, envio_status on public.analises
  for each row execute function public.aviso_de_analise();
