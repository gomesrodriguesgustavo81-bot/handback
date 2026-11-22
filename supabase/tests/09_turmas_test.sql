-- Testes das turmas dentro da conta. Usa a empresa "Curso Epsilon" (04).
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

-- 1) Toda conta tem a turma "Principal", com o mesmo endereço da conta; o que já existia foi para ela.
select pg_temp.confere((select count(*) = 1 and min(t.caixa_token) = min(o.caixa_token) from public.turmas t join public.organizacoes o on o.id = t.org_id
  where o.slug = 'curso-epsilon'), 'conta tem a turma Principal com o endereço da conta');
select pg_temp.confere(not exists (select 1 from public.etapas where turma_id is null) and not exists (select 1 from public.grupos where turma_id is null),
  'etapas e grupos ficaram na turma');
select pg_temp.confere((select bool_and(i.turma_id = g.turma_id) from public.integrantes i join public.grupos g on g.id = i.grupo_id), 'integrantes na turma do grupo');

set role authenticated;
-- 2) Administrador cria uma turma nova (individual); avaliador não cria.
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select pg_temp.erro_contem($$insert into public.turmas (org_id, nome) values ('$$ || current_setting('t.org') || $$', 'Hackeada')$$,
  '42501', 'avaliador não cria turma');
select pg_temp.como('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test');
insert into public.turmas (id, org_id, nome, modo) values ('35000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'Cálculo II', 'individual');
select pg_temp.erro_contem($$update public.turmas set caixa_token = 'aaaaaaaaaaaa' where id = '35000000-0000-0000-0000-000000000001'$$,
  'não podem ser trocados', 'endereço da turma não muda');

-- 3) Mesma pessoa pode estar em duas turmas; mesmo número de etapa também.
insert into public.etapas (id, org_id, turma_id, numero, titulo, entregaveis) values
  ('31000000-0000-0000-0000-000000000009', current_setting('t.org')::uuid, '35000000-0000-0000-0000-000000000001', 1, 'Derivadas', array['Lista']);
insert into public.grupos (id, org_id, turma_id, nome) values
  ('32000000-0000-0000-0000-000000000009', current_setting('t.org')::uuid, '35000000-0000-0000-0000-000000000001', 'Bia Souza');
insert into public.integrantes (org_id, grupo_id, email) values
  (current_setting('t.org')::uuid, '32000000-0000-0000-0000-000000000009', 'bia@azul.test');
select pg_temp.confere((select count(*) = 2 from public.integrantes where email = 'bia@azul.test'), 'mesmo e-mail em duas turmas');
select pg_temp.erro_contem($$insert into public.grupos (org_id, turma_id, nome) values ('$$ || current_setting('t.org') || $$', '35000000-0000-0000-0000-000000000001', 'bia souza')$$,
  '23505', 'nome repetido na mesma turma é recusado');
reset role;

-- 4) Entrega com etapa de uma turma e grupo de outra é recusada.
set role service_role;
select pg_temp.erro_contem($$select public.gravar_entrega_interna(gen_random_uuid(), '$$ || current_setting('t.org') || $$',
  '31000000-0000-0000-0000-000000000009', '32000000-0000-0000-0000-000000000001', 'manual', null, '', '', now(), '', '{}', '[]', null)$$,
  'turmas diferentes', 'não mistura turmas numa entrega');
reset role;

-- 5) Outra empresa não vê as turmas; conta nova já nasce com turma.
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000d', 'admin@zeta.test');
select pg_temp.confere((select count(*) from public.turmas where org_id = current_setting('t.org')::uuid) = 0, 'outra empresa não vê as turmas');
select pg_temp.como('30000000-0000-0000-0000-00000000000a', 'dono3@handback.test');
select public.criar_organizacao('Nova', 'nova-com-turma', 'empresa', '');
select pg_temp.confere((select count(*) = 1 from public.turmas t join public.organizacoes o on o.id = t.org_id where o.slug = 'nova-com-turma' and t.caixa_token = o.caixa_token),
  'conta nova nasce com uma turma');
select pg_temp.confere((select not configurada from public.organizacoes where slug = 'nova-com-turma'), 'conta nova ainda vai passar pelo primeiro acesso');
reset role;

\echo 'TODOS OS TESTES DE TURMAS PASSARAM'
