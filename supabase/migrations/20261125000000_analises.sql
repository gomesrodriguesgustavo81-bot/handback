-- =====================================================================
--  Handback · Fase 3 (Análise com IA, revisão e aprovação)
--  Para cada entrega: checklist item a item, conceito (sem nota), análise
--  interna e rascunho de devolutiva. Quem avalia revisa, edita e aprova.
--  (O envio da devolutiva por e-mail é a Fase 4.)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Configuração da avaliação por empresa
-- ---------------------------------------------------------------------
alter table public.organizacoes
  add column conceitos jsonb not null default jsonb_build_object(
    'EXCELENTE', 'Entregou todos os itens pedidos com profundidade, clareza e evidências; vai além do solicitado.',
    'BOM', 'Entregou os itens principais com boa qualidade; ajustes pontuais a fazer.',
    'REGULAR', 'Entregou parcialmente; lacunas relevantes ou pouca fundamentação.',
    'RUIM', 'Não entregou o essencial, entregou fora do pedido ou sem evidência do trabalho.'
  ) check (conceitos ?& array['EXCELENTE', 'BOM', 'REGULAR', 'RUIM']),
  -- rigida: item parcial → no máximo BOM (como no protótipo)
  -- flexivel: só item faltando limita (faltou ≤ metade → REGULAR; > metade → RUIM)
  -- livre: a IA decide pelo checklist e pela qualidade
  add column regra_checklist text not null default 'flexivel'
    check (regra_checklist in ('rigida', 'flexivel', 'livre')),
  -- Exemplos de devolutivas aprovadas (separados por uma linha com ---). Vazio = usa
  -- as últimas devolutivas aprovadas no próprio Handback.
  add column exemplos_devolutiva text not null default '' check (length(exemplos_devolutiva) <= 20000);

-- ---------------------------------------------------------------------
-- Análises
-- ---------------------------------------------------------------------
create type public.status_analise as enum ('analisando', 'pronta', 'erro', 'aprovada');

create table public.analises (
  entrega_id uuid primary key references public.entregas (id) on delete cascade,
  org_id uuid not null references public.organizacoes (id) on delete cascade,
  status public.status_analise not null,
  iniciada_em timestamptz not null default now(),
  iniciada_por uuid references auth.users (id) on delete set null,
  concluida_em timestamptz,
  modelo text not null default '',
  segundos integer,
  -- cópia do que foi pedido no momento da análise (o cadastro pode mudar depois)
  pedido jsonb not null default '{}',
  checklist jsonb not null default '[]', -- [{ item, status: ENTREGUE|PARCIAL|NAO_ENTREGUE, evidencia }]
  conceito_ia text check (conceito_ia in ('EXCELENTE', 'BOM', 'REGULAR', 'RUIM')),
  justificativa text not null default '',
  analise_interna text not null default '',
  evolucao text not null default '',
  jornada text not null default '',
  arquivos_lidos text[] not null default '{}',
  avisos_leitura text[] not null default '{}',
  erro text not null default '',
  -- revisão humana
  conceito text check (conceito in ('EXCELENTE', 'BOM', 'REGULAR', 'RUIM', 'PENDENTE')),
  devolutiva text not null default '' check (length(devolutiva) <= 10000),
  revisada_por uuid references auth.users (id) on delete set null,
  aprovada_por uuid references auth.users (id) on delete set null,
  aprovada_em timestamptz,
  atualizada_em timestamptz not null default now()
);
create index analises_org_idx on public.analises (org_id, status);

alter table public.analises enable row level security;
create policy "avaliadores veem analises" on public.analises
  for select to authenticated using (public.pode_avaliar_org(org_id));
-- Gravação só pelas funções abaixo.

-- ---------------------------------------------------------------------
-- Funções (todas conferem se a pessoa avalia nesta empresa)
-- ---------------------------------------------------------------------

-- Marca o começo de uma análise. Não deixa analisar de novo o que já foi aprovado
-- nem começar duas análises ao mesmo tempo (a não ser que a outra tenha travado).
create function public.iniciar_analise(p_entrega uuid, p_pedido jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.entregas;
  a public.analises;
begin
  select * into e from public.entregas where id = p_entrega;
  if not found or not public.pode_avaliar_org(e.org_id) then raise exception 'Entrega não encontrada.'; end if;
  if e.status <> 'recebida' then raise exception 'Esta entrega foi substituída por um reenvio: analise a mais recente.'; end if;

  select * into a from public.analises where entrega_id = p_entrega for update;
  if found then
    if a.status = 'aprovada' then raise exception 'A devolutiva já foi aprovada. Reabra para analisar de novo.'; end if;
    if a.status = 'analisando' and a.iniciada_em > now() - interval '5 minutes' then
      raise exception 'Esta entrega já está sendo analisada. Aguarde um pouco.';
    end if;
    update public.analises
    set status = 'analisando', iniciada_em = now(), iniciada_por = auth.uid(), erro = '', pedido = p_pedido, atualizada_em = now()
    where entrega_id = p_entrega;
  else
    insert into public.analises (entrega_id, org_id, status, iniciada_por, pedido)
    values (p_entrega, e.org_id, 'analisando', auth.uid(), p_pedido);
  end if;
end;
$$;

-- Grava o resultado da IA (só se a análise ainda estiver "analisando").
create function public.gravar_analise(p_entrega uuid, p_resultado jsonb)
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
  if a.status <> 'analisando' then raise exception 'A análise foi alterada enquanto a IA respondia; nada foi gravado.'; end if;
  update public.analises set
    status = 'pronta',
    concluida_em = now(),
    modelo = coalesce(p_resultado ->> 'modelo', ''),
    segundos = (p_resultado ->> 'segundos')::integer,
    checklist = coalesce(p_resultado -> 'checklist', '[]'),
    conceito_ia = p_resultado ->> 'conceito',
    justificativa = coalesce(p_resultado ->> 'justificativa', ''),
    analise_interna = coalesce(p_resultado ->> 'analise_interna', ''),
    evolucao = coalesce(p_resultado ->> 'evolucao', ''),
    jornada = coalesce(p_resultado ->> 'jornada', ''),
    arquivos_lidos = coalesce(array(select jsonb_array_elements_text(p_resultado -> 'arquivos_lidos')), '{}'),
    avisos_leitura = coalesce(array(select jsonb_array_elements_text(p_resultado -> 'avisos_leitura')), '{}'),
    erro = '',
    conceito = p_resultado ->> 'conceito',
    devolutiva = left(coalesce(p_resultado ->> 'devolutiva', ''), 10000),
    atualizada_em = now()
  where entrega_id = p_entrega;
end;
$$;

create function public.falhar_analise(p_entrega uuid, p_erro text)
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
  if a.status = 'analisando' then
    -- Se já havia um resultado antes, volta a ele; senão, fica como erro.
    update public.analises
    set status = case when a.conceito_ia is not null then 'pronta'::public.status_analise else 'erro'::public.status_analise end,
        erro = left(coalesce(p_erro, ''), 2000), atualizada_em = now()
    where entrega_id = p_entrega;
  end if;
end;
$$;

-- Revisão humana: salvar rascunho ou aprovar.
create function public.revisar_devolutiva(p_entrega uuid, p_conceito text, p_devolutiva text, p_aprovar boolean)
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
  if a.status = 'analisando' then raise exception 'A IA ainda está analisando esta entrega.'; end if;
  if a.status = 'aprovada' then raise exception 'A devolutiva já foi aprovada. Reabra para editar.'; end if;
  if p_conceito not in ('EXCELENTE', 'BOM', 'REGULAR', 'RUIM', 'PENDENTE') then raise exception 'Conceito inválido.'; end if;
  if p_aprovar and coalesce(trim(p_devolutiva), '') = '' then raise exception 'Escreva a devolutiva antes de aprovar.'; end if;
  update public.analises set
    conceito = p_conceito,
    devolutiva = left(coalesce(p_devolutiva, ''), 10000),
    revisada_por = auth.uid(),
    status = case when p_aprovar then 'aprovada'::public.status_analise else a.status end,
    aprovada_por = case when p_aprovar then auth.uid() else null end,
    aprovada_em = case when p_aprovar then now() else null end,
    atualizada_em = now()
  where entrega_id = p_entrega;
end;
$$;

create function public.reabrir_devolutiva(p_entrega uuid)
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
  if a.status <> 'aprovada' then return; end if;
  update public.analises set status = 'pronta', aprovada_por = null, aprovada_em = null, atualizada_em = now()
  where entrega_id = p_entrega;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.iniciar_analise(uuid, jsonb)', 'public.gravar_analise(uuid, jsonb)', 'public.falhar_analise(uuid, text)',
    'public.revisar_devolutiva(uuid, text, text, boolean)', 'public.reabrir_devolutiva(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
