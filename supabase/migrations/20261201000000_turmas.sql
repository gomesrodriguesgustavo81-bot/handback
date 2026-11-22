-- =====================================================================
--  Handback · Turmas (programas, projetos…) dentro de cada conta
--  Cada turma tem as próprias etapas, grupos/alunos e endereço de
--  recebimento. Os ajustes (nomes, conceitos, IA) continuam valendo para
--  a conta toda. O que já existe vai para a turma "Principal".
-- =====================================================================

create table public.turmas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes (id) on delete cascade,
  nome text not null check (length(trim(nome)) between 1 and 120),
  -- grupos: cada grupo (com pessoas dentro) entrega junto; individual: cada pessoa entrega o seu
  modo text not null default 'grupos' check (modo in ('grupos', 'individual')),
  caixa_token text not null unique
    default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
    check (caixa_token ~ '^[a-z0-9]{12}$'),
  arquivada boolean not null default false,
  criada_em timestamptz not null default now()
);
create unique index turmas_nome_unico on public.turmas (org_id, lower(trim(nome)));
create index turmas_org_idx on public.turmas (org_id, criada_em);

alter table public.turmas enable row level security;
create policy "quem ve a empresa ve as turmas" on public.turmas
  for select to authenticated using (public.ve_org(org_id));
create policy "admin cria turmas" on public.turmas
  for insert to authenticated with check (public.pode_gerir_org(org_id));
create policy "admin altera turmas" on public.turmas
  for update to authenticated using (public.pode_gerir_org(org_id)) with check (public.pode_gerir_org(org_id));
create policy "admin apaga turmas" on public.turmas
  for delete to authenticated using (public.pode_gerir_org(org_id));

-- O endereço (código) e a empresa de uma turma não mudam.
create function public.protege_turma()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.org_id is distinct from old.org_id or new.caixa_token is distinct from old.caixa_token then
    raise exception 'O endereço e a empresa de uma turma não podem ser trocados.';
  end if;
  return new;
end;
$$;
create trigger protege_turma before update on public.turmas for each row execute function public.protege_turma();

-- ---------------------------------------------------------------------
-- Conta: primeiro acesso guiado e modo padrão das turmas novas
-- ---------------------------------------------------------------------
alter table public.organizacoes
  add column configurada boolean not null default false,
  add column modo_padrao text not null default 'grupos' check (modo_padrao in ('grupos', 'individual'));
-- Contas que já existem não passam pelo primeiro acesso.
update public.organizacoes set configurada = true;

-- Toda conta nasce com uma turma (com o mesmo endereço que a conta já tinha).
insert into public.turmas (org_id, nome, modo, caixa_token, criada_em)
select o.id, 'Principal', 'grupos', o.caixa_token, o.criada_em from public.organizacoes o;

create function public.primeira_turma()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.turmas (org_id, nome, modo, caixa_token) values (new.id, 'Principal', new.modo_padrao, new.caixa_token);
  return null;
end;
$$;
create trigger primeira_turma after insert on public.organizacoes for each row execute function public.primeira_turma();

-- Turma mais antiga ainda ativa da conta (usada quando nenhuma é informada).
create function public.turma_padrao(p_org uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.id from public.turmas t where t.org_id = p_org order by t.arquivada, t.criada_em, t.id limit 1;
$$;

-- ---------------------------------------------------------------------
-- Etapas, grupos e integrantes passam a pertencer a uma turma
-- ---------------------------------------------------------------------
alter table public.etapas add column turma_id uuid references public.turmas (id) on delete cascade;
alter table public.grupos add column turma_id uuid references public.turmas (id) on delete cascade;
alter table public.integrantes add column turma_id uuid references public.turmas (id) on delete cascade;
alter table public.emails_recebidos add column turma_id uuid references public.turmas (id) on delete set null;

update public.etapas e set turma_id = public.turma_padrao(e.org_id);
update public.grupos g set turma_id = public.turma_padrao(g.org_id);
update public.integrantes i set turma_id = g.turma_id from public.grupos g where g.id = i.grupo_id;
update public.emails_recebidos m set turma_id = public.turma_padrao(m.org_id);

alter table public.etapas alter column turma_id set not null;
alter table public.grupos alter column turma_id set not null;
alter table public.integrantes alter column turma_id set not null;
create index etapas_turma_idx on public.etapas (turma_id, numero);
create index grupos_turma_idx on public.grupos (turma_id);

-- Números, nomes e e-mails passam a ser únicos dentro da turma (a mesma pessoa pode estar em duas turmas).
alter table public.etapas drop constraint etapas_org_id_numero_key;
alter table public.etapas add constraint etapas_turma_numero_key unique (turma_id, numero);
drop index public.grupos_nome_unico;
create unique index grupos_nome_unico on public.grupos (turma_id, lower(trim(nome)));
alter table public.integrantes drop constraint integrantes_org_id_email_key;
alter table public.integrantes add constraint integrantes_turma_email_key unique (turma_id, email);

-- Sem turma informada: usa a turma padrão; a turma precisa ser da mesma empresa.
create function public.confere_turma()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.turma_id is null then new.turma_id := public.turma_padrao(new.org_id); end if;
  if not exists (select 1 from public.turmas t where t.id = new.turma_id and t.org_id = new.org_id) then
    raise exception 'A turma não pertence a esta empresa.';
  end if;
  return new;
end;
$$;
create trigger confere_turma before insert or update of turma_id, org_id on public.etapas for each row execute function public.confere_turma();
create trigger confere_turma before insert or update of turma_id, org_id on public.grupos for each row execute function public.confere_turma();

-- Integrante fica sempre na turma do grupo dele.
create or replace function public.integrante_mesma_org()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  t uuid;
begin
  select g.turma_id into t from public.grupos g where g.id = new.grupo_id and g.org_id = new.org_id;
  if t is null then
    raise exception 'O grupo não pertence a esta empresa.';
  end if;
  new.turma_id := t;
  return new;
end;
$$;

-- Entrega: a etapa e o grupo precisam ser da mesma turma.
create function public.entrega_mesma_turma()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select turma_id from public.etapas where id = new.etapa_id) is distinct from (select turma_id from public.grupos where id = new.grupo_id) then
    raise exception 'A etapa e o grupo são de turmas diferentes.';
  end if;
  return new;
end;
$$;
create trigger entrega_mesma_turma before insert on public.entregas for each row execute function public.entrega_mesma_turma();

-- E-mails recebidos guardam a turma pelo endereço em que chegaram.
create or replace function public.receber_email_interno(p_email jsonb, p_entrega uuid)
returns public.emails_recebidos
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.emails_recebidos;
begin
  insert into public.emails_recebidos (id, org_id, turma_id, message_id, responde_a, de_email, de_nome, assunto, texto,
                                       enviado_em, links, anexos, status, motivo, avisos, etapa_sugerida, grupo_sugerido)
  values (
    (p_email ->> 'id')::uuid, (p_email ->> 'org_id')::uuid, (p_email ->> 'turma_id')::uuid, p_email ->> 'message_id',
    coalesce(array(select jsonb_array_elements_text(p_email -> 'responde_a')), '{}'),
    coalesce(p_email ->> 'de_email', ''), coalesce(p_email ->> 'de_nome', ''), coalesce(p_email ->> 'assunto', ''),
    left(coalesce(p_email ->> 'texto', ''), 20000), (p_email ->> 'enviado_em')::timestamptz,
    coalesce(array(select jsonb_array_elements_text(p_email -> 'links')), '{}'),
    coalesce(p_email -> 'anexos', '[]'::jsonb),
    (p_email ->> 'status')::public.status_email, coalesce(p_email ->> 'motivo', ''),
    coalesce(array(select jsonb_array_elements_text(p_email -> 'avisos')), '{}'),
    (p_email ->> 'etapa_sugerida')::uuid, (p_email ->> 'grupo_sugerido')::uuid
  )
  on conflict (org_id, message_id) do nothing
  returning * into m;

  if m.id is null then
    return null; -- já recebido antes (o mesmo e-mail chegou de novo)
  end if;

  if m.status = 'entrega' then
    perform public.gravar_entrega_interna(p_entrega, m.org_id, m.etapa_sugerida, m.grupo_sugerido, 'email', m.id,
      m.de_email, m.assunto, m.enviado_em, m.texto, m.links, m.anexos, null);
    update public.emails_recebidos set entrega_id = p_entrega where id = m.id returning * into m;
  end if;
  return m;
end;
$$;

-- Registro de atividades também para turmas.
create or replace function public.reg_cadastros()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  linha jsonb := to_jsonb(coalesce(new, old));
  o text := case tg_op when 'INSERT' then 'Cadastrou' when 'UPDATE' then 'Alterou' else 'Apagou' end;
  coisa text;
begin
  coisa := case tg_table_name
    when 'etapas' then (select o2.vocabulario ->> 'etapa' from public.organizacoes o2 where o2.id = (linha ->> 'org_id')::uuid) || ' ' || (linha ->> 'numero') || ' · ' || (linha ->> 'titulo')
    when 'grupos' then (linha ->> 'nome')
    when 'integrantes' then 'o e-mail ' || (linha ->> 'email') || ' em ' || coalesce((select g.nome from public.grupos g where g.id = (linha ->> 'grupo_id')::uuid), '?')
    when 'turmas' then coalesce((select o2.vocabulario ->> 'espaco' from public.organizacoes o2 where o2.id = (linha ->> 'org_id')::uuid), 'Turma') || ' ' || (linha ->> 'nome')
  end;
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'atualizada_em') = (to_jsonb(old) - 'atualizada_em') then return null; end if;
  perform public.registrar((linha ->> 'org_id')::uuid, 'cadastros', lower(o) || '_' || tg_table_name, o || ' ' || coalesce(coisa, '?'), (linha ->> 'id')::uuid);
  return null;
end;
$$;
create trigger reg_turmas after insert or update or delete on public.turmas for each row execute function public.reg_cadastros();
