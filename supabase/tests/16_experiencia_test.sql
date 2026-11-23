-- Testes dos 14 primeiros dias só com a senha. Usa a empresa "Curso Epsilon" (04), que exige duas etapas.
\set ON_ERROR_STOP on
\pset tuples_only on

create or replace function pg_temp.como(uid uuid, email text, aal text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, false);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'aal', aal)::text, false);
end $$;
create or replace function pg_temp.confere(ok boolean, o_que text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FALHOU: %', o_que; end if;
  raise notice 'ok: %', o_que;
end $$;

select set_config('t.org', (select id::text from public.organizacoes where slug = 'curso-epsilon'), false);
update public.organizacoes set exigir_duas_etapas = true where id = current_setting('t.org')::uuid;

-- 1) Conta antiga, só com a senha: continua bloqueada.
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test', 'aal1');
select pg_temp.confere(not public.em_experiencia(), 'conta antiga não está na experiência');
select pg_temp.confere(public.fim_da_experiencia() is null, 'conta antiga não tem prazo');
select pg_temp.confere(not public.pode_avaliar_org(current_setting('t.org')::uuid), 'conta antiga só com a senha não avalia');
reset role;

-- 2) Conta nova (2 dias): entra só com a senha.
update auth.users set created_at = now() - interval '2 days' where id = '30000000-0000-0000-0000-00000000000c';
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test', 'aal1');
select pg_temp.confere(public.em_experiencia(), 'conta nova está na experiência');
select pg_temp.confere(public.fim_da_experiencia() > now() + interval '11 days', 'prazo é 14 dias depois de criar a conta');
select pg_temp.confere(public.pode_avaliar_org(current_setting('t.org')::uuid), 'conta nova avalia só com a senha');
select pg_temp.confere((select count(*) from public.entregas) > 0, 'conta nova vê as entregas');
reset role;

-- 3) Cadastrou o app: a partir daí precisa do código.
insert into auth.mfa_factors (user_id, status) values ('30000000-0000-0000-0000-00000000000c', 'verified');
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test', 'aal1');
select pg_temp.confere(not public.em_experiencia(), 'com o app cadastrado, acaba a experiência');
select pg_temp.confere(not public.pode_avaliar_org(current_setting('t.org')::uuid), 'com o app cadastrado, precisa do código');
reset role;
delete from auth.mfa_factors where user_id = '30000000-0000-0000-0000-00000000000c';

-- 4) Passou de 14 dias: volta a exigir.
update auth.users set created_at = now() - interval '15 days' where id = '30000000-0000-0000-0000-00000000000c';
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test', 'aal1');
select pg_temp.confere(not public.pode_avaliar_org(current_setting('t.org')::uuid), 'depois de 14 dias, precisa do código');
reset role;

-- 5) O dono da plataforma nunca tem experiência.
update auth.users set created_at = now() where id = '30000000-0000-0000-0000-00000000000a';
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000a', 'dono3@handback.test', 'aal1');
select pg_temp.confere(not public.em_experiencia(), 'dono não tem os 14 dias');
select pg_temp.confere(not public.e_admin_plataforma(), 'dono novo só com a senha não é dono');
reset role;
update auth.users set created_at = '2020-01-01' where id in ('30000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-00000000000c');

\echo 'TODOS OS TESTES DOS 14 DIAS PASSARAM'
