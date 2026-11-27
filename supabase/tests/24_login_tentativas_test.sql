-- Testes do limite de tentativas de entrar (5 erros = 15 minutos travado).
\set ON_ERROR_STOP on
\pset tuples_only on

create or replace function pg_temp.confere(ok boolean, o_que text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FALHOU: %', o_que; end if;
  raise notice 'ok: %', o_que;
end $$;

-- 1) 4 erros não travam; o 5º trava.
select public.login_falhou('hash-de-teste-0001-abcdef');
select public.login_falhou('hash-de-teste-0001-abcdef');
select public.login_falhou('hash-de-teste-0001-abcdef');
select pg_temp.confere(public.login_falhou('hash-de-teste-0001-abcdef') is null, '4 erros seguidos ainda não travam');
select pg_temp.confere(public.login_bloqueio('hash-de-teste-0001-abcdef') is null, 'com 4 erros a entrada segue livre');
select pg_temp.confere(public.login_falhou('hash-de-teste-0001-abcdef') > now() + interval '14 minutes', 'o 5º erro trava por cerca de 15 minutos');
select pg_temp.confere(public.login_bloqueio('hash-de-teste-0001-abcdef') > now(), 'travado: a consulta devolve até quando');

-- 2) Mais erros durante a trava não estendem nem destravam.
select pg_temp.confere(public.login_falhou('hash-de-teste-0001-abcdef') <= now() + interval '15 minutes', 'erros durante a trava não prolongam a trava');

-- 3) Entrar com sucesso zera tudo.
select public.login_ok('hash-de-teste-0001-abcdef');
select pg_temp.confere(public.login_bloqueio('hash-de-teste-0001-abcdef') is null, 'depois de entrar, não há trava');
select pg_temp.confere((select count(*) = 0 from public.tentativas_login where email_hash = 'hash-de-teste-0001-abcdef'), 'a contagem é apagada');

-- 4) Trava vencida recomeça do zero; erros velhos não contam.
insert into public.tentativas_login (email_hash, falhas, primeira_em, bloqueado_ate)
values ('hash-de-teste-0002-abcdef', 5, now() - interval '20 minutes', now() - interval '5 minutes');
select pg_temp.confere(public.login_bloqueio('hash-de-teste-0002-abcdef') is null, 'trava vencida não bloqueia mais');
select pg_temp.confere(public.login_falhou('hash-de-teste-0002-abcdef') is null, 'depois da trava vencida, um erro conta como o primeiro');
select pg_temp.confere((select falhas = 1 from public.tentativas_login where email_hash = 'hash-de-teste-0002-abcdef'), 'a contagem recomeçou em 1');
insert into public.tentativas_login (email_hash, falhas, primeira_em)
values ('hash-de-teste-0003-abcdef', 4, now() - interval '30 minutes');
select pg_temp.confere(public.login_falhou('hash-de-teste-0003-abcdef') is null, 'erros de mais de 15 minutos atrás não contam');

-- 5) Só o servidor mexe: usuário logado e visitante não executam nem leem.
set role authenticated;
do $$ begin
  begin perform public.login_falhou('x-x-x-x-x-x-x-x-x-x-x'); raise exception 'FALHOU: usuário comum executou';
  exception when insufficient_privilege then raise notice 'ok: usuário logado não executa a função'; end;
  begin perform count(*) from public.tentativas_login; raise exception 'FALHOU: usuário comum leu a tabela';
  exception when insufficient_privilege then raise notice 'ok: usuário logado não lê a tabela'; end;
end $$;
reset role;
set role anon;
do $$ begin
  begin perform public.login_bloqueio('x-x-x-x-x-x-x-x-x-x-x'); raise exception 'FALHOU: visitante executou';
  exception when insufficient_privilege then raise notice 'ok: visitante não executa a função'; end;
end $$;
reset role;

\echo 'TODOS OS TESTES DO LIMITE DE TENTATIVAS PASSARAM'
