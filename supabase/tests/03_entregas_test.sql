-- Testes das regras de acesso da Fase 2 (entregas pelo site).
\set ON_ERROR_STOP on
\pset tuples_only on

create or replace function pg_temp.como(uid uuid, email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, false);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email)::text, false);
end $$;

create or replace function pg_temp.confere(ok boolean, o_que text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FALHOU: %', o_que; end if;
  raise notice 'ok: %', o_que;
end $$;

insert into auth.users (id, email) values
  ('20000000-0000-0000-0000-00000000000a', 'dono2@handback.test'),
  ('20000000-0000-0000-0000-00000000000b', 'admin@delta.test'),
  ('20000000-0000-0000-0000-00000000000c', 'aluna@delta.test'),
  ('20000000-0000-0000-0000-00000000000d', 'aluno-verde@delta.test'),
  ('20000000-0000-0000-0000-00000000000e', 'estranho@x.test');
insert into public.administradores_plataforma (user_id) values ('20000000-0000-0000-0000-00000000000a');

-- Monta o cenário: curso Delta, aula 1 (prazo já passou) e aula 2 (prazo futuro),
-- equipe Azul (aluna) e equipe Verde (aluno-verde).
set role authenticated;
select pg_temp.como('20000000-0000-0000-0000-00000000000a', 'dono2@handback.test');
select public.criar_organizacao('Curso Delta', 'curso-delta', 'educacao', 'admin@delta.test');
select pg_temp.como('20000000-0000-0000-0000-00000000000b', 'admin@delta.test');
select public.aceitar_convites();
reset role;
select set_config('t.org', (select id::text from public.organizacoes where slug = 'curso-delta'), false);
insert into public.etapas (id, org_id, numero, titulo, recebe_ate) values
  ('21000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 1, 'Passada', current_date - 3),
  ('21000000-0000-0000-0000-000000000002', current_setting('t.org')::uuid, 2, 'Futura', current_date + 30);
insert into public.grupos (id, org_id, nome) values
  ('22000000-0000-0000-0000-00000000000a', current_setting('t.org')::uuid, 'Azul'),
  ('22000000-0000-0000-0000-00000000000b', current_setting('t.org')::uuid, 'Verde');
insert into public.integrantes (org_id, grupo_id, email) values
  (current_setting('t.org')::uuid, '22000000-0000-0000-0000-00000000000a', 'aluna@delta.test'),
  (current_setting('t.org')::uuid, '22000000-0000-0000-0000-00000000000b', 'aluno-verde@delta.test');
set role authenticated;

-- 1) A aluna (só cadastrada como e-mail da equipe) vê a empresa, as aulas e a própria equipe.
select pg_temp.como('20000000-0000-0000-0000-00000000000c', 'aluna@delta.test');
select pg_temp.confere((select count(*) from public.organizacoes) = 1, 'integrante vê a empresa');
select pg_temp.confere((select count(*) from public.etapas) = 2, 'integrante vê as aulas');
select pg_temp.confere((select count(*) from public.grupos) = 1, 'integrante vê só a própria equipe');
select pg_temp.confere((select count(*) from public.integrantes) = 1, 'integrante vê só os colegas da equipe');

-- 2) Ela envia um arquivo para a pasta da equipe e registra a entrega da aula 2 (no prazo).
insert into storage.objects (bucket_id, name) values
  ('entregas', current_setting('t.org') || '/22000000-0000-0000-0000-00000000000a/23000000-0000-0000-0000-000000000001/relatorio.pdf');
select pg_temp.confere(
  (select status from public.registrar_entrega(
     '23000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000002',
     '22000000-0000-0000-0000-00000000000a', 'Segue', array['https://exemplo.com/deck'],
     jsonb_build_array(jsonb_build_object(
       'caminho', current_setting('t.org') || '/22000000-0000-0000-0000-00000000000a/23000000-0000-0000-0000-000000000001/relatorio.pdf',
       'nome', 'relatorio.pdf', 'tamanho', 1000, 'tipo', 'application/pdf')))) = 'recebida',
  'integrante registra a entrega');
select pg_temp.confere((select not atrasada and registrada_pela_equipe from public.entregas) , 'entrega no prazo, feita pela equipe');
select pg_temp.confere((select count(*) from public.arquivos_entrega) = 1, 'arquivo ligado à entrega');

-- 3) Reenvio: a anterior vira "substituída".
select public.registrar_entrega('23000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000002',
  '22000000-0000-0000-0000-00000000000a', 'Versão final', '{}', '[]');
select pg_temp.confere(
  (select string_agg(status::text, ',' order by enviada_em, id) from public.entregas) = 'substituida,recebida',
  'reenvio deixa a anterior substituída');

-- 4) Entrega da aula 1 (prazo passou) fica com atraso.
select pg_temp.confere(
  (select atrasada from public.registrar_entrega('23000000-0000-0000-0000-000000000003',
     '21000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-00000000000a', 'Atrasei', '{}', '[]')),
  'entrega depois do prazo fica com atraso');

-- 5) Ela não entrega pela outra equipe, nem põe arquivo na pasta dela, nem registra vazio.
do $$ begin
  perform public.registrar_entrega('23000000-0000-0000-0000-000000000004', '21000000-0000-0000-0000-000000000002',
    '22000000-0000-0000-0000-00000000000b', 'Intrusa', '{}', '[]');
  raise exception 'FALHOU: entregou pela outra equipe';
exception when raise_exception then
  if sqlerrm like 'FALHOU%' then raise; end if;
  raise notice 'ok: integrante não entrega por outra equipe';
end $$;
do $$ begin
  insert into storage.objects (bucket_id, name) values
    ('entregas', current_setting('t.org') || '/22000000-0000-0000-0000-00000000000b/23000000-0000-0000-0000-000000000009/x.pdf');
  raise exception 'FALHOU: arquivo na pasta da outra equipe';
exception when insufficient_privilege then raise notice 'ok: integrante não põe arquivo na pasta de outra equipe';
end $$;
do $$ begin
  perform public.registrar_entrega('23000000-0000-0000-0000-000000000005', '21000000-0000-0000-0000-000000000002',
    '22000000-0000-0000-0000-00000000000a', '  ', '{""}', '[]');
  raise exception 'FALHOU: entrega vazia aceita';
exception when raise_exception then
  if sqlerrm like 'FALHOU%' then raise; end if;
  raise notice 'ok: entrega vazia é recusada';
end $$;
do $$ begin
  perform public.registrar_entrega('23000000-0000-0000-0000-000000000006', '21000000-0000-0000-0000-000000000002',
    '22000000-0000-0000-0000-00000000000a', 'Com arquivo de outra pasta', '{}',
    jsonb_build_array(jsonb_build_object('caminho', current_setting('t.org') || '/22000000-0000-0000-0000-00000000000a/23000000-0000-0000-0000-000000000001/relatorio.pdf')));
  raise exception 'FALHOU: arquivo de outra entrega aceito';
exception when raise_exception then
  if sqlerrm like 'FALHOU%' then raise; end if;
  raise notice 'ok: arquivo precisa estar na pasta da própria entrega';
end $$;
do $$ begin
  insert into public.entregas (id, org_id, etapa_id, grupo_id, enviada_por_email)
    values (gen_random_uuid(), current_setting('t.org')::uuid, '21000000-0000-0000-0000-000000000002', '22000000-0000-0000-0000-00000000000a', 'x');
  raise exception 'FALHOU: gravou entrega direto na tabela';
exception when insufficient_privilege then raise notice 'ok: entrega só entra pela função que confere tudo';
end $$;

-- 6) O colega da outra equipe não vê as entregas nem os arquivos da Azul.
select pg_temp.como('20000000-0000-0000-0000-00000000000d', 'aluno-verde@delta.test');
select pg_temp.confere((select count(*) from public.entregas) = 0, 'outra equipe não vê as entregas da Azul');
select pg_temp.confere((select count(*) from public.arquivos_entrega) = 0, 'outra equipe não vê os arquivos da Azul');
select pg_temp.confere((select count(*) from storage.objects) = 0, 'outra equipe não abre os arquivos da Azul');

-- 7) O admin vê tudo e registra pela equipe Verde (fica marcado como registrado por quem avalia).
select pg_temp.como('20000000-0000-0000-0000-00000000000b', 'admin@delta.test');
select pg_temp.confere((select count(*) from public.entregas) = 3, 'admin vê todas as entregas');
select pg_temp.confere((select count(*) from storage.objects) = 1, 'admin abre os arquivos');
select pg_temp.confere(
  (select not registrada_pela_equipe from public.registrar_entrega('23000000-0000-0000-0000-000000000007',
     '21000000-0000-0000-0000-000000000002', '22000000-0000-0000-0000-00000000000b', 'Recebido em mãos', '{}', '[]')),
  'admin registra pela equipe (marcado como registro de quem avalia)');

-- 8) Equipe pausada não entrega; estranho não vê nada.
reset role;
update public.grupos set ativo = false where id = '22000000-0000-0000-0000-00000000000b';
set role authenticated;
select pg_temp.como('20000000-0000-0000-0000-00000000000d', 'aluno-verde@delta.test');
select pg_temp.confere((select count(*) from public.etapas) = 0, 'integrante de equipe pausada perde o acesso');
select pg_temp.como('20000000-0000-0000-0000-00000000000e', 'estranho@x.test');
select pg_temp.confere((select count(*) from public.entregas) + (select count(*) from public.etapas) + (select count(*) from storage.objects) = 0,
  'estranho não vê entregas, aulas nem arquivos');
reset role;

\echo 'TODOS OS TESTES DE ENTREGAS PASSARAM'
