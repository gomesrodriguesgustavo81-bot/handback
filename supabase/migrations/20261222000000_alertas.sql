-- =====================================================================
--  Handback · Alertas de risco e integridade
--  Cada análise guarda uma lista de alertas ("entrega incompleta", "parte
--  ilegível", "fora do escopo", "tentativa de manipular a IA", "inconsistência")
--  para quem avalia olhar com mais atenção. É dado de verdade (e não só texto
--  solto na análise interna), então dá para somar por turma e por ciclo.
--
--  Formato de cada alerta: { "tipo": "...", "gravidade": "atencao|critico", "texto": "..." }
-- =====================================================================

alter table public.analises
  add column alertas jsonb not null default '[]'
    check (jsonb_typeof(alertas) = 'array' and jsonb_array_length(alertas) <= 12 and length(alertas::text) <= 6000);

-- Só a função abaixo grava (quem avalia não escreve direto na tabela).
-- A reanálise troca os alertas pelos novos; o resto da função é o mesmo da calibração.
create or replace function public.gravar_analise(p_entrega uuid, p_resultado jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.analises;
  lista jsonb := coalesce(p_resultado -> 'alertas', '[]'::jsonb);
begin
  select * into a from public.analises where entrega_id = p_entrega for update;
  if not found or not public.pode_avaliar_org(a.org_id) then raise exception 'Análise não encontrada.'; end if;
  if a.status <> 'analisando' then raise exception 'A análise foi alterada enquanto a IA respondia; nada foi gravado.'; end if;
  if jsonb_typeof(lista) <> 'array' then lista := '[]'::jsonb; end if;
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
    alertas = lista,
    erro = '',
    motivo_mudanca = '',
    conceito = p_resultado ->> 'conceito',
    devolutiva = left(coalesce(p_resultado ->> 'devolutiva', ''), 10000),
    atualizada_em = now()
  where entrega_id = p_entrega;
end;
$$;
