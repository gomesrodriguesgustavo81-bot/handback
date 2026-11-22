-- =====================================================================
--  Handback · Fase 0 (Fundação)
--  Empresas (organizações), membros, convites e o dono da plataforma.
--
--  Regra de ouro: cada empresa só enxerga os próprios dados. Isso é
--  garantido aqui no banco (Row Level Security), e não só nas telas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.frente as enum ('educacao', 'empresa', 'consultoria', 'escritorio');
create type public.papel as enum ('admin', 'avaliador', 'participante');

-- ---------------------------------------------------------------------
-- Vocabulário padrão de cada frente
-- (a empresa pode mudar depois; fica guardado em organizacoes.vocabulario)
-- ---------------------------------------------------------------------
create function public.vocabulario_padrao(f public.frente)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case f
    when 'educacao' then jsonb_build_object(
      'etapa', 'Aula', 'etapas', 'Aulas',
      'avaliador', 'Professor', 'avaliadores', 'Professores',
      'grupo', 'Equipe', 'grupos', 'Equipes')
    when 'empresa' then jsonb_build_object(
      'etapa', 'Ciclo', 'etapas', 'Ciclos',
      'avaliador', 'Gestor', 'avaliadores', 'Gestores',
      'grupo', 'Time', 'grupos', 'Times')
    when 'consultoria' then jsonb_build_object(
      'etapa', 'Etapa', 'etapas', 'Etapas',
      'avaliador', 'Revisor', 'avaliadores', 'Revisores',
      'grupo', 'Equipe de projeto', 'grupos', 'Equipes de projeto')
    when 'escritorio' then jsonb_build_object(
      'etapa', 'Competência', 'etapas', 'Competências',
      'avaliador', 'Responsável', 'avaliadores', 'Responsáveis',
      'grupo', 'Cliente', 'grupos', 'Clientes')
  end;
$$;

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------

-- Quem administra a plataforma inteira (o dono do Handback).
create table public.administradores_plataforma (
  user_id uuid primary key references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now()
);

-- Cada empresa cliente.
create table public.organizacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  frente public.frente not null,
  vocabulario jsonb not null,
  ativa boolean not null default true,
  criada_em timestamptz not null default now()
);

-- Quem faz parte de cada empresa, e com qual papel.
create table public.membros (
  org_id uuid not null references public.organizacoes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  papel public.papel not null,
  criado_em timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index membros_user_idx on public.membros (user_id);

-- Convites por e-mail. Quando a pessoa entra com esse e-mail, vira membro.
create table public.convites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes (id) on delete cascade,
  email text not null check (email = lower(trim(email)) and email like '%_@_%'),
  papel public.papel not null,
  criado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  aceito_em timestamptz,
  unique (org_id, email)
);
create index convites_email_idx on public.convites (email) where aceito_em is null;

-- ---------------------------------------------------------------------
-- Funções de permissão (usadas pelas regras de acesso)
-- security definer: rodam com permissão do banco, mas só respondem
-- sobre o próprio usuário logado (auth.uid()).
-- ---------------------------------------------------------------------
create function public.e_admin_plataforma()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.administradores_plataforma a
    where a.user_id = auth.uid()
  );
$$;

create function public.papel_na_org(org uuid)
returns public.papel
language sql
stable
security definer
set search_path = ''
as $$
  select m.papel from public.membros m
  where m.org_id = org and m.user_id = auth.uid();
$$;

create function public.pode_gerir_org(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.e_admin_plataforma()
      or coalesce(public.papel_na_org(org) = 'admin', false);
$$;

-- ---------------------------------------------------------------------
-- Regras de acesso (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.administradores_plataforma enable row level security;
alter table public.organizacoes enable row level security;
alter table public.membros enable row level security;
alter table public.convites enable row level security;

-- Dono da plataforma: cada um só vê a própria linha (para saber se é dono).
create policy "ve a si mesmo" on public.administradores_plataforma
  for select to authenticated
  using (user_id = auth.uid());

-- Empresas: membros veem a sua; o dono da plataforma vê todas.
create policy "membros e dono veem" on public.organizacoes
  for select to authenticated
  using (public.e_admin_plataforma() or public.papel_na_org(id) is not null);

-- Empresas: só o dono da plataforma cria e apaga.
create policy "dono cria" on public.organizacoes
  for insert to authenticated
  with check (public.e_admin_plataforma());

create policy "dono apaga" on public.organizacoes
  for delete to authenticated
  using (public.e_admin_plataforma());

-- Empresas: o dono da plataforma e o admin da empresa podem editar.
create policy "gestores editam" on public.organizacoes
  for update to authenticated
  using (public.pode_gerir_org(id))
  with check (public.pode_gerir_org(id));

-- O admin da empresa não pode se ativar/desativar nem trocar o endereço:
-- isso é coisa do dono da plataforma (controle de pagamento).
create function public.protege_campos_da_org()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.e_admin_plataforma()
     and (new.ativa is distinct from old.ativa or new.slug is distinct from old.slug
          or new.frente is distinct from old.frente) then
    raise exception 'Só o dono da plataforma pode mudar endereço, frente ou status da empresa.';
  end if;
  return new;
end;
$$;

create trigger organizacoes_protege_campos
  before update on public.organizacoes
  for each row execute function public.protege_campos_da_org();

-- Membros: quem é da empresa vê os colegas; o dono da plataforma vê todos.
create policy "colegas veem" on public.membros
  for select to authenticated
  using (public.e_admin_plataforma() or public.papel_na_org(org_id) is not null);

create policy "gestores adicionam" on public.membros
  for insert to authenticated
  with check (public.pode_gerir_org(org_id));

create policy "gestores mudam papel" on public.membros
  for update to authenticated
  using (public.pode_gerir_org(org_id))
  with check (public.pode_gerir_org(org_id));

create policy "gestores removem" on public.membros
  for delete to authenticated
  using (public.pode_gerir_org(org_id));

-- Convites: só quem gere a empresa vê, cria e apaga.
create policy "gestores veem convites" on public.convites
  for select to authenticated
  using (public.pode_gerir_org(org_id));

create policy "gestores convidam" on public.convites
  for insert to authenticated
  with check (public.pode_gerir_org(org_id) and criado_por = auth.uid());

create policy "gestores cancelam" on public.convites
  for delete to authenticated
  using (public.pode_gerir_org(org_id));

-- ---------------------------------------------------------------------
-- Ações (chamadas pelo app)
-- ---------------------------------------------------------------------

-- Quem acabou de entrar aceita os convites feitos para o seu e-mail.
create function public.aceitar_convites()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  meu_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  total integer := 0;
  c record;
begin
  if auth.uid() is null or meu_email = '' then
    return 0;
  end if;

  for c in
    select * from public.convites
    where email = meu_email and aceito_em is null
    for update
  loop
    insert into public.membros (org_id, user_id, papel)
    values (c.org_id, auth.uid(), c.papel)
    on conflict (org_id, user_id) do nothing;

    update public.convites set aceito_em = now() where id = c.id;
    total := total + 1;
  end loop;

  return total;
end;
$$;

-- O dono da plataforma cria uma empresa e já convida o administrador dela.
create function public.criar_organizacao(
  p_nome text,
  p_slug text,
  p_frente public.frente,
  p_email_admin text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  nova uuid;
begin
  if not public.e_admin_plataforma() then
    raise exception 'Só o dono da plataforma pode criar empresas.';
  end if;

  insert into public.organizacoes (nome, slug, frente, vocabulario)
  values (trim(p_nome), lower(trim(p_slug)), p_frente, public.vocabulario_padrao(p_frente))
  returning id into nova;

  if coalesce(trim(p_email_admin), '') <> '' then
    insert into public.convites (org_id, email, papel, criado_por)
    values (nova, lower(trim(p_email_admin)), 'admin', auth.uid());
  end if;

  return nova;
end;
$$;

-- Só usuários logados podem chamar as ações.
revoke execute on function public.aceitar_convites() from public, anon;
revoke execute on function public.criar_organizacao(text, text, public.frente, text) from public, anon;
grant execute on function public.aceitar_convites() to authenticated;
grant execute on function public.criar_organizacao(text, text, public.frente, text) to authenticated;
