-- =====================================================================
--  Handback · Fase 1 (Cadastros)
--  Etapas (aulas, ciclos, competências…) com checklist, grupos (equipes,
--  times, clientes…) com os e-mails de quem entrega, e a gestão de pessoas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Permissões auxiliares
-- ---------------------------------------------------------------------

-- Quem avalia: dono da plataforma, administradores e avaliadores da empresa.
create function public.pode_avaliar_org(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.e_admin_plataforma()
      or coalesce(public.papel_na_org(org) in ('admin', 'avaliador'), false);
$$;

-- Qualquer pessoa da empresa (ou o dono da plataforma).
create function public.ve_org(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.e_admin_plataforma() or public.papel_na_org(org) is not null;
$$;

-- ---------------------------------------------------------------------
-- Etapas (o que no protótipo era "Aulas")
-- ---------------------------------------------------------------------
create type public.status_etapa as enum ('planejada', 'recebendo', 'analisada', 'concluida');

create table public.etapas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes (id) on delete cascade,
  numero integer not null check (numero between 1 and 9999),
  titulo text not null check (length(trim(titulo)) between 2 and 200),
  data date,
  recebe_de date,
  recebe_ate date,
  entregaveis text[] not null default '{}' check (cardinality(entregaveis) <= 50),
  criterios text not null default '' check (length(criterios) <= 5000),
  observacoes_ia text not null default '' check (length(observacoes_ia) <= 5000),
  status public.status_etapa not null default 'planejada',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (org_id, numero),
  check (recebe_de is null or recebe_ate is null or recebe_de <= recebe_ate)
);
create index etapas_org_idx on public.etapas (org_id, numero);

-- ---------------------------------------------------------------------
-- Grupos (o que no protótipo era "Equipes") e quem entrega por eles
-- ---------------------------------------------------------------------
create table public.grupos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes (id) on delete cascade,
  nome text not null check (length(trim(nome)) between 1 and 120),
  tema text not null default '' check (length(tema) <= 1000),
  observacoes text not null default '' check (length(observacoes) <= 2000),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index grupos_nome_unico on public.grupos (org_id, lower(trim(nome)));

create table public.integrantes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes (id) on delete cascade,
  grupo_id uuid not null references public.grupos (id) on delete cascade,
  email text not null check (email = lower(trim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  nome text not null default '',
  criado_em timestamptz not null default now(),
  -- Um e-mail entrega por um único grupo dentro da mesma empresa
  -- (é assim que o Handback sabe de quem é cada entrega).
  unique (org_id, email)
);
create index integrantes_grupo_idx on public.integrantes (grupo_id);

-- O integrante precisa ser da mesma empresa do grupo.
create function public.integrante_mesma_org()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.grupos g where g.id = new.grupo_id and g.org_id = new.org_id) then
    raise exception 'O grupo não pertence a esta empresa.';
  end if;
  return new;
end;
$$;

create trigger integrantes_mesma_org
  before insert or update on public.integrantes
  for each row execute function public.integrante_mesma_org();

-- Guarda a data da última alteração.
create function public.marca_atualizacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger etapas_atualizado before update on public.etapas
  for each row execute function public.marca_atualizacao();
create trigger grupos_atualizado before update on public.grupos
  for each row execute function public.marca_atualizacao();

-- ---------------------------------------------------------------------
-- Regras de acesso
-- ---------------------------------------------------------------------
alter table public.etapas enable row level security;
alter table public.grupos enable row level security;
alter table public.integrantes enable row level security;

-- Etapas: toda a empresa vê; só quem gere a empresa altera.
create policy "empresa ve etapas" on public.etapas
  for select to authenticated using (public.ve_org(org_id));
create policy "gestores criam etapas" on public.etapas
  for insert to authenticated with check (public.pode_gerir_org(org_id));
create policy "gestores editam etapas" on public.etapas
  for update to authenticated using (public.pode_gerir_org(org_id)) with check (public.pode_gerir_org(org_id));
create policy "gestores apagam etapas" on public.etapas
  for delete to authenticated using (public.pode_gerir_org(org_id));

-- Grupos e integrantes: quem avalia vê (têm e-mails); só quem gere altera.
create policy "avaliadores veem grupos" on public.grupos
  for select to authenticated using (public.pode_avaliar_org(org_id));
create policy "gestores criam grupos" on public.grupos
  for insert to authenticated with check (public.pode_gerir_org(org_id));
create policy "gestores editam grupos" on public.grupos
  for update to authenticated using (public.pode_gerir_org(org_id)) with check (public.pode_gerir_org(org_id));
create policy "gestores apagam grupos" on public.grupos
  for delete to authenticated using (public.pode_gerir_org(org_id));

create policy "avaliadores veem integrantes" on public.integrantes
  for select to authenticated using (public.pode_avaliar_org(org_id));
create policy "gestores criam integrantes" on public.integrantes
  for insert to authenticated with check (public.pode_gerir_org(org_id));
create policy "gestores editam integrantes" on public.integrantes
  for update to authenticated using (public.pode_gerir_org(org_id)) with check (public.pode_gerir_org(org_id));
create policy "gestores apagam integrantes" on public.integrantes
  for delete to authenticated using (public.pode_gerir_org(org_id));

-- ---------------------------------------------------------------------
-- Pessoas da empresa (com e-mail), só para quem gere a empresa
-- ---------------------------------------------------------------------
create function public.pessoas_da_org(org uuid)
returns table (user_id uuid, email text, papel public.papel, criado_em timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, u.email::text, m.papel, m.criado_em
  from public.membros m
  join auth.users u on u.id = m.user_id
  where m.org_id = org and public.pode_gerir_org(org)
  order by u.email;
$$;

revoke execute on function public.pessoas_da_org(uuid) from public, anon;
grant execute on function public.pessoas_da_org(uuid) to authenticated;

-- Uma empresa nunca fica sem administrador (a não ser pelo dono da plataforma).
create function public.protege_ultimo_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.papel = 'admin'
     and (tg_op = 'DELETE' or new.papel <> 'admin')
     and auth.uid() is not null          -- operações do sistema (ex.: apagar conta) passam
     and not public.e_admin_plataforma()
     and not exists (
       select 1 from public.membros m
       where m.org_id = old.org_id and m.papel = 'admin' and m.user_id <> old.user_id
     ) then
    raise exception 'A empresa precisa de pelo menos um administrador.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger membros_protege_ultimo_admin
  before update or delete on public.membros
  for each row execute function public.protege_ultimo_admin();

-- ---------------------------------------------------------------------
-- Vocabulário: o admin pode mudar as palavras, mas sem apagar nenhuma.
-- ---------------------------------------------------------------------
alter table public.organizacoes
  add constraint vocabulario_completo check (
    vocabulario ?& array['etapa', 'etapas', 'avaliador', 'avaliadores', 'grupo', 'grupos']
  );

-- ---------------------------------------------------------------------
-- Ajuste da Fase 0: comandos rodados direto no Supabase (SQL Editor, sem
-- usuário logado) podem mudar status, endereço e frente da empresa.
-- No app, isso continua restrito ao dono da plataforma.
-- ---------------------------------------------------------------------
create or replace function public.protege_campos_da_org()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and not public.e_admin_plataforma()
     and (new.ativa is distinct from old.ativa or new.slug is distinct from old.slug
          or new.frente is distinct from old.frente) then
    raise exception 'Só o dono da plataforma pode mudar endereço, frente ou status da empresa.';
  end if;
  return new;
end;
$$;
