-- =====================================================================
--  Handback · Quanto a IA gasta em cada análise
--  Cada análise concluída grava uma linha em "uso_ia" com os tokens que o
--  Google cobrou (entrada e saída). É um livro-caixa só de somar: a
--  reanálise NÃO apaga o gasto da anterior. Serve para saber o custo real
--  por professor e por semestre antes de definir preços e limites.
--  Nunca guarda texto do aluno, só números.
-- =====================================================================
create table public.uso_ia (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizacoes (id) on delete cascade,
  entrega_id uuid references public.entregas (id) on delete set null,
  tipo text not null default 'analise' check (tipo in ('analise')),
  modelo text not null default '' check (length(modelo) <= 80),
  tokens_entrada integer not null default 0 check (tokens_entrada between 0 and 100000000),
  tokens_saida integer not null default 0 check (tokens_saida between 0 and 100000000),
  criado_em timestamptz not null default now()
);
create index uso_ia_org_idx on public.uso_ia (org_id, criado_em desc);

alter table public.uso_ia enable row level security;
revoke all on public.uso_ia from anon, authenticated;
grant select on public.uso_ia to authenticated;
grant select, insert, update, delete on public.uso_ia to service_role;
-- Só quem administra a conta (e o dono do Handback com acesso) lê; ninguém grava direto.
create policy "quem gere ve o uso da ia" on public.uso_ia
  for select to authenticated using (public.pode_gerir_org(org_id));

-- Número de verdade e dentro de limite; qualquer outra coisa vira 0 (não derruba a análise).
create function public.tokens_validos(v jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(v) = 'number' and (v #>> '{}')::numeric between 0 and 100000000
              then round((v #>> '{}')::numeric)::integer else 0 end;
$$;

-- Mesma função da migração dos alertas, agora também registrando o gasto.
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
  insert into public.uso_ia (org_id, entrega_id, modelo, tokens_entrada, tokens_saida)
  values (a.org_id, p_entrega, left(coalesce(p_resultado ->> 'modelo', ''), 80),
          public.tokens_validos(p_resultado -> 'tokens_entrada'), public.tokens_validos(p_resultado -> 'tokens_saida'));
end;
$$;
