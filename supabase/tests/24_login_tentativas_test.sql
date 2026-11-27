-- Testes do limite de tentativas de entrar (5 erros travam; a trava cresce: 1, 5 e 15 minutos).
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
select pg_temp.confere(public.login_falhou('hash-de-teste-0001-abcdef') between now() and now() + interval '61 seconds', 'o 5º erro trava; a 1ª trava dura 1 minuto');
select pg_temp.confere(public.login_bloqueio('hash-de-teste-0001-abcdef') > now(), 'travado: a consulta devolve até quando');

-- 2) Mais erros durante a trava não estendem nem destravam.
select pg_temp.confere(public.login_falhou('hash-de-teste-0001-abcdef') <= now() + interval '61 seconds', 'erros durante a trava não prolongam a trava');

-- 3) A trava cresce: 2ª vez 5 minutos, 3ª vez em diante 15 minutos.
update public.tentativas_login set bloqueado_ate = now() - interval '1 second', falhas = 5 where email_hash = 'hash-de-teste-0001-abcdef';
select public.login_falhou('hash-de-teste-0001-abcdef'); select public.login_falhou('hash-de-teste-0001-abcdef'); select public.login_falhou('hash-de-teste-0001-abcdef'); select public.login_falhou('hash-de-teste-0001-abcdef');
select pg_temp.confere(public.login_falhou('hash-de-teste-0001-abcdef') between now() + interval '4 minutes' and now() + interval '5 minutes 1 second', 'a 2ª trava dura 5 minutos');
update public.tentativas_login set bloqueado_ate = now() - interval '1 second', falhas = 5 where email_hash = 'hash-de-teste-0001-abcdef';
select public.login_falhou('hash-de-teste-0001-abcdef'); select public.login_falhou('hash-de-teste-0001-abcdef'); select public.login_falhou('hash-de-teste-0001-abcdef'); select public.login_falhou('hash-de-teste-0001-abcdef');
select pg_temp.confere(public.login_falhou('hash-de-teste-0001-abcdef') > now() + interval '14 minutes', 'a 3ª trava dura 15 minutos');

-- 4a) Entrar com sucesso zera as tentativas (o histórico de travas fica por 24 horas).
select public.login_ok('hash-de-teste-0001-abcdef');
select pg_temp.confere(public.login_bloqueio('hash-de-teste-0001-abcdef') is null, 'depois de entrar, não há trava');
select pg_temp.confere((select falhas = 0 from public.tentativas_login where email_hash = 'hash-de-teste-0001-abcdef'), 'a contagem de erros volta a zero');

-- 4b) Trava vencida recomeça do zero; erros velhos não contam.
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
