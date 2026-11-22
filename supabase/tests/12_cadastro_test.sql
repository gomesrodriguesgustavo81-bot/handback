-- Testes do cadastro sozinho.
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

-- 1) Ninguém logado (nem o app) cria espaço direto: só o servidor.
set role authenticated;
select pg_temp.como('60000000-0000-0000-0000-000000000001', 'curioso@x.test');
select pg_temp.erro_contem($$select public.criar_espaco_por_cadastro('Meu', 'meu-x1', 'educacao', 'Escola', 'Escolas', 'a@b.test', 'ip1')$$, '42501', 'o app não cria espaço pelo cadastro direto');
reset role;

-- 2) O servidor cria: espaço com a palavra escolhida, convite de admin, limite de IA.
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
set role service_role;
select set_config('t.org', public.criar_espaco_por_cadastro('Colégio Horizonte', 'colegio-horizonte-ab12', 'educacao', 'Escola', 'Escolas', ' Nova@Escola.test ', 'ipA')::text, false);
reset role;
select pg_temp.confere((select criada_por_cadastro and situacao = 'liberado' and limite_analises_mes = 200 and vocabulario ->> 'organizacao' = 'Escola' and vocabulario ->> 'etapa' = 'Aula'
  from public.organizacoes where id = current_setting('t.org')::uuid), 'espaço nasce com a palavra escolhida, o vocabulário da área e limite de IA');
select pg_temp.confere((select count(*) = 1 from public.convites where org_id = current_setting('t.org')::uuid and email = 'nova@escola.test' and papel = 'admin'),
  'convite de administrador para o e-mail (em minúsculas)');

-- 3) Limite de tentativas: por e-mail (3 por dia) e por endereço de internet (5 por hora).
set role service_role;
select public.criar_espaco_por_cadastro('Outro 1', 'outro-1-x', 'empresa', '', '', 'nova@escola.test', 'ipB');
select public.criar_espaco_por_cadastro('Outro 2', 'outro-2-x', 'empresa', '', '', 'nova@escola.test', 'ipC');
select pg_temp.erro_contem($$select public.criar_espaco_por_cadastro('Outro 3', 'outro-3-x', 'empresa', '', '', 'nova@escola.test', 'ipD')$$, 'Muitas tentativas', 'no máximo 3 por e-mail por dia');
select public.criar_espaco_por_cadastro('Ip 1', 'ip-1-x', 'empresa', '', '', 'i1@x.test', 'ipZ');
select public.criar_espaco_por_cadastro('Ip 2', 'ip-2-x', 'empresa', '', '', 'i2@x.test', 'ipZ');
select public.criar_espaco_por_cadastro('Ip 3', 'ip-3-x', 'empresa', '', '', 'i3@x.test', 'ipZ');
select public.criar_espaco_por_cadastro('Ip 4', 'ip-4-x', 'empresa', '', '', 'i4@x.test', 'ipZ');
select public.criar_espaco_por_cadastro('Ip 5', 'ip-5-x', 'empresa', '', '', 'i5@x.test', 'ipZ');
select pg_temp.erro_contem($$select public.criar_espaco_por_cadastro('Ip 6', 'ip-6-x', 'empresa', '', '', 'i6@x.test', 'ipZ')$$, 'Muitas tentativas', 'no máximo 5 por endereço de internet por hora');
select pg_temp.erro_contem($$select public.criar_espaco_por_cadastro('Xis', 'x-x', 'empresa', '', '', 'sem-arroba', 'ipY')$$, 'e-mail válido', 'e-mail inválido é recusado');
reset role;

-- 4) Espaço nunca confirmado some depois de 7 dias (o confirmado fica).
update public.organizacoes set criada_em = now() - interval '8 days' where slug in ('outro-1-x', 'outro-2-x');
insert into public.membros (org_id, user_id, papel) select id, '30000000-0000-0000-0000-00000000000b', 'admin' from public.organizacoes where slug = 'outro-2-x';
set role service_role;
select public.criar_espaco_por_cadastro('Depois', 'depois-x', 'empresa', '', '', 'depois@x.test', 'ipW');
reset role;
select pg_temp.confere(not exists (select 1 from public.organizacoes where slug = 'outro-1-x'), 'espaço não confirmado em 7 dias é apagado');
select pg_temp.confere(exists (select 1 from public.organizacoes where slug = 'outro-2-x'), 'espaço confirmado fica');

-- 5) Só o dono muda o limite de IA; o administrador do espaço não.
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test');
select pg_temp.erro_contem($$update public.organizacoes set limite_analises_mes = 99999 where slug = 'outro-2-x'$$, 'Só o dono', 'cliente não aumenta o próprio limite');
select pg_temp.confere(public.analises_no_mes((select id from public.organizacoes where slug = 'outro-2-x')) = 0, 'conta as análises do mês');
reset role;

\echo
\echo 'TODOS OS TESTES DO CADASTRO PASSARAM'
