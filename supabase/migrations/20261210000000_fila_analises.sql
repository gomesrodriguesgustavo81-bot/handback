-- =====================================================================
--  Handback · Análises em segundo plano
--  O professor pede "analisar todas" e pode fechar a página: as entregas
--  entram numa fila que o servidor vai analisando uma a uma. Quando o
--  lote acaba, quem pediu recebe UM aviso no sininho (não um por entrega).
-- =====================================================================

-- O servidor (chave secreta) pode analisar em nome de quem pediu.
-- Não abre nada a mais: a chave secreta já ignora as regras de acesso.
create function public.e_servidor()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role';
$$;

create or replace function public.pode_avaliar_org(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.e_servidor() or public.dono_com_acesso(org) or coalesce(public.papel_na_org(org) in ('admin', 'avaliador'), false);
$$;

create table public.fila_analises (
  entrega_id uuid primary key references public.entregas (id) on delete cascade,
  org_id uuid not null references public.organizacoes (id) on delete cascade,
  lote uuid not null,
  pedida_por uuid references auth.users (id) on delete set null,
  pedida_em timestamptz not null default now(),
  comecou_em timestamptz,
  tentativas integer not null default 0,
  feita_em timestamptz,
  ok boolean,
  erro text not null default ''
);
create index fila_analises_pendentes_idx on public.fila_analises (pedida_em) where feita_em is null;
create index fila_analises_lote_idx on public.fila_analises (lote);
alter table public.fila_analises enable row level security;
revoke all on public.fila_analises from anon, authenticated;
grant select on public.fila_analises to authenticated;
grant select, insert, update, delete on public.fila_analises to service_role;
create policy "quem avalia ve a fila" on public.fila_analises
  for select to authenticated using (public.pode_avaliar_org(org_id));

-- Põe entregas na fila (só as da própria empresa que ainda não têm devolutiva aprovada).
create function public.enfileirar_analises(p_org uuid, p_entregas uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lote uuid := gen_random_uuid();
  n integer;
begin
  if not public.pode_avaliar_org(p_org) or auth.uid() is null then raise exception 'Você não tem permissão para fazer isso.'; end if;
  if cardinality(p_entregas) > 500 then raise exception 'No máximo 500 entregas de uma vez.'; end if;
  insert into public.fila_analises (entrega_id, org_id, lote, pedida_por)
  select e.id, e.org_id, v_lote, auth.uid()
  from public.entregas e
  left join public.analises a on a.entrega_id = e.id
  where e.id = any (p_entregas) and e.org_id = p_org and e.status = 'recebida'
    and coalesce(a.status::text, '') not in ('aprovada', 'analisando')
  on conflict (entrega_id) do update
    set lote = excluded.lote, pedida_por = excluded.pedida_por, pedida_em = now(),
        comecou_em = null, tentativas = 0, feita_em = null, ok = null, erro = ''
    where public.fila_analises.feita_em is not null;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.enfileirar_analises(uuid, uuid[]) from public, anon;
grant execute on function public.enfileirar_analises(uuid, uuid[]) to authenticated;

-- O servidor pega a próxima da fila (uma de cada vez; nunca a mesma em dois lugares).
create function public.pegar_da_fila()
returns table (entrega_id uuid, org_id uuid, lote uuid, tentativas integer)
language sql
security definer
set search_path = ''
as $$
  update public.fila_analises f
  set comecou_em = now(), tentativas = f.tentativas + 1
  where f.entrega_id = (
    select x.entrega_id from public.fila_analises x
    where x.feita_em is null and (x.comecou_em is null or x.comecou_em < now() - interval '5 minutes')
    order by x.pedida_em, x.entrega_id
    limit 1
    for update skip locked
  )
  returning f.entrega_id, f.org_id, f.lote, f.tentativas;
$$;
revoke execute on function public.pegar_da_fila() from public, anon, authenticated;
grant execute on function public.pegar_da_fila() to service_role;

-- Durante a fila, a análise pronta não gera aviso uma a uma (vem um aviso só no fim do lote).
create or replace function public.aviso_de_analise()
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
    if exists (select 1 from public.fila_analises f where f.entrega_id = new.entrega_id and f.feita_em is null) then
      return new;
    end if;
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

-- Fecha um item da fila; se o lote acabou, avisa quem pediu (um aviso só) e limpa o lote.
create function public.concluir_da_fila(p_entrega uuid, p_ok boolean, p_erro text, p_desistir boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.fila_analises;
  v_ok integer;
  v_erro integer;
  v_slug text;
  v_etapa uuid;
begin
  select * into f from public.fila_analises where entrega_id = p_entrega for update;
  if not found then return; end if;
  if not p_ok and not p_desistir then
    -- Tenta de novo mais tarde.
    update public.fila_analises set comecou_em = null, erro = left(coalesce(p_erro, ''), 500) where entrega_id = p_entrega;
    return;
  end if;
  update public.fila_analises set feita_em = now(), ok = p_ok, erro = left(coalesce(p_erro, ''), 500) where entrega_id = p_entrega;
  if exists (select 1 from public.fila_analises x where x.lote = f.lote and x.feita_em is null) then return; end if;

  select count(*) filter (where x.ok), count(*) filter (where not x.ok) into v_ok, v_erro from public.fila_analises x where x.lote = f.lote;
  select o.slug into v_slug from public.organizacoes o where o.id = f.org_id;
  select e.etapa_id into v_etapa from public.entregas e where e.id = p_entrega;
  if f.pedida_por is not null then
    insert into public.avisos (user_id, org_id, tipo, titulo, texto, link)
    values (f.pedida_por, f.org_id, 'ia',
      case when v_ok = 1 then '1 análise pronta' else v_ok || ' análises prontas' end,
      'Falta revisar e aprovar.' || case when v_erro > 0 then ' ' || v_erro || ' não deram certo: veja no painel.' else '' end,
      '/app/' || v_slug || '/entregas' || coalesce('?etapa=' || v_etapa, ''));
  end if;
  delete from public.fila_analises where lote = f.lote;
end;
$$;
revoke execute on function public.concluir_da_fila(uuid, boolean, text, boolean) from public, anon, authenticated;
grant execute on function public.concluir_da_fila(uuid, boolean, text, boolean) to service_role;
