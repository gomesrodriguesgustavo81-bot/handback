-- =====================================================================
--  Handback · Privacidade dos clientes
--  O dono do Handback não vê mais o conteúdo dos espaços (entregas,
--  arquivos, devolutivas, e-mails, pessoas). Ele vê só a lista e os
--  números de uso. Para ver o conteúdo:
--   - acesso de suporte: o administrador do espaço libera por 1 a 7 dias
--     e pode cortar quando quiser;
--   - acesso de emergência: o dono entra com um motivo, por 4 horas, e o
--     espaço é avisado (tela e e-mail). Tudo vai para o registro.
--  Também prepara a cobrança: cada espaço tem uma situação.
-- =====================================================================

create table public.acessos_suporte (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes (id) on delete cascade,
  tipo text not null check (tipo in ('suporte', 'emergencia')),
  motivo text not null default '' check (length(motivo) <= 500),
  criado_por uuid references auth.users (id) on delete set null,
  inicio timestamptz not null default now(),
  fim timestamptz not null,
  encerrado_em timestamptz,
  encerrado_por uuid references auth.users (id) on delete set null,
  check (fim > inicio)
);
create index acessos_suporte_org_idx on public.acessos_suporte (org_id, fim desc);
alter table public.acessos_suporte enable row level security;
revoke all on public.acessos_suporte from anon, authenticated;
grant select on public.acessos_suporte to authenticated;
grant select, insert, update on public.acessos_suporte to service_role;

-- O dono do Handback só entra no conteúdo de um espaço com um acesso valendo agora.
create function public.dono_com_acesso(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.e_admin_plataforma() and exists (
    select 1 from public.acessos_suporte a
    where a.org_id = org and a.encerrado_em is null and now() >= a.inicio and now() < a.fim
  );
$$;

create or replace function public.pode_gerir_org(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.dono_com_acesso(org) or coalesce(public.papel_na_org(org) = 'admin', false);
$$;

create or replace function public.pode_avaliar_org(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.dono_com_acesso(org) or coalesce(public.papel_na_org(org) in ('admin', 'avaliador'), false);
$$;

create or replace function public.ve_org(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.dono_com_acesso(org) or public.papel_na_org(org) is not null;
$$;

drop policy "membros e dono veem" on public.organizacoes;
create policy "membros e dono com acesso veem" on public.organizacoes
  for select to authenticated
  using (public.dono_com_acesso(id) or public.papel_na_org(id) is not null);

drop policy "colegas veem" on public.membros;
create policy "colegas veem" on public.membros
  for select to authenticated
  using (public.dono_com_acesso(org_id) or public.papel_na_org(org_id) is not null);

-- Quem é do espaço vê os acessos de suporte dele (para saber quem entrou e até quando).
create policy "o espaco ve os seus acessos" on public.acessos_suporte
  for select to authenticated
  using (public.papel_na_org(org_id) is not null or public.e_admin_plataforma());

-- ---------------------------------------------------------------------
-- Situação de cada espaço (para a cobrança, mais tarde)
-- ---------------------------------------------------------------------
alter table public.organizacoes
  add column situacao text not null default 'liberado' check (situacao in ('teste', 'ativo', 'vencido', 'liberado')),
  add column teste_ate date,
  add column criada_por_cadastro boolean not null default false;

create or replace function public.protege_campos_da_org()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and not public.e_admin_plataforma()
     and (new.ativa is distinct from old.ativa or new.slug is distinct from old.slug
          or new.frente is distinct from old.frente or new.caixa_token is distinct from old.caixa_token
          or new.situacao is distinct from old.situacao or new.teste_ate is distinct from old.teste_ate) then
    raise exception 'Só o dono do Handback pode mudar endereço, situação ou bloqueio do espaço.';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- O que o dono vê: lista e números de uso, nunca o conteúdo
-- ---------------------------------------------------------------------
create function public.espacos_da_plataforma()
returns table (
  id uuid, nome text, slug text, frente public.frente, ativa boolean, situacao text, teste_ate date,
  criada_em timestamptz, criada_por_cadastro boolean, administradores text[], pessoas integer, turmas integer,
  entregas integer, analises_30_dias integer, ultima_atividade timestamptz, acesso_tipo text, acesso_ate timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.e_admin_plataforma() then raise exception 'Só o dono do Handback.'; end if;
  return query
  select o.id, o.nome, o.slug, o.frente, o.ativa, o.situacao, o.teste_ate, o.criada_em, o.criada_por_cadastro,
    coalesce((select array_agg(u.email::text order by u.email) from public.membros m join auth.users u on u.id = m.user_id
              where m.org_id = o.id and m.papel = 'admin'),
             (select array_agg(c.email order by c.email) from public.convites c where c.org_id = o.id and c.papel = 'admin' and c.aceito_em is null),
             '{}'),
    (select count(*)::int from public.membros m where m.org_id = o.id),
    (select count(*)::int from public.turmas t where t.org_id = o.id and not t.arquivada),
    (select count(*)::int from public.entregas e where e.org_id = o.id),
    (select count(*)::int from public.analises a where a.org_id = o.id and a.iniciada_em > now() - interval '30 days'),
    (select max(x.criado_em) from public.atividades x where x.org_id = o.id),
    a.tipo, a.fim
  from public.organizacoes o
  left join lateral (
    select s.tipo, s.fim from public.acessos_suporte s
    where s.org_id = o.id and s.encerrado_em is null and now() >= s.inicio and now() < s.fim
    order by s.fim desc limit 1
  ) a on true
  order by o.criada_em desc;
end;
$$;

-- O dono muda a situação ou bloqueia (sem precisar ver o conteúdo).
create function public.mudar_situacao_espaco(p_org uuid, p_ativa boolean, p_situacao text, p_teste_ate date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.e_admin_plataforma() then raise exception 'Só o dono do Handback.'; end if;
  if p_situacao not in ('teste', 'ativo', 'vencido', 'liberado') then raise exception 'Situação desconhecida.'; end if;
  update public.organizacoes set ativa = p_ativa, situacao = p_situacao, teste_ate = p_teste_ate where id = p_org;
  if not found then raise exception 'Espaço não encontrado.'; end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Acesso de suporte (o administrador do espaço libera e corta)
-- ---------------------------------------------------------------------
create function public.liberar_suporte(p_org uuid, p_dias integer)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  ate timestamptz;
begin
  if coalesce(public.papel_na_org(p_org) = 'admin', false) is false then
    raise exception 'Só quem administra o espaço pode liberar o suporte.';
  end if;
  if p_dias not in (1, 3, 7) then raise exception 'Escolha 1, 3 ou 7 dias.'; end if;
  update public.acessos_suporte set encerrado_em = now(), encerrado_por = auth.uid()
  where org_id = p_org and tipo = 'suporte' and encerrado_em is null and fim > now();
  ate := now() + make_interval(days => p_dias);
  insert into public.acessos_suporte (org_id, tipo, criado_por, fim) values (p_org, 'suporte', auth.uid(), ate);
  perform public.registrar(p_org, 'seguranca', 'liberou_suporte',
    'Liberou o acesso de suporte do Handback por ' || p_dias || case when p_dias = 1 then ' dia' else ' dias' end, null);
  return ate;
end;
$$;

create function public.cortar_suporte(p_org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(public.papel_na_org(p_org) = 'admin', false) is false then
    raise exception 'Só quem administra o espaço pode cortar o suporte.';
  end if;
  update public.acessos_suporte set encerrado_em = now(), encerrado_por = auth.uid()
  where org_id = p_org and encerrado_em is null and fim > now();
  perform public.registrar(p_org, 'seguranca', 'cortou_suporte', 'Cortou o acesso do Handback ao espaço', null);
end;
$$;

-- ---------------------------------------------------------------------
-- Acesso de emergência (o dono entra com um motivo, por 4 horas)
-- ---------------------------------------------------------------------
create function public.acesso_de_emergencia(p_org uuid, p_motivo text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  ate timestamptz := now() + interval '4 hours';
begin
  if not public.e_admin_plataforma() then raise exception 'Só o dono do Handback.'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 10 then raise exception 'Escreva o motivo (pelo menos 10 letras).'; end if;
  if not exists (select 1 from public.organizacoes where id = p_org) then raise exception 'Espaço não encontrado.'; end if;
  insert into public.acessos_suporte (org_id, tipo, motivo, criado_por, fim) values (p_org, 'emergencia', left(trim(p_motivo), 500), auth.uid(), ate);
  perform public.registrar(p_org, 'seguranca', 'acesso_emergencia',
    'Acesso de emergência do Handback por 4 horas. Motivo: ' || left(trim(p_motivo), 300), null);
  return ate;
end;
$$;

-- O dono encerra o próprio acesso antes do prazo.
create function public.sair_do_suporte(p_org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.e_admin_plataforma() then raise exception 'Só o dono do Handback.'; end if;
  update public.acessos_suporte set encerrado_em = now(), encerrado_por = auth.uid()
  where org_id = p_org and encerrado_em is null and fim > now();
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.dono_com_acesso(uuid)', 'public.espacos_da_plataforma()', 'public.mudar_situacao_espaco(uuid, boolean, text, date)',
    'public.liberar_suporte(uuid, integer)', 'public.cortar_suporte(uuid)', 'public.acesso_de_emergencia(uuid, text)',
    'public.sair_do_suporte(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- O dono assume um espaço sem ninguém dentro (ex.: um espaço de teste dele mesmo).
-- Espaços com pessoas continuam fechados: lá só com acesso de suporte ou de emergência.
create function public.assumir_espaco_vazio(p_org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.e_admin_plataforma() then raise exception 'Só o dono do Handback.'; end if;
  if exists (select 1 from public.membros where org_id = p_org) then
    raise exception 'Este espaço já tem pessoas: use o acesso de suporte.';
  end if;
  insert into public.membros (org_id, user_id, papel) values (p_org, auth.uid(), 'admin');
  perform public.registrar(p_org, 'pessoas', 'assumiu_espaco', 'O dono do Handback assumiu o espaço vazio como administrador', null);
end;
$$;
revoke execute on function public.assumir_espaco_vazio(uuid) from public, anon;
grant execute on function public.assumir_espaco_vazio(uuid) to authenticated;
