-- Testes das regras de acesso da Fase 1 (etapas, grupos, integrantes, pessoas).
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

-- Pessoas de mentira desta bateria
insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-00000000000a', 'dono1@handback.test'),
  ('10000000-0000-0000-0000-00000000000b', 'admin@curso.test'),
  ('10000000-0000-0000-0000-00000000000c', 'prof@curso.test'),
  ('10000000-0000-0000-0000-00000000000d', 'aluno@curso.test'),
  ('10000000-0000-0000-0000-00000000000e', 'admin@outra.test');
insert into public.administradores_plataforma (user_id) values ('10000000-0000-0000-0000-00000000000a');

set role authenticated;
select pg_temp.como('10000000-0000-0000-0000-00000000000a', 'dono1@handback.test');
select public.criar_organizacao('Curso Gama', 'curso-gama', 'educacao', 'admin@curso.test');
select public.criar_organizacao('Outra Empresa', 'outra-empresa', 'empresa', 'admin@outra.test');
reset role;
select set_config('teste.gama', (select id::text from public.organizacoes where slug = 'curso-gama'), false);
select set_config('teste.outra', (select id::text from public.organizacoes where slug = 'outra-empresa'), false);
set role authenticated;

-- 1) Admin do curso cadastra aula, equipe e convida professor e aluno.
select pg_temp.como('10000000-0000-0000-0000-00000000000b', 'admin@curso.test');
select public.aceitar_convites();
insert into public.etapas (org_id, numero, titulo, recebe_de, recebe_ate, entregaveis, criterios)
  values (current_setting('teste.gama')::uuid, 1, 'Diagnóstico', '2026-12-01', '2026-12-07',
          array['Mapa de stakeholders', 'Problema em uma frase'], 'Clareza e evidências');
select pg_temp.confere((select cardinality(entregaveis) from public.etapas) = 2, 'admin cadastra aula com 2 itens no checklist');
insert into public.grupos (org_id, nome, tema) values (current_setting('teste.gama')::uuid, 'Equipe Azul', 'Saúde');
insert into public.integrantes (org_id, grupo_id, email)
  select current_setting('teste.gama')::uuid, id, 'a1@aluno.test' from public.grupos where nome = 'Equipe Azul';
select pg_temp.confere((select count(*) from public.integrantes) = 1, 'admin cadastra integrante');
insert into public.convites (org_id, email, papel, criado_por) values
  (current_setting('teste.gama')::uuid, 'prof@curso.test', 'avaliador', auth.uid()),
  (current_setting('teste.gama')::uuid, 'aluno@curso.test', 'participante', auth.uid());

do $$ begin
  insert into public.etapas (org_id, numero, titulo) values (current_setting('teste.gama')::uuid, 1, 'Repetida');
  raise exception 'FALHOU: número de aula repetido';
exception when unique_violation then raise notice 'ok: número de aula não se repete';
end $$;
do $$ begin
  insert into public.grupos (org_id, nome) values (current_setting('teste.gama')::uuid, ' equipe azul ');
  raise exception 'FALHOU: nome de equipe repetido';
exception when unique_violation then raise notice 'ok: nome de equipe não se repete (ignora maiúsculas)';
end $$;
do $$ begin
  insert into public.grupos (org_id, nome) values (current_setting('teste.gama')::uuid, 'Equipe Verde');
  insert into public.integrantes (org_id, grupo_id, email)
    select current_setting('teste.gama')::uuid, id, 'a1@aluno.test' from public.grupos where nome = 'Equipe Verde';
  raise exception 'FALHOU: mesmo e-mail em duas equipes';
exception when unique_violation then raise notice 'ok: um e-mail entrega por uma só equipe';
end $$;
do $$ begin
  update public.etapas set recebe_de = '2026-12-10', recebe_ate = '2026-12-01';
  raise exception 'FALHOU: período invertido';
exception when check_violation then raise notice 'ok: período de recebimento precisa estar em ordem';
end $$;
select pg_temp.confere(
  (select count(*) from public.pessoas_da_org(current_setting('teste.gama')::uuid)) = 1,
  'admin vê a lista de pessoas (só ele por enquanto)');

-- 2) Admin não consegue deixar a empresa sem administrador.
do $$ begin
  update public.membros set papel = 'avaliador' where user_id = auth.uid();
  raise exception 'FALHOU: último admin rebaixado';
exception when raise_exception then
  if sqlerrm like 'FALHOU%' then raise; end if;
  raise notice 'ok: último admin não pode ser rebaixado';
end $$;

-- 3) Professor (avaliador) vê aulas e equipes, mas não altera nada nem vê pessoas.
select pg_temp.como('10000000-0000-0000-0000-00000000000c', 'prof@curso.test');
select pg_temp.confere(public.aceitar_convites() = 1, 'professor aceita o convite');
select pg_temp.confere((select count(*) from public.etapas) = 1, 'professor vê as aulas');
select pg_temp.confere((select count(*) from public.grupos) = 1, 'professor vê as equipes');
select pg_temp.confere((select count(*) from public.integrantes) = 1, 'professor vê os e-mails das equipes');
select pg_temp.confere(
  (select count(*) from public.pessoas_da_org(current_setting('teste.gama')::uuid)) = 0,
  'professor não vê a lista de pessoas');
do $$
declare n integer;
begin
  update public.etapas set titulo = 'Mudado pelo professor';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: professor alterou a aula'; end if;
  raise notice 'ok: professor não altera aulas';
end $$;
do $$ begin
  insert into public.grupos (org_id, nome) values (current_setting('teste.gama')::uuid, 'Do professor');
  raise exception 'FALHOU: professor criou equipe';
exception when insufficient_privilege then raise notice 'ok: professor não cria equipes';
end $$;

-- 4) Aluno (participante) vê as aulas, mas não as equipes nem os e-mails.
select pg_temp.como('10000000-0000-0000-0000-00000000000d', 'aluno@curso.test');
select public.aceitar_convites();
select pg_temp.confere((select count(*) from public.etapas) = 1, 'aluno vê as aulas');
select pg_temp.confere((select count(*) from public.grupos) = 0, 'aluno não vê as equipes');
select pg_temp.confere((select count(*) from public.integrantes) = 0, 'aluno não vê e-mails');

-- 5) Admin de outra empresa não vê nada do curso nem consegue enfiar dados nele.
select pg_temp.como('10000000-0000-0000-0000-00000000000e', 'admin@outra.test');
select public.aceitar_convites();
select pg_temp.confere((select count(*) from public.etapas) = 0, 'outra empresa não vê as aulas do curso');
select pg_temp.confere((select count(*) from public.grupos) = 0, 'outra empresa não vê as equipes do curso');
do $$ begin
  insert into public.etapas (org_id, numero, titulo) values (current_setting('teste.gama')::uuid, 9, 'Intrusa');
  raise exception 'FALHOU: outra empresa criou aula no curso';
exception when insufficient_privilege then raise notice 'ok: outra empresa não cria aula no curso';
end $$;
insert into public.grupos (org_id, nome) values (current_setting('teste.outra')::uuid, 'Time Próprio');
insert into public.integrantes (org_id, grupo_id, email)
  select current_setting('teste.outra')::uuid, g.id, 'x@x.test' from public.grupos g;
select pg_temp.confere((select count(*) from public.integrantes) = 1, 'outra empresa cadastra integrante no próprio time');
reset role;
do $$
declare grupo_curso uuid := (select id from public.grupos where nome = 'Equipe Azul');
begin
  perform set_config('teste.grupo_curso', grupo_curso::text, false);
end $$;
set role authenticated;
do $$ begin
  insert into public.integrantes (org_id, grupo_id, email)
    values (current_setting('teste.outra')::uuid, current_setting('teste.grupo_curso')::uuid, 'z@z.test');
  raise exception 'FALHOU: integrante da outra empresa num grupo do curso';
exception when raise_exception then
  if sqlerrm like 'FALHOU%' then raise; end if;
  raise notice 'ok: não dá para colocar integrante em grupo de outra empresa';
end $$;

-- 6) Vocabulário não pode ficar incompleto.
select pg_temp.como('10000000-0000-0000-0000-00000000000b', 'admin@curso.test');
do $$ begin
  update public.organizacoes set vocabulario = '{"etapa":"Encontro"}' where slug = 'curso-gama';
  raise exception 'FALHOU: vocabulário incompleto aceito';
exception when check_violation then raise notice 'ok: vocabulário precisa ter todas as palavras';
end $$;
update public.organizacoes set vocabulario = vocabulario || '{"etapa":"Encontro","etapas":"Encontros"}' where slug = 'curso-gama';
select pg_temp.confere(
  (select vocabulario ->> 'etapas' from public.organizacoes where slug = 'curso-gama') = 'Encontros',
  'admin troca "Aulas" por "Encontros"');
reset role;

\echo 'TODOS OS TESTES DE CADASTROS PASSARAM'
