-- Testes do piloto automático. Usa a empresa "Curso Epsilon" (04).
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

-- Uma turma com dois ciclos (um com checklist, outro sem) e três entregas.
insert into public.turmas (id, org_id, nome, modo) values ('d1000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'Piloto', 'individual');
insert into public.etapas (id, org_id, turma_id, numero, titulo, entregaveis) values
  ('d2000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'd1000000-0000-0000-0000-000000000001', 1, 'Com checklist', '{Lista}'),
  ('d2000000-0000-0000-0000-000000000002', current_setting('t.org')::uuid, 'd1000000-0000-0000-0000-000000000001', 2, 'Sem checklist', '{}');
insert into public.grupos (id, org_id, turma_id, nome) values
  ('d3000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'd1000000-0000-0000-0000-000000000001', 'Ana'),
  ('d3000000-0000-0000-0000-000000000002', current_setting('t.org')::uuid, 'd1000000-0000-0000-0000-000000000001', 'Bia');
insert into public.entregas (id, org_id, etapa_id, grupo_id, origem, enviada_em) values
  ('d4000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'd2000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', 'manual', now()),
  ('d4000000-0000-0000-0000-000000000002', current_setting('t.org')::uuid, 'd2000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000002', 'manual', now()),
  ('d4000000-0000-0000-0000-000000000003', current_setting('t.org')::uuid, 'd2000000-0000-0000-0000-000000000002', 'd3000000-0000-0000-0000-000000000001', 'manual', now());
insert into public.analises (entrega_id, org_id, status) values ('d4000000-0000-0000-0000-000000000002', current_setting('t.org')::uuid, 'pronta');

-- 1) Desligado: nada entra na fila.
set role service_role;
select pg_temp.confere(public.piloto_varrer() = 0, 'piloto desligado não põe nada na fila');
reset role;

-- 2) Só quem administra liga; o navegador não chama a varredura.
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select pg_temp.erro_contem($$select public.ligar_piloto('d1000000-0000-0000-0000-000000000001', true)$$, 'permissão', 'avaliador não liga o piloto');
select pg_temp.como('30000000-0000-0000-0000-00000000000d', 'admin@zeta.test');
select pg_temp.erro_contem($$select public.ligar_piloto('d1000000-0000-0000-0000-000000000001', true)$$, 'permissão', 'admin de outra empresa não liga o piloto');
select pg_temp.como('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test');
select public.ligar_piloto('d1000000-0000-0000-0000-000000000001', true);
select pg_temp.erro_contem($$select public.piloto_varrer()$$, '42501', 'o navegador não roda a varredura do piloto');
select pg_temp.erro_contem($$select public.piloto_enfileirar('{d4000000-0000-0000-0000-000000000001}')$$, '42501', 'o navegador não enfileira pelo piloto');
reset role;
select pg_temp.confere((select piloto and piloto_por = '30000000-0000-0000-0000-00000000000b' from public.turmas where id = 'd1000000-0000-0000-0000-000000000001'),
  'admin liga o piloto e fica como quem recebe o aviso');

-- 3) Ligado: só a entrega sem análise, num ciclo com checklist, vai para a fila (uma vez só).
set role service_role;
select pg_temp.confere(public.piloto_varrer() = 1, 'piloto põe na fila só o que falta analisar');
select pg_temp.confere(public.piloto_varrer() = 0, 'não põe a mesma entrega duas vezes');
reset role;
select pg_temp.confere((select pedida_por = '30000000-0000-0000-0000-00000000000b' from public.fila_analises where entrega_id = 'd4000000-0000-0000-0000-000000000001'),
  'o aviso de análise pronta vai para quem ligou o piloto');
select pg_temp.confere(not exists (select 1 from public.fila_analises where entrega_id in ('d4000000-0000-0000-0000-000000000002', 'd4000000-0000-0000-0000-000000000003')),
  'entrega já analisada ou em ciclo sem checklist fica de fora');

-- 4) Desligar volta ao normal.
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test');
select public.ligar_piloto('d1000000-0000-0000-0000-000000000001', false);
reset role;
delete from public.fila_analises where entrega_id = 'd4000000-0000-0000-0000-000000000001';
set role service_role;
select pg_temp.confere(public.piloto_varrer() = 0, 'desligado de novo: nada entra');
reset role;

\echo 'TODOS OS TESTES DO PILOTO PASSARAM'
