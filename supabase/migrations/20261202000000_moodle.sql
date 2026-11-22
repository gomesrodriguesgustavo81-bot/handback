-- =====================================================================
--  Handback · Ligação com o Moodle
--  Quem administra liga uma disciplina do Moodle a uma turma: os alunos,
--  os grupos e as tarefas vêm de lá; as entregas são buscadas (com os
--  arquivos) e a devolutiva aprovada volta para a tarefa no Moodle
--  (comentário e, se quiser, a nota).
--  A senha do Moodle nunca é guardada: só a chave de acesso que o Moodle
--  devolve, cifrada, e que só o servidor lê.
-- =====================================================================

alter type public.origem_entrega add value if not exists 'moodle';

-- ---------------------------------------------------------------------
-- Conexões (uma por pessoa, por site, dentro de cada conta)
-- ---------------------------------------------------------------------
create table public.contas_moodle (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  site text not null check (site ~ '^https?://[^\s]+$' and length(site) <= 300),
  site_nome text not null default '' check (length(site_nome) <= 300),
  moodle_usuario bigint not null,
  nome text not null default '' check (length(nome) <= 300),
  token_cifrado text not null,
  invalida boolean not null default false,
  conectada_em timestamptz not null default now(),
  unique (org_id, user_id, site)
);
alter table public.contas_moodle enable row level security;
create policy "cada um ve as suas conexoes do moodle" on public.contas_moodle
  for select to authenticated using (user_id = auth.uid() and public.ve_org(org_id));
revoke all on public.contas_moodle from anon, authenticated;
grant select (id, org_id, user_id, site, site_nome, moodle_usuario, nome, invalida, conectada_em) on public.contas_moodle to authenticated;
grant select, insert, update, delete on public.contas_moodle to service_role;

-- Guarda (ou renova) a conexão de quem está logado. O token chega já cifrado pelo servidor.
create function public.salvar_conta_moodle(p_org uuid, p_site text, p_site_nome text, p_usuario bigint, p_nome text, p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  novo uuid;
begin
  if auth.uid() is null or not public.pode_gerir_org(p_org) then
    raise exception 'Só quem administra a conta pode ligar o Moodle.';
  end if;
  insert into public.contas_moodle (org_id, user_id, site, site_nome, moodle_usuario, nome, token_cifrado)
  values (p_org, auth.uid(), p_site, left(coalesce(p_site_nome, ''), 300), p_usuario, left(coalesce(p_nome, ''), 300), p_token)
  on conflict (org_id, user_id, site) do update
    set site_nome = excluded.site_nome, moodle_usuario = excluded.moodle_usuario, nome = excluded.nome,
        token_cifrado = excluded.token_cifrado, invalida = false, conectada_em = now()
  returning id into novo;
  perform public.registrar(p_org, 'seguranca', 'conectou_moodle', 'Ligou o Moodle ' || p_site || ' (como ' || coalesce(nullif(p_nome, ''), '?') || ')', novo);
  return novo;
end;
$$;

-- Desliga uma conexão (só a própria). As turmas continuam, mas param de buscar.
create function public.desligar_conta_moodle(p_conta uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.contas_moodle;
begin
  select * into c from public.contas_moodle where id = p_conta;
  if not found or c.user_id is distinct from auth.uid() then raise exception 'Conexão não encontrada.'; end if;
  delete from public.contas_moodle where id = p_conta;
  perform public.registrar(c.org_id, 'seguranca', 'desconectou_moodle', 'Desligou o Moodle ' || c.site, null);
end;
$$;

-- ---------------------------------------------------------------------
-- O que veio do Moodle
-- ---------------------------------------------------------------------
alter table public.turmas
  add column moodle_conta uuid references public.contas_moodle (id) on delete set null,
  add column moodle_curso bigint,
  add column moodle_curso_nome text not null default '',
  add column moodle_buscado_em timestamptz,
  add column moodle_erro text not null default '';
create unique index turmas_moodle_unica on public.turmas (moodle_conta, moodle_curso) where moodle_conta is not null;

alter table public.etapas
  add column moodle_tarefa bigint,
  add column moodle_corrigir boolean not null default true,
  add column moodle_em_grupo boolean not null default false,
  add column moodle_nota_max numeric;
create unique index etapas_moodle_unica on public.etapas (turma_id, moodle_tarefa) where moodle_tarefa is not null;

-- moodle_id: 'g:<id do grupo>' ou 'u:<id do aluno>'; moodle_membros: ids dos alunos no Moodle.
alter table public.grupos
  add column moodle_id text check (moodle_id ~ '^[gu]:[0-9]+$'),
  add column moodle_membros bigint[] not null default '{}';
create unique index grupos_moodle_unico on public.grupos (turma_id, moodle_id) where moodle_id is not null;

-- Cada envio no Moodle (id + horário) vira uma entrega só uma vez.
alter table public.entregas add column moodle_chave text;
create unique index entregas_moodle_unica on public.entregas (etapa_id, moodle_chave) where moodle_chave is not null;

-- Conceito → porcentagem da nota máxima da tarefa no Moodle.
alter table public.organizacoes
  add column notas_moodle jsonb not null default '{"EXCELENTE": 100, "BOM": 80, "REGULAR": 60, "RUIM": 40}'::jsonb
    check (notas_moodle ?& array['EXCELENTE', 'BOM', 'REGULAR', 'RUIM']);

alter table public.analises
  add column moodle_status text check (moodle_status in ('enviando', 'enviada', 'erro')),
  add column moodle_iniciado_em timestamptz,
  add column moodle_enviada_em timestamptz,
  add column moodle_nota numeric,
  add column moodle_erro text not null default '';

-- ---------------------------------------------------------------------
-- Grava uma entrega buscada no Moodle (só o servidor chama)
-- ---------------------------------------------------------------------
create function public.gravar_entrega_moodle(
  p_id uuid, p_org uuid, p_etapa uuid, p_grupo uuid, p_remetente text, p_assunto text,
  p_enviada_em timestamptz, p_comentario text, p_links text[], p_arquivos jsonb, p_chave text
)
returns public.entregas
language plpgsql
security definer
set search_path = ''
as $$
declare
  nova public.entregas;
begin
  if exists (select 1 from public.entregas where etapa_id = p_etapa and moodle_chave = p_chave) then
    return null; -- já buscada antes
  end if;
  nova := public.gravar_entrega_interna(p_id, p_org, p_etapa, p_grupo, 'moodle'::public.origem_entrega, null,
    p_remetente, p_assunto, p_enviada_em, p_comentario, p_links, p_arquivos, null);
  update public.entregas set moodle_chave = p_chave where id = p_id returning * into nova;
  perform public.registrar(p_org, 'entrega', 'chegou_moodle',
    'Chegou do Moodle a entrega de ' || public.nome_etapa_grupo(p_etapa, p_grupo), p_id);
  return nova;
end;
$$;
revoke execute on function public.gravar_entrega_moodle(uuid, uuid, uuid, uuid, text, text, timestamptz, text, text[], jsonb, text)
  from public, anon, authenticated;
grant execute on function public.gravar_entrega_moodle(uuid, uuid, uuid, uuid, text, text, timestamptz, text, text[], jsonb, text) to service_role;

-- ---------------------------------------------------------------------
-- Devolver no Moodle: reserva (não manda duas vezes) e resultado
-- ---------------------------------------------------------------------
create function public.reservar_envio_moodle(p_entrega uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.entregas;
  a public.analises;
  et public.etapas;
  g public.grupos;
  t public.turmas;
  o public.organizacoes;
begin
  select * into e from public.entregas where id = p_entrega;
  if not found or not public.pode_avaliar_org(e.org_id) then raise exception 'Entrega não encontrada.'; end if;
  if e.status <> 'recebida' then raise exception 'Esta entrega foi substituída por um reenvio: devolva a mais recente.'; end if;
  select * into a from public.analises where entrega_id = p_entrega for update;
  if not found or a.status <> 'aprovada' then raise exception 'Aprove a devolutiva antes de devolver.'; end if;
  if coalesce(trim(a.devolutiva), '') = '' then raise exception 'A devolutiva está vazia.'; end if;
  if a.moodle_status = 'enviando' and a.moodle_iniciado_em > now() - interval '5 minutes' then
    raise exception 'Esta devolutiva já está sendo enviada ao Moodle. Aguarde um pouco.';
  end if;
  select * into et from public.etapas where id = e.etapa_id;
  select * into g from public.grupos where id = e.grupo_id;
  select * into t from public.turmas where id = et.turma_id;
  select * into o from public.organizacoes where id = e.org_id;
  if not o.ativa then raise exception 'Esta empresa está bloqueada.'; end if;
  if et.moodle_tarefa is null then raise exception 'Esta etapa não veio do Moodle.'; end if;
  if t.moodle_conta is null then raise exception 'A turma não está mais ligada ao Moodle. Ligue de novo em Ajustes.'; end if;
  if cardinality(g.moodle_membros) = 0 then raise exception 'Não sabemos quem é este grupo no Moodle. Busque as entregas de novo.'; end if;

  update public.analises set moodle_status = 'enviando', moodle_iniciado_em = now(), moodle_erro = ''
  where entrega_id = p_entrega;

  return jsonb_build_object(
    'conta', t.moodle_conta,
    'tarefa', et.moodle_tarefa,
    'em_grupo', et.moodle_em_grupo,
    'nota_max', et.moodle_nota_max,
    'membros', to_jsonb(g.moodle_membros),
    'devolutiva', a.devolutiva,
    'conceito', a.conceito,
    'enviar_conceito', o.enviar_conceito,
    'porcentagem', o.notas_moodle -> a.conceito
  );
end;
$$;

create function public.concluir_envio_moodle(p_entrega uuid, p_ok boolean, p_nota numeric, p_erro text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.analises;
  e public.entregas;
begin
  select * into a from public.analises where entrega_id = p_entrega for update;
  if not found or not public.pode_avaliar_org(a.org_id) then raise exception 'Análise não encontrada.'; end if;
  if a.moodle_status is distinct from 'enviando' then return; end if;
  if p_ok then
    update public.analises set moodle_status = 'enviada', moodle_enviada_em = now(), moodle_nota = p_nota, moodle_erro = ''
    where entrega_id = p_entrega;
    select * into e from public.entregas where id = p_entrega;
    perform public.registrar(a.org_id, 'avaliacao', 'devolveu_moodle',
      'Devolveu no Moodle a devolutiva de ' || public.nome_etapa_grupo(e.etapa_id, e.grupo_id)
      || case when p_nota is not null then ' (nota ' || replace(to_char(p_nota, 'FM999990.0'), '.', ',') || ')' else '' end, p_entrega);
  else
    update public.analises set
      moodle_status = case when a.moodle_enviada_em is not null then 'enviada' else 'erro' end,
      moodle_erro = left(coalesce(p_erro, ''), 1000)
    where entrega_id = p_entrega;
  end if;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.salvar_conta_moodle(uuid, text, text, bigint, text, text)', 'public.desligar_conta_moodle(uuid)',
    'public.reservar_envio_moodle(uuid)', 'public.concluir_envio_moodle(uuid, boolean, numeric, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
