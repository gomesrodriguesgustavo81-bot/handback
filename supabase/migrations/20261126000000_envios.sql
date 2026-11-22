-- =====================================================================
--  Handback · Fase 4 (envio das devolutivas pelo Gmail de quem avalia)
--  Cada pessoa conecta o próprio Gmail (permissão só de ENVIAR). A
--  devolutiva aprovada vai para a equipe na mesma conversa do e-mail da
--  entrega, com cópia para os integrantes cadastrados.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Gmail conectado (um por pessoa)
-- O token fica cifrado e só o servidor (chave secreta) lê e grava.
-- A própria pessoa vê apenas o e-mail conectado e a data.
-- ---------------------------------------------------------------------
create table public.contas_gmail (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  token_cifrado text not null,
  conectada_em timestamptz not null default now(),
  invalida boolean not null default false
);
alter table public.contas_gmail enable row level security;
create policy "cada um ve o seu gmail" on public.contas_gmail
  for select to authenticated using (user_id = auth.uid());
revoke all on public.contas_gmail from anon, authenticated;
grant select (user_id, email, conectada_em, invalida) on public.contas_gmail to authenticated;
grant select, insert, update, delete on public.contas_gmail to service_role;

-- ---------------------------------------------------------------------
-- Preferência da empresa: mandar o conceito junto com a devolutiva
-- ---------------------------------------------------------------------
alter table public.organizacoes add column enviar_conceito boolean not null default true;

-- ---------------------------------------------------------------------
-- Registro do envio de cada devolutiva
-- ---------------------------------------------------------------------
alter table public.analises
  add column envio_status text check (envio_status in ('enviando', 'enviada', 'erro')),
  add column envio_iniciado_em timestamptz,
  add column enviada_em timestamptz,
  add column enviada_por uuid references auth.users (id) on delete set null,
  add column enviada_de text not null default '',
  add column enviada_para text[] not null default '{}',
  add column envio_erro text not null default '',
  add column envio_id text not null default '';

-- Destinatários de uma entrega: quem mandou o e-mail (se veio por e-mail)
-- e os integrantes cadastrados no grupo.
create function public.destinatarios_da_entrega(p_entrega uuid)
returns table (para text[], copia text[])
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.entregas;
  todos text[];
  principal text;
begin
  select * into e from public.entregas where id = p_entrega;
  if not found or not public.pode_avaliar_org(e.org_id) then raise exception 'Entrega não encontrada.'; end if;
  select coalesce(array_agg(i.email order by i.email), '{}') into todos
  from public.integrantes i where i.grupo_id = e.grupo_id;
  principal := case when e.origem = 'email' then nullif(lower(trim(e.remetente)), '') end;
  if principal is not null and principal ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    para := array[principal];
    copia := array(select x from unnest(todos) x where x <> principal);
  else
    para := todos;
    copia := '{}';
  end if;
  return next;
end;
$$;

-- Reserva o envio (evita mandar duas vezes ao mesmo tempo) e devolve tudo
-- o que o servidor precisa para montar o e-mail.
create function public.reservar_envio(p_entrega uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.entregas;
  a public.analises;
  o public.organizacoes;
  m public.emails_recebidos;
  d record;
begin
  select * into e from public.entregas where id = p_entrega;
  if not found or not public.pode_avaliar_org(e.org_id) then raise exception 'Entrega não encontrada.'; end if;
  if e.status <> 'recebida' then raise exception 'Esta entrega foi substituída por um reenvio: envie a devolutiva da mais recente.'; end if;
  select * into a from public.analises where entrega_id = p_entrega for update;
  if not found or a.status <> 'aprovada' then raise exception 'Aprove a devolutiva antes de enviar.'; end if;
  if coalesce(trim(a.devolutiva), '') = '' then raise exception 'A devolutiva está vazia.'; end if;
  if a.envio_status = 'enviando' and a.envio_iniciado_em > now() - interval '5 minutes' then
    raise exception 'Esta devolutiva já está sendo enviada. Aguarde um pouco.';
  end if;
  select * into d from public.destinatarios_da_entrega(p_entrega);
  if cardinality(d.para) = 0 then
    raise exception 'Ninguém para receber: cadastre os e-mails dos integrantes.';
  end if;
  select * into o from public.organizacoes where id = e.org_id;
  if not o.ativa then raise exception 'Esta empresa está bloqueada.'; end if;
  if e.email_id is not null then select * into m from public.emails_recebidos where id = e.email_id; end if;

  update public.analises
  set envio_status = 'enviando', envio_iniciado_em = now(), envio_erro = '', atualizada_em = now()
  where entrega_id = p_entrega;

  return jsonb_build_object(
    'para', to_jsonb(d.para),
    'copia', to_jsonb(d.copia),
    'assunto', e.assunto,
    'origem', e.origem,
    'message_id', coalesce(m.message_id, ''),
    'referencias', to_jsonb(coalesce(m.responde_a, '{}'::text[])),
    'devolutiva', a.devolutiva,
    'conceito', a.conceito,
    'enviar_conceito', o.enviar_conceito,
    'grupo', (select nome from public.grupos where id = e.grupo_id),
    'etapa', (select (o.vocabulario ->> 'etapa') || ' ' || numero || ' · ' || titulo from public.etapas where id = e.etapa_id)
  );
end;
$$;

-- Registra o resultado do envio (deu certo ou o erro).
create function public.concluir_envio(p_entrega uuid, p_ok boolean, p_de text, p_para text[], p_id text, p_erro text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.analises;
begin
  select * into a from public.analises where entrega_id = p_entrega for update;
  if not found or not public.pode_avaliar_org(a.org_id) then raise exception 'Análise não encontrada.'; end if;
  if a.envio_status is distinct from 'enviando' then return; end if;
  if p_ok then
    update public.analises set
      envio_status = 'enviada', enviada_em = now(), enviada_por = auth.uid(),
      enviada_de = left(coalesce(p_de, ''), 320), enviada_para = coalesce(p_para, '{}'),
      envio_id = left(coalesce(p_id, ''), 200), envio_erro = '', atualizada_em = now()
    where entrega_id = p_entrega;
  else
    update public.analises set
      -- se já tinha sido enviada antes, continua marcada como enviada
      envio_status = case when a.enviada_em is not null then 'enviada' else 'erro' end,
      envio_erro = left(coalesce(p_erro, ''), 1000), atualizada_em = now()
    where entrega_id = p_entrega;
  end if;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.destinatarios_da_entrega(uuid)', 'public.reservar_envio(uuid)',
    'public.concluir_envio(uuid, boolean, text, text[], text, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
