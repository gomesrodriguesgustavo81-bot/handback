-- Testes dos avisos (sininho). Usa a empresa "Curso Delta" (03).
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

-- 1) Entregas geram avisos para quem avalia, menos para quem registrou.
select pg_temp.confere((select count(*) > 0 from public.avisos where user_id = '20000000-0000-0000-0000-00000000000c' and tipo in ('entrega', 'atraso')),
  'professor recebe aviso das entregas');
select pg_temp.confere(not exists (select 1 from public.avisos a join public.entregas e on a.link like '%/entregas/' || e.id where a.user_id = e.registrada_por),
  'quem registrou a entrega não recebe aviso dela');
select pg_temp.confere(not exists (select 1 from public.avisos where user_id = '20000000-0000-0000-0000-00000000000d'), 'aluno não recebe avisos');
select pg_temp.confere((select bool_and(link like '/app/curso-delta/entregas/%') from public.avisos where org_id = current_setting('t.org')::uuid and tipo = 'entrega'),
  'aviso leva para a entrega');

-- 2) Cada um só vê e só marca os seus.
set role authenticated;
select pg_temp.como('20000000-0000-0000-0000-00000000000c', 'prof@delta.test');
select pg_temp.confere((select count(*) > 0 and bool_and(user_id = '20000000-0000-0000-0000-00000000000c') from public.avisos), 'professor vê só os próprios avisos');
update public.avisos set lido_em = now() where lido_em is null;
select pg_temp.confere((select count(*) = 0 from public.avisos where lido_em is null), 'marcar como lido');
select pg_temp.erro_contem($$update public.avisos set titulo = 'mudado'$$, '42501', 'não dá para mudar o texto do aviso');
select pg_temp.erro_contem($$insert into public.avisos (user_id, org_id, tipo, titulo) values (auth.uid(), current_setting('t.org')::uuid, 'sistema', 'falso')$$, '42501', 'ninguém cria aviso pela tela');
select pg_temp.erro_contem($$select public.avisar_equipe(current_setting('t.org')::uuid, 'entrega', 'x', '', '', null)$$, '42501', 'ninguém chama o aviso da equipe pela tela');
select pg_temp.como('20000000-0000-0000-0000-00000000000b', 'admin@delta.test');
update public.avisos set lido_em = null where user_id = '20000000-0000-0000-0000-00000000000c';
reset role;
select pg_temp.confere((select count(*) = 0 from public.avisos where user_id = '20000000-0000-0000-0000-00000000000c' and lido_em is null), 'um não mexe nos avisos do outro');

-- 3) Preferências: cada um escolhe do que quer saber.
set role authenticated;
select pg_temp.como('20000000-0000-0000-0000-00000000000c', 'prof@delta.test');
insert into public.preferencias_avisos (user_id, tipos) values (auth.uid(), '{ia}');
select pg_temp.erro_contem($$insert into public.preferencias_avisos (user_id) values ('20000000-0000-0000-0000-00000000000b')$$, 'row-level security', 'não dá para mudar a preferência de outro');
select pg_temp.erro_contem($$update public.preferencias_avisos set tipos = '{qualquer}'$$, '23514', 'só tipos conhecidos');
reset role;
select public.avisar_equipe(current_setting('t.org')::uuid, 'entrega', 'Teste de preferência', '', '', null);
select pg_temp.confere((select count(*) = 0 from public.avisos where titulo = 'Teste de preferência' and user_id = '20000000-0000-0000-0000-00000000000c'), 'quem desligou o tipo não recebe');
select pg_temp.confere((select count(*) = 1 from public.avisos where titulo = 'Teste de preferência' and user_id = '20000000-0000-0000-0000-00000000000b'), 'os outros continuam recebendo');
set role authenticated;
select pg_temp.como('20000000-0000-0000-0000-00000000000b', 'admin@delta.test');
select pg_temp.confere((select count(*) = 0 from public.preferencias_avisos), 'não vê a preferência dos outros');
select pg_temp.erro_contem($$select * from public.aparelhos_push$$, '42501', 'ninguém lê os aparelhos pela tela');
select pg_temp.erro_contem($$select * from public.config_plataforma$$, '42501', 'ninguém lê as chaves pela tela');
reset role;

\echo
\echo 'TODOS OS TESTES DE AVISOS PASSARAM'
