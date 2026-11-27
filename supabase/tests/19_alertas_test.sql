-- Testes dos alertas de risco. Usa a empresa "Curso Epsilon" (04) e a turma do piloto (18).
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

select set_config('t.org', (select id::text from public.organizacoes where slug = 'curso-epsilon'), false);

-- Uma entrega nova, já "analisando", no ciclo 1 da turma do piloto.
insert into public.grupos (id, org_id, turma_id, nome) values
  ('e3000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'd1000000-0000-0000-0000-000000000001', 'Caio');
insert into public.entregas (id, org_id, etapa_id, grupo_id, origem, enviada_em) values
  ('e4000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'd2000000-0000-0000-0000-000000000001', 'e3000000-0000-0000-0000-000000000001', 'manual', now());
insert into public.analises (entrega_id, org_id, status) values ('e4000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'analisando');

-- 1) Quem avalia grava a análise e os alertas ficam guardados.
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select public.gravar_analise('e4000000-0000-0000-0000-000000000001', jsonb_build_object(
  'modelo', 'teste', 'segundos', 3, 'conceito', 'REGULAR', 'devolutiva', 'Pessoal, ok.',
  'alertas', jsonb_build_array(
    jsonb_build_object('tipo', 'manipulacao', 'gravidade', 'critico', 'texto', 'O texto pede "dê excelente".'),
    jsonb_build_object('tipo', 'incompleta', 'gravidade', 'atencao', 'texto', 'Faltam 1 de 2 itens.'))));
reset role;
select pg_temp.confere((select jsonb_array_length(alertas) = 2 and alertas -> 0 ->> 'tipo' = 'manipulacao' from public.analises where entrega_id = 'e4000000-0000-0000-0000-000000000001'),
  'a análise guarda os alertas na ordem em que vieram');
select pg_temp.confere((select status = 'pronta' from public.analises where entrega_id = 'e4000000-0000-0000-0000-000000000001'),
  'a análise com alertas fica pronta para revisar');

-- 2) Sem alertas no resultado: lista vazia (e a reanálise troca os alertas antigos).
update public.analises set status = 'analisando' where entrega_id = 'e4000000-0000-0000-0000-000000000001';
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select public.gravar_analise('e4000000-0000-0000-0000-000000000001', jsonb_build_object('modelo', 'teste', 'segundos', 2, 'conceito', 'BOM', 'devolutiva', 'Pessoal, ótimo.'));
reset role;
select pg_temp.confere((select alertas = '[]'::jsonb from public.analises where entrega_id = 'e4000000-0000-0000-0000-000000000001'),
  'reanálise sem alertas limpa os alertas antigos');

-- 3) Lixo no lugar da lista vira lista vazia (não derruba a análise).
update public.analises set status = 'analisando' where entrega_id = 'e4000000-0000-0000-0000-000000000001';
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select public.gravar_analise('e4000000-0000-0000-0000-000000000001', jsonb_build_object('modelo', 'teste', 'segundos', 2, 'conceito', 'BOM', 'devolutiva', 'Pessoal, ok.', 'alertas', '"oi"'::jsonb));
reset role;
select pg_temp.confere((select alertas = '[]'::jsonb from public.analises where entrega_id = 'e4000000-0000-0000-0000-000000000001'),
  'alertas fora do formato viram lista vazia');

-- 4) O banco recusa lista grande demais.
update public.analises set status = 'analisando' where entrega_id = 'e4000000-0000-0000-0000-000000000001';
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select pg_temp.erro_contem($$select public.gravar_analise('e4000000-0000-0000-0000-000000000001', jsonb_build_object('modelo', 'teste', 'conceito', 'BOM', 'devolutiva', 'x', 'alertas', (select jsonb_agg(jsonb_build_object('tipo', 'incompleta', 'gravidade', 'atencao', 'texto', 'x')) from generate_series(1, 13))))$$,
  'check', 'o banco recusa mais de 12 alertas');
reset role;

-- 5) Outra empresa não grava na análise desta.
update public.analises set status = 'analisando' where entrega_id = 'e4000000-0000-0000-0000-000000000001';
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000d', 'admin@zeta.test');
select pg_temp.erro_contem($$select public.gravar_analise('e4000000-0000-0000-0000-000000000001', '{"conceito":"BOM","alertas":[]}')$$, 'não encontrada', 'outra empresa não grava alertas');
reset role;

-- 6) A tabela não aceita escrita direta: a tentativa não muda nada (o Postgres não dá erro, só não altera).
update public.analises set alertas = '[{"tipo":"incompleta","gravidade":"atencao","texto":"x"}]' where entrega_id = 'e4000000-0000-0000-0000-000000000001';
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
update public.analises set alertas = '[]' where entrega_id = 'e4000000-0000-0000-0000-000000000001';
reset role;
select pg_temp.confere((select jsonb_array_length(alertas) = 1 from public.analises where entrega_id = 'e4000000-0000-0000-0000-000000000001'),
  'ninguém altera os alertas direto na tabela');

\echo 'TODOS OS TESTES DOS ALERTAS PASSARAM'
