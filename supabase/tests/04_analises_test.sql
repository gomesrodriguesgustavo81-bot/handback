-- Testes das regras de acesso da Fase 3 (análise, revisão e aprovação).
\set ON_ERROR_STOP on
\pset tuples_only on

create or replace function pg_temp.como(uid uuid, email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, false);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'aal', 'aal2')::text, false);
end $$;
create or replace function pg_temp.confere(ok boolean, o_que text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FALHOU: %', o_que; end if;
  raise notice 'ok: %', o_que;
end $$;
create or replace function pg_temp.erro_contem(sql text, trecho text, o_que text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'FALHOU: % (não deu erro)', o_que;
exception when others then
  if sqlerrm like 'FALHOU%' then raise; end if;
  if position(trecho in sqlerrm) = 0 and sqlstate <> trecho then raise exception 'FALHOU: % (erro inesperado: %)', o_que, sqlerrm; end if;
  raise notice 'ok: %', o_que;
end $$;

insert into auth.users (id, email) values
  ('30000000-0000-0000-0000-00000000000a', 'dono3@handback.test'),
  ('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test'),
  ('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test'),
  ('30000000-0000-0000-0000-00000000000d', 'admin@zeta.test');
insert into public.administradores_plataforma (user_id) values ('30000000-0000-0000-0000-00000000000a');
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000a', 'dono3@handback.test');
select public.criar_organizacao('Curso Epsilon', 'curso-epsilon', 'educacao', 'admin@epsilon.test');
select public.criar_organizacao('Zeta', 'zeta', 'empresa', 'admin@zeta.test');
select pg_temp.como('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test');
select public.aceitar_convites();
insert into public.convites (org_id, email, papel, criado_por)
  select id, 'prof@epsilon.test', 'avaliador', auth.uid() from public.organizacoes where slug = 'curso-epsilon';
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select public.aceitar_convites();
select pg_temp.como('30000000-0000-0000-0000-00000000000d', 'admin@zeta.test');
select public.aceitar_convites();
reset role;
select set_config('t.org', (select id::text from public.organizacoes where slug = 'curso-epsilon'), false);
select pg_temp.confere((select regra_checklist = 'flexivel' and conceitos ? 'EXCELENTE' from public.organizacoes where slug = 'curso-epsilon'),
  'empresa nasce com regra flexível e definições dos conceitos');
insert into public.etapas (id, org_id, numero, titulo, entregaveis) values
  ('31000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 1, 'Diagnóstico', array['Matriz CSD', 'Pesquisa']);
insert into public.grupos (id, org_id, nome) values ('32000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'Azul');
set role service_role;
select public.gravar_entrega_interna('33000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid,
  '31000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', 'manual', null, '', '', now(), 'texto', '{}', '[]', null);
reset role;

set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
-- 1) Professor inicia e grava uma análise; a devolutiva começa como rascunho da IA.
select public.iniciar_analise('33000000-0000-0000-0000-000000000001', '{"itens":["Matriz CSD","Pesquisa"]}');
select pg_temp.erro_contem($$select public.iniciar_analise('33000000-0000-0000-0000-000000000001', '{}')$$,
  'já está sendo analisada', 'não começa duas análises ao mesmo tempo');
select public.gravar_analise('33000000-0000-0000-0000-000000000001', jsonb_build_object(
  'modelo', 'gemini-teste', 'segundos', 12, 'conceito', 'BOM', 'justificativa', 'ok',
  'checklist', jsonb_build_array(jsonb_build_object('item', 'Matriz CSD', 'status', 'ENTREGUE', 'evidencia', 'pág. 1')),
  'analise_interna', 'interna', 'devolutiva', 'Pessoal, ótima entrega!', 'arquivos_lidos', '["a.pdf"]'::jsonb, 'avisos_leitura', '[]'::jsonb));
select pg_temp.confere((select status = 'pronta' and conceito = 'BOM' and conceito_ia = 'BOM' and devolutiva like 'Pessoal%' from public.analises),
  'análise gravada com rascunho da IA');
select pg_temp.erro_contem($$select public.gravar_analise('33000000-0000-0000-0000-000000000001', '{"conceito":"RUIM"}')$$,
  'nada foi gravado', 'resultado atrasado não sobrescreve a análise');

-- 2) Revisão: salvar rascunho, aprovar, não editar depois de aprovado, reabrir.
select public.revisar_devolutiva('33000000-0000-0000-0000-000000000001', 'EXCELENTE', 'Pessoal, excelente entrega!', false);
select pg_temp.confere((select status = 'pronta' and conceito = 'EXCELENTE' and conceito_ia = 'BOM' from public.analises),
  'professor muda o conceito (a sugestão da IA fica guardada)');
select pg_temp.erro_contem($$select public.revisar_devolutiva('33000000-0000-0000-0000-000000000001', 'BOM', '  ', true)$$,
  'Escreva a devolutiva', 'não aprova devolutiva vazia');
select pg_temp.erro_contem($$select public.revisar_devolutiva('33000000-0000-0000-0000-000000000001', 'NOTA 10', 'x', false)$$,
  'Conceito inválido', 'não aceita conceito fora da lista');
select public.revisar_devolutiva('33000000-0000-0000-0000-000000000001', 'EXCELENTE', 'Pessoal, excelente entrega!', true);
select pg_temp.confere((select status = 'aprovada' and aprovada_por = auth.uid() from public.analises), 'devolutiva aprovada');
select pg_temp.erro_contem($$select public.revisar_devolutiva('33000000-0000-0000-0000-000000000001', 'BOM', 'x', false)$$,
  'Reabra', 'devolutiva aprovada não é editada sem reabrir');
select pg_temp.erro_contem($$select public.iniciar_analise('33000000-0000-0000-0000-000000000001', '{}')$$,
  'Reabra', 'devolutiva aprovada não é analisada de novo sem reabrir');
select public.reabrir_devolutiva('33000000-0000-0000-0000-000000000001');
select pg_temp.confere((select status = 'pronta' and aprovada_em is null from public.analises), 'devolutiva reaberta');

-- 3) Falha da IA mantém o resultado anterior.
select public.iniciar_analise('33000000-0000-0000-0000-000000000001', '{}');
select public.falhar_analise('33000000-0000-0000-0000-000000000001', 'cota esgotada');
select pg_temp.confere((select status = 'pronta' and erro = 'cota esgotada' and conceito_ia = 'BOM' from public.analises),
  'erro da IA não apaga a análise anterior');

-- 4) Ninguém de fora vê nem mexe; ninguém grava direto na tabela.
select pg_temp.erro_contem($$insert into public.analises (entrega_id, org_id, status) values ('33000000-0000-0000-0000-000000000001', '$$ || current_setting('t.org') || $$', 'pronta')$$,
  '42501', 'ninguém grava análise direto na tabela');
select pg_temp.como('30000000-0000-0000-0000-00000000000d', 'admin@zeta.test');
select pg_temp.confere((select count(*) from public.analises) = 0, 'outra empresa não vê análises');
select pg_temp.erro_contem($$select public.revisar_devolutiva('33000000-0000-0000-0000-000000000001', 'RUIM', 'hack', true)$$,
  'não encontrada', 'outra empresa não aprova devolutiva alheia');
select pg_temp.erro_contem($$select public.iniciar_analise('33000000-0000-0000-0000-000000000001', '{}')$$,
  'não encontrada', 'outra empresa não dispara análise alheia');
reset role;

\echo 'TODOS OS TESTES DE ANALISES PASSARAM'
