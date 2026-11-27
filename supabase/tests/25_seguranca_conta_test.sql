-- Testes da segurança da conta: quem administra, sessão de 24 h, aparelhos conectados e tabelas só do servidor.
\set ON_ERROR_STOP on
\pset tuples_only on

create or replace function pg_temp.como(uid uuid, email text, sessao uuid default null) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, false);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'aal', 'aal2', 'session_id', sessao)::text, false);
end $$;
create or replace function pg_temp.confere(ok boolean, o_que text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FALHOU: %', o_que; end if;
  raise notice 'ok: %', o_que;
end $$;

-- Pessoas já criadas nos testes anteriores: 0b = administrador da empresa Epsilon, 0c = professor (avaliador).
insert into auth.sessions (id, user_id, created_at, refreshed_at, user_agent, ip) values
  ('a1000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-00000000000b', now() - interval '25 hours', now(), 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0', '200.10.20.30'),
  ('a1000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-00000000000b', now() - interval '1 hour', now(), 'Mozilla/5.0 (iPhone) Safari/605.1', '200.10.20.31'),
  ('a1000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-00000000000c', now() - interval '30 hours', now(), 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0', '2001:db8::1');

set role authenticated;

-- 1) Quem administra.
select pg_temp.como('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test');
select pg_temp.confere(public.e_quem_administra(), 'administrador da empresa é reconhecido');
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select pg_temp.confere(not public.e_quem_administra(), 'avaliador não é administrador');

-- 2) Sessão de administrador vence em 24 horas; a de quem não administra, não.
select pg_temp.como('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test', 'a1000000-0000-0000-0000-000000000001');
select pg_temp.confere(public.sessao_de_admin_vencida(), 'administrador com sessão de 25 horas: vencida');
select pg_temp.como('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test', 'a1000000-0000-0000-0000-000000000002');
select pg_temp.confere(not public.sessao_de_admin_vencida(), 'administrador com sessão de 1 hora: vale');
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test', 'a1000000-0000-0000-0000-000000000003');
select pg_temp.confere(not public.sessao_de_admin_vencida(), 'quem não administra não é cobrado a cada 24 horas');

-- 3) Aparelhos conectados: só os da própria pessoa, com a rede encurtada.
select pg_temp.como('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test', 'a1000000-0000-0000-0000-000000000002');
select pg_temp.confere((select count(*) = 2 from public.minhas_sessoes()), 'vê só as próprias sessões');
select pg_temp.confere((select esta from public.minhas_sessoes() where id = 'a1000000-0000-0000-0000-000000000002'), 'marca qual é o aparelho de agora');
select pg_temp.confere((select rede = '200.10.20.x' from public.minhas_sessoes() where id = 'a1000000-0000-0000-0000-000000000002'), 'não mostra o endereço de rede inteiro');
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select pg_temp.confere((select count(*) = 1 from public.minhas_sessoes()), 'cada pessoa vê só as suas');

-- 4) Códigos de recuperação e senhas antigas: só o servidor lê e grava.
select pg_temp.confere(public.meus_codigos_de_recuperacao() = 0, 'sem códigos gerados: zero');
do $$ begin
  begin perform count(*) from public.codigos_recuperacao; raise exception 'FALHOU: usuário leu os códigos';
  exception when insufficient_privilege then raise notice 'ok: usuário não lê a tabela de códigos'; end;
  begin perform count(*) from public.senhas_antigas; raise exception 'FALHOU: usuário leu as senhas antigas';
  exception when insufficient_privilege then raise notice 'ok: usuário não lê as senhas antigas'; end;
  begin perform public.usuario_do_email('admin@epsilon.test'); raise exception 'FALHOU: usuário consultou e-mail';
  exception when insufficient_privilege then raise notice 'ok: usuário não consulta se um e-mail tem conta'; end;
end $$;
reset role;

-- O servidor grava códigos e a pessoa vê só quantos restam.
insert into public.codigos_recuperacao (user_id, hash) values
  ('30000000-0000-0000-0000-00000000000b', repeat('a', 64)),
  ('30000000-0000-0000-0000-00000000000b', repeat('b', 64)),
  ('30000000-0000-0000-0000-00000000000b', repeat('c', 64));
update public.codigos_recuperacao set usado_em = now() where hash = repeat('c', 64);
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test');
select pg_temp.confere(public.meus_codigos_de_recuperacao() = 2, 'a pessoa vê quantos códigos ainda valem (os usados não contam)');
reset role;
select pg_temp.confere(public.usuario_do_email('ADMIN@epsilon.test') = '30000000-0000-0000-0000-00000000000b', 'o servidor acha a conta pelo e-mail, sem diferenciar maiúsculas');

\echo 'TODOS OS TESTES DA SEGURANÇA DA CONTA PASSARAM'
