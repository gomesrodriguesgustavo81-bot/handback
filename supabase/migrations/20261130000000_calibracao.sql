-- =====================================================================
--  Handback · Calibração da IA
--  Quando quem avalia muda o conceito sugerido pela IA, pode dizer por quê.
--  Esses motivos entram nas próximas análises e alimentam o painel
--  "Como a IA está indo".
-- =====================================================================

alter table public.analises add column motivo_mudanca text not null default '' check (length(motivo_mudanca) <= 500);

drop function public.revisar_devolutiva(uuid, text, text, boolean);

create function public.revisar_devolutiva(p_entrega uuid, p_conceito text, p_devolutiva text, p_aprovar boolean, p_motivo text default '')
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
    -- o motivo só vale quando o conceito final é diferente do da IA
    motivo_mudanca = case when p_conceito is distinct from a.conceito_ia then left(trim(coalesce(p_motivo, '')), 500) else '' end,
    revisada_por = auth.uid(),
    status = case when p_aprovar then 'aprovada'::public.status_analise else a.status end,
    aprovada_por = case when p_aprovar then auth.uid() else null end,
    aprovada_em = case when p_aprovar then now() else null end,
    atualizada_em = now()
  where entrega_id = p_entrega;
end;
$$;

revoke execute on function public.revisar_devolutiva(uuid, text, text, boolean, text) from public, anon;
grant execute on function public.revisar_devolutiva(uuid, text, text, boolean, text) to authenticated;

-- Reanálise: a sugestão nova da IA zera o motivo antigo.
create or replace function public.gravar_analise(p_entrega uuid, p_resultado jsonb)
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
    motivo_mudanca = '',
    conceito = p_resultado ->> 'conceito',
    devolutiva = left(coalesce(p_resultado ->> 'devolutiva', ''), 10000),
    atualizada_em = now()
  where entrega_id = p_entrega;
end;
$$;
