-- =====================================================================
--  Handback · Cadastro sozinho
--  Qualquer pessoa cria o próprio espaço pela página de vendas. O espaço
--  nasce com um convite de administrador para o e-mail informado: só vira
--  dela depois que ela confirmar o e-mail (pelo link) e criar a senha.
--  Contra abuso: limite de tentativas por endereço de internet e por
--  e-mail, limpeza dos espaços nunca confirmados e limite de análises de
--  IA por mês nos espaços criados pelo cadastro.
-- =====================================================================

alter table public.organizacoes
  add column limite_analises_mes integer check (limite_analises_mes is null or limite_analises_mes >= 0);

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
          or new.situacao is distinct from old.situacao or new.teste_ate is distinct from old.teste_ate
          or new.limite_analises_mes is distinct from old.limite_analises_mes
          or new.criada_por_cadastro is distinct from old.criada_por_cadastro) then
    raise exception 'Só o dono do Handback pode mudar endereço, situação, limites ou bloqueio do espaço.';
  end if;
  return new;
end;
$$;

create table public.cadastros (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  ip_hash text not null default '',
  org_id uuid references public.organizacoes (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index cadastros_ip_idx on public.cadastros (ip_hash, criado_em desc);
create index cadastros_email_idx on public.cadastros (email, criado_em desc);
alter table public.cadastros enable row level security;
revoke all on public.cadastros from anon, authenticated;
grant select, insert, delete on public.cadastros to service_role;

-- Só o servidor chama (a pessoa ainda não tem conta).
create function public.criar_espaco_por_cadastro(
  p_nome text, p_slug text, p_frente public.frente, p_palavra text, p_palavras text, p_email text, p_ip_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  nova uuid;
  v_email text := lower(trim(p_email));
  vocab jsonb;
begin
  if length(trim(coalesce(p_nome, ''))) < 2 or length(p_nome) > 120 then raise exception 'Escreva o nome (de 2 a 120 letras).'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Digite um e-mail válido.'; end if;
  if (select count(*) from public.cadastros c where c.ip_hash = p_ip_hash and p_ip_hash <> '' and c.criado_em > now() - interval '1 hour') >= 5
     or (select count(*) from public.cadastros c where c.email = v_email and c.criado_em > now() - interval '1 day') >= 3 then
    raise exception 'Muitas tentativas seguidas. Espere um pouco e tente de novo.';
  end if;

  -- Limpeza: espaços do cadastro que ninguém confirmou em 7 dias somem.
  delete from public.organizacoes o
  where o.criada_por_cadastro and o.criada_em < now() - interval '7 days'
    and not exists (select 1 from public.membros m where m.org_id = o.id);

  vocab := public.vocabulario_padrao(p_frente);
  if length(trim(coalesce(p_palavra, ''))) between 1 and 40 then
    vocab := vocab || jsonb_build_object('organizacao', trim(p_palavra), 'organizacoes', left(trim(coalesce(p_palavras, p_palavra)), 60));
  end if;

  insert into public.organizacoes (nome, slug, frente, vocabulario, criada_por_cadastro, situacao, limite_analises_mes)
  values (trim(p_nome), p_slug, p_frente, vocab, true, 'liberado', 200)
  returning id into nova;
  insert into public.convites (org_id, email, papel) values (nova, v_email, 'admin');
  insert into public.cadastros (email, ip_hash, org_id) values (v_email, coalesce(p_ip_hash, ''), nova);
  return nova;
end;
$$;
revoke execute on function public.criar_espaco_por_cadastro(text, text, public.frente, text, text, text, text) from public, anon, authenticated;
grant execute on function public.criar_espaco_por_cadastro(text, text, public.frente, text, text, text, text) to service_role;

-- O dono do Handback ajusta o limite de análises de IA de um espaço (null = sem limite).
create function public.mudar_limite_analises(p_org uuid, p_limite integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.e_admin_plataforma() then raise exception 'Só o dono do Handback.'; end if;
  update public.organizacoes set limite_analises_mes = p_limite where id = p_org;
end;
$$;
revoke execute on function public.mudar_limite_analises(uuid, integer) from public, anon;
grant execute on function public.mudar_limite_analises(uuid, integer) to authenticated;

-- Análises de IA no mês (para conferir o limite antes de chamar a IA).
create function public.analises_no_mes(p_org uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.analises a
  where a.org_id = p_org and a.iniciada_em >= date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
    and public.pode_avaliar_org(p_org);
$$;
revoke execute on function public.analises_no_mes(uuid) from public, anon;
grant execute on function public.analises_no_mes(uuid) to authenticated;
