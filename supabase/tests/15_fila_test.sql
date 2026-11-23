-- Testes da fila de análises. Usa a empresa "Curso Delta" (03).
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


select set_config('t.org', (select id::text from public.organizacoes where slug = 'curso-delta'), false);
select set_config('t.ent', (select string_agg(e.id::text, ',') from public.entregas e left join public.analises a on a.entrega_id = e.id
  where e.org_id = current_setting('t.org')::uuid and e.status = 'recebida' and coalesce(a.status::text, '') not in ('aprovada', 'analisando')), false);
select pg_temp.confere(current_setting('t.ent') <> '', 'há entregas para pôr na fila');
set role authenticated;

select pg_temp.como('20000000-0000-0000-0000-00000000000e', 'admin@outra2.test');
select pg_temp.erro_contem($$select public.enfileirar_analises(current_setting('t.org')::uuid, string_to_array(current_setting('t.ent'), ',')::uuid[])$$, 'permissão', 'quem é de fora não põe na fila');
select pg_temp.confere(not public.e_servidor(), 'pessoa logada não passa por servidor');
select pg_temp.confere(not public.pode_avaliar_org(current_setting('t.org')::uuid), 'quem é de fora não avalia');

select pg_temp.como('20000000-0000-0000-0000-00000000000c', 'prof@delta.test');
select pg_temp.confere(public.enfileirar_analises(current_setting('t.org')::uuid, string_to_array(current_setting('t.ent'), ',')::uuid[]) >= 1, 'professor põe as entregas na fila');
select pg_temp.confere(public.enfileirar_analises(current_setting('t.org')::uuid, string_to_array(current_setting('t.ent'), ',')::uuid[]) = 0, 'pedir de novo não duplica');
select pg_temp.confere((select count(*) >= 1 from public.fila_analises), 'professor vê a fila da empresa');
select pg_temp.erro_contem($$select * from public.pegar_da_fila()$$, '42501', 'só o servidor pega da fila');
select pg_temp.erro_contem($$select public.concluir_da_fila(gen_random_uuid(), true, '', false)$$, '42501', 'só o servidor conclui');
select pg_temp.erro_contem($$delete from public.fila_analises$$, '42501', 'ninguém apaga a fila pela tela');

select pg_temp.como('20000000-0000-0000-0000-00000000000e', 'admin@outra2.test');
select pg_temp.confere((select count(*) = 0 from public.fila_analises), 'outra empresa não vê a fila');
reset role;

-- O servidor (com o papel de servidor) passa nas regras de avaliar.
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
select pg_temp.confere(public.e_servidor() and public.pode_avaliar_org(current_setting('t.org')::uuid), 'o servidor analisa em nome de quem pediu');
select set_config('request.jwt.claims', '', false);
delete from public.fila_analises;

\echo
\echo 'TODOS OS TESTES DA FILA PASSARAM'
