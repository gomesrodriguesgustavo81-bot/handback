-- Testes da verificação em duas etapas exigida pelo banco.
-- Usa a empresa "Curso Epsilon" (04) e o dono "dono3" (04).
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
select pg_temp.confere((select exigir_duas_etapas from public.organizacoes where slug = 'curso-epsilon'), 'empresa nasce exigindo duas etapas');

set role authenticated;
-- 1) Professor só com a senha (aal1): não enxerga a empresa nem as entregas.
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test', 'aal1');
select pg_temp.confere(not public.pode_avaliar_org(current_setting('t.org')::uuid), 'só com a senha, não avalia');
select pg_temp.confere((select count(*) from public.organizacoes) = 0, 'só com a senha, não vê a empresa');
select pg_temp.confere((select count(*) from public.entregas) = 0, 'só com a senha, não vê entregas');
select pg_temp.confere((select count(*) from public.analises) = 0, 'só com a senha, não vê análises');
select pg_temp.confere(public.preciso_de_duas_etapas(), 'app sabe que ele precisa da segunda etapa');

-- 2) Com o código (aal2): vê tudo de novo.
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test', 'aal2');
select pg_temp.confere(public.pode_avaliar_org(current_setting('t.org')::uuid), 'com o código, avalia');
select pg_temp.confere((select count(*) from public.entregas) > 0, 'com o código, vê as entregas');

-- 3) Dono da plataforma só com a senha não tem poderes de dono.
select pg_temp.como('30000000-0000-0000-0000-00000000000a', 'dono3@handback.test', 'aal1');
select pg_temp.confere(not public.e_admin_plataforma(), 'dono só com a senha não é dono');
select pg_temp.confere(public.preciso_de_duas_etapas(), 'dono sempre precisa da segunda etapa');
select pg_temp.como('30000000-0000-0000-0000-00000000000a', 'dono3@handback.test', 'aal2');
select pg_temp.confere(public.e_admin_plataforma(), 'dono com o código é dono');

-- 4) A empresa pode deixar de exigir (decisão do administrador, que precisa estar com o código).
select pg_temp.como('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test', 'aal2');
update public.organizacoes set exigir_duas_etapas = false where id = current_setting('t.org')::uuid;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test', 'aal1');
select pg_temp.confere(public.pode_avaliar_org(current_setting('t.org')::uuid), 'empresa que não exige: senha basta');
-- Mesmo com a empresa "opcional", quem administra só entra com o código.
select pg_temp.como('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test', 'aal1');
select pg_temp.confere(not public.pode_gerir_org(current_setting('t.org')::uuid), 'empresa opcional: administrador só com a senha não gere');
select pg_temp.confere((select count(*) from public.organizacoes where id = current_setting('t.org')::uuid) = 0, 'empresa opcional: administrador só com a senha não vê a empresa');
select pg_temp.confere(public.preciso_de_duas_etapas(), 'empresa opcional: o app avisa que o administrador precisa da segunda etapa');
select pg_temp.como('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test', 'aal2');
select pg_temp.confere(public.pode_gerir_org(current_setting('t.org')::uuid), 'empresa opcional: administrador com o código gere');
reset role;
update public.organizacoes set exigir_duas_etapas = true where id = current_setting('t.org')::uuid;
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test', 'aal1');
update public.organizacoes set exigir_duas_etapas = false where id = current_setting('t.org')::uuid;
reset role;
select pg_temp.confere((select exigir_duas_etapas from public.organizacoes where id = current_setting('t.org')::uuid),
  'só com a senha, o admin não consegue desligar a exigência');

\echo 'TODOS OS TESTES DE ACESSO SEGURO PASSARAM'
