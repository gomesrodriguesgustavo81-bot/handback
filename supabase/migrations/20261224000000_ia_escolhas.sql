-- =====================================================================
--  Handback · Quem decide é o professor
--  Escolhas de como a IA ajuda, feitas por quem cria a conta (e ajustáveis por turma):
--   • exigir que o professor ESCOLHA o conceito antes de aprovar (a sugestão da IA é só rascunho);
--   • "sem sugestão de conceito": a IA confere o checklist e escreve o rascunho, o conceito vem em branco;
--   • pedir o motivo quando o professor muda o conceito sugerido;
--   • trocar o nome do aluno por um código e esconder e-mail, telefone e CPF antes de mandar à IA.
--  A conta define o padrão; a turma pode mudar (null na turma = segue a conta).
--  O banco também confere: aprovar sem escolher, quando a escolha é exigida, não passa.
-- =====================================================================

alter table public.organizacoes
  add column ia_exigir_conceito boolean not null default true,
  add column ia_sem_sugestao boolean not null default false,
  add column ia_pedir_motivo boolean not null default false,
  add column ia_nome_codigo boolean not null default true,
  add column ia_esconder_dados boolean not null default true;

alter table public.turmas
  add column ia_exigir_conceito boolean,
  add column ia_sem_sugestao boolean,
  add column ia_pedir_motivo boolean,
  add column ia_nome_codigo boolean,
  add column ia_esconder_dados boolean;

-- O professor escolheu o conceito de próprio punho (e não só aceitou o que veio preenchido).
alter table public.analises add column conceito_escolhido boolean not null default false;

-- Escolhas valendo para uma turma: o que a turma definiu, senão o da conta.
create function public.config_ia(p_org uuid, p_turma uuid)
returns table (exigir boolean, sem_sugestao boolean, pedir_motivo boolean, nome_codigo boolean, esconder_dados boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(t.ia_exigir_conceito, o.ia_exigir_conceito),
         coalesce(t.ia_sem_sugestao, o.ia_sem_sugestao),
         coalesce(t.ia_pedir_motivo, o.ia_pedir_motivo),
         coalesce(t.ia_nome_codigo, o.ia_nome_codigo),
         coalesce(t.ia_esconder_dados, o.ia_esconder_dados)
  from public.organizacoes o
  left join public.turmas t on t.id = p_turma and t.org_id = o.id
  where o.id = p_org;
$$;
-- Só as funções do banco usam esta (o app lê as colunas direto, com as regras de acesso).
revoke execute on function public.config_ia(uuid, uuid) from public, anon, authenticated;

-- Mesma função da migração do gasto da IA; agora, "sem sugestão" deixa o conceito em branco.
create or replace function public.gravar_analise(p_entrega uuid, p_resultado jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.analises;
  lista jsonb := coalesce(p_resultado -> 'alertas', '[]'::jsonb);
  cfg record;
begin
  select * into a from public.analises where entrega_id = p_entrega for update;
  if not found or not public.pode_avaliar_org(a.org_id) then raise exception 'Análise não encontrada.'; end if;
  if a.status <> 'analisando' then raise exception 'A análise foi alterada enquanto a IA respondia; nada foi gravado.'; end if;
  if jsonb_typeof(lista) <> 'array' then lista := '[]'::jsonb; end if;
  select * into cfg from public.config_ia(a.org_id, (select et.turma_id from public.entregas e join public.etapas et on et.id = e.etapa_id where e.id = p_entrega));
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
    -- A IA sempre registra o que achou (conceito_ia). Em "sem sugestão", o conceito da tela começa em branco.
    conceito = case when coalesce(cfg.sem_sugestao, false) then 'PENDENTE' else p_resultado ->> 'conceito' end,
    conceito_escolhido = false,
    devolutiva = left(coalesce(p_resultado ->> 'devolutiva', ''), 10000),
    atualizada_em = now()
  where entrega_id = p_entrega;
  insert into public.uso_ia (org_id, entrega_id, modelo, tokens_entrada, tokens_saida)
  values (a.org_id, p_entrega, left(coalesce(p_resultado ->> 'modelo', ''), 80),
          public.tokens_validos(p_resultado -> 'tokens_entrada'), public.tokens_validos(p_resultado -> 'tokens_saida'));
end;
$$;

-- Revisão humana. Agora também registra se o professor escolheu o conceito e confere as escolhas da turma.
drop function public.revisar_devolutiva(uuid, text, text, boolean, text);
create function public.revisar_devolutiva(p_entrega uuid, p_conceito text, p_devolutiva text, p_aprovar boolean, p_motivo text default '', p_escolhido boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.analises;
  cfg record;
  escolheu boolean;
  motivo text := left(trim(coalesce(p_motivo, '')), 500);
begin
  select * into a from public.analises where entrega_id = p_entrega for update;
  if not found or not public.pode_avaliar_org(a.org_id) then raise exception 'Análise não encontrada.'; end if;
  if a.status = 'analisando' then raise exception 'A IA ainda está analisando esta entrega.'; end if;
  if a.status = 'aprovada' then raise exception 'A devolutiva já foi aprovada. Reabra para editar.'; end if;
  if p_conceito not in ('EXCELENTE', 'BOM', 'REGULAR', 'RUIM', 'PENDENTE') then raise exception 'Conceito inválido.'; end if;
  if p_aprovar and coalesce(trim(p_devolutiva), '') = '' then raise exception 'Escreva a devolutiva antes de aprovar.'; end if;
  select * into cfg from public.config_ia(a.org_id, (select et.turma_id from public.entregas e join public.etapas et on et.id = e.etapa_id where e.id = p_entrega));
  escolheu := coalesce(p_escolhido, false) or a.conceito_escolhido;
  if p_aprovar then
    if coalesce(cfg.exigir, true) and (not escolheu or p_conceito = 'PENDENTE') then
      raise exception 'Escolha o conceito antes de aprovar.';
    end if;
    -- O motivo só é cobrado de quem viu a sugestão da IA e discordou dela.
    if coalesce(cfg.pedir_motivo, false) and not coalesce(cfg.sem_sugestao, false)
       and a.conceito_ia is not null and p_conceito is distinct from a.conceito_ia and motivo = '' then
      raise exception 'Diga o motivo de ter mudado o conceito.';
    end if;
  end if;
  update public.analises set
    conceito = p_conceito,
    conceito_escolhido = escolheu,
    devolutiva = left(coalesce(p_devolutiva, ''), 10000),
    -- o motivo só vale quando o conceito final é diferente do da IA
    motivo_mudanca = case when p_conceito is distinct from a.conceito_ia then motivo else '' end,
    revisada_por = auth.uid(),
    status = case when p_aprovar then 'aprovada'::public.status_analise else a.status end,
    aprovada_por = case when p_aprovar then auth.uid() else null end,
    aprovada_em = case when p_aprovar then now() else null end,
    atualizada_em = now()
  where entrega_id = p_entrega;
end;
$$;
revoke execute on function public.revisar_devolutiva(uuid, text, text, boolean, text, boolean) from public, anon;
grant execute on function public.revisar_devolutiva(uuid, text, text, boolean, text, boolean) to authenticated;

-- Baixar o registro de supervisão também fica no registro de atividades.
create or replace function public.registrar_documento(p_org uuid, p_acao text, p_descricao text, p_alvo uuid, p_ip text, p_aparelho text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.ve_org(p_org) then raise exception 'Empresa não encontrada.'; end if;
  if p_acao not in ('abriu_entrega', 'baixou_arquivo', 'abriu_relatorio', 'baixou_supervisao') then raise exception 'Ação desconhecida.'; end if;
  insert into public.atividades (org_id, user_id, email, tipo, acao, descricao, alvo_id, ip, aparelho)
  values (
    p_org, auth.uid(), coalesce((select u.email from auth.users u where u.id = auth.uid()), ''),
    'documento', p_acao, left(coalesce(p_descricao, ''), 500), p_alvo,
    left(coalesce(p_ip, ''), 64), left(coalesce(p_aparelho, ''), 120)
  );
end;
$$;
