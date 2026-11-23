-- Testes da matrícula dos alunos. Usa a empresa "Curso Epsilon" (04).
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
select set_config('t.int', (select id::text from public.integrantes where email = 'bia@azul.test' and org_id = current_setting('t.org')::uuid limit 1), false);
select pg_temp.confere(current_setting('t.int') <> '', 'há um integrante para testar');
select pg_temp.confere((select matricula = '' from public.integrantes where id = current_setting('t.int')::uuid), 'matrícula começa vazia');
set role authenticated;

-- Quem administra corrige nome e matrícula.
select pg_temp.como('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test');
update public.integrantes set matricula = '11223344', nome = 'Bia Souza' where id = current_setting('t.int')::uuid;
select pg_temp.confere((select matricula = '11223344' and nome = 'Bia Souza' from public.integrantes where id = current_setting('t.int')::uuid), 'administrador salva nome e matrícula');
select pg_temp.erro_contem($$update public.integrantes set matricula = repeat('9', 41) where id = current_setting('t.int')::uuid$$, '23514', 'matrícula tem no máximo 40 caracteres');

-- Quem só avalia vê, mas não muda.
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select pg_temp.confere((select matricula = '11223344' from public.integrantes where id = current_setting('t.int')::uuid), 'avaliador vê a matrícula');
update public.integrantes set matricula = '000' where id = current_setting('t.int')::uuid;
select pg_temp.confere((select matricula = '11223344' from public.integrantes where id = current_setting('t.int')::uuid), 'avaliador não muda a matrícula');

-- Quem é de fora não vê.
select pg_temp.como('30000000-0000-0000-0000-00000000000a', 'dono3@handback.test');
select pg_temp.confere((select count(*) = 0 from public.integrantes where id = current_setting('t.int')::uuid), 'dono do Handback não vê os alunos sem acesso');
reset role;

\echo
\echo 'TODOS OS TESTES DE MATRÍCULA PASSARAM'
