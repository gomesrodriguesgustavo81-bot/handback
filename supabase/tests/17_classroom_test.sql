-- Testes da ligação com o Google Classroom. Usa a empresa "Curso Epsilon" (04).
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

select set_config('t.org', (select id::text from public.organizacoes where slug = 'curso-epsilon'), false);

-- 1) A conexão do Classroom é um serviço Google próprio, e o token não é lido pelo navegador.
insert into public.conexoes_google (user_id, servico, email, token_cifrado)
  values ('30000000-0000-0000-0000-00000000000b', 'classroom', 'admin@epsilon.test', 'cifrado');
select pg_temp.erro_contem($$insert into public.conexoes_google (user_id, servico, email, token_cifrado) values ('30000000-0000-0000-0000-00000000000b', 'teams', 'x@x.test', 'x')$$,
  '23514', 'só serviços Google conhecidos');
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test');
select pg_temp.erro_contem($$select token_cifrado from public.conexoes_google$$, '42501', 'token do Classroom não é lido pelo navegador');
select public.registrar_acesso('conectou_classroom', '', '');
reset role;
select pg_temp.confere(exists (select 1 from public.atividades where acao = 'conectou_classroom' and tipo = 'seguranca'), 'conectar o Classroom fica no registro de segurança');

-- 2) Turma ligada a uma turma do Classroom (uma vez por professor), com ciclo e aluno vindos de lá.
insert into public.turmas (id, org_id, nome, modo, classroom_curso, classroom_curso_nome, classroom_por)
  values ('c1000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'Cálculo', 'grupos', '111', 'Cálculo I', '30000000-0000-0000-0000-00000000000b');
select pg_temp.erro_contem($$insert into public.turmas (org_id, nome, classroom_curso, classroom_por) values (current_setting('t.org')::uuid, 'Outra', '111', '30000000-0000-0000-0000-00000000000b')$$,
  '23505', 'a mesma turma do Classroom não vira duas turmas do mesmo professor');
insert into public.etapas (id, org_id, turma_id, numero, titulo, classroom_tarefa, classroom_nosso, classroom_nota_max)
  values ('c2000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'c1000000-0000-0000-0000-000000000001', 1, 'Lista 1', '501', false, 10),
         ('c2000000-0000-0000-0000-000000000002', current_setting('t.org')::uuid, 'c1000000-0000-0000-0000-000000000001', 2, 'Lista 2', '901', true, 10);
insert into public.grupos (id, org_id, turma_id, nome, classroom_aluno)
  values ('c3000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'c1000000-0000-0000-0000-000000000001', 'Ana Souza', '7');
select pg_temp.erro_contem($$insert into public.grupos (org_id, turma_id, nome, classroom_aluno) values (current_setting('t.org')::uuid, 'c1000000-0000-0000-0000-000000000001', 'Outra', '7')$$,
  '23505', 'o mesmo aluno do Classroom não vira dois cadastros');

-- 3) Entrega do Classroom: só o servidor grava; o mesmo envio não entra duas vezes; arquivos esperam.
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test');
select pg_temp.erro_contem($$select public.gravar_entrega_classroom(gen_random_uuid(), current_setting('t.org')::uuid, 'c2000000-0000-0000-0000-000000000001',
  'c3000000-0000-0000-0000-000000000001', 'x', 'x', now(), '', '{}', '[]', 'a:1', 'a')$$, '42501', 'o app não grava entrega do Classroom direto');
reset role;
set role service_role;
select pg_temp.confere((select (public.gravar_entrega_classroom('c4000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'c2000000-0000-0000-0000-000000000001',
  'c3000000-0000-0000-0000-000000000001', 'ana@aluno.test', 'Classroom · Lista 1', now(), '', '{https://youtu.be/x}', '[{"id": "drvAna1", "nome": "lista.pdf"}]', 'env1:2026', 'env1')).origem = 'classroom'),
  'entrega do Classroom gravada com a origem certa');
select pg_temp.confere((select public.gravar_entrega_classroom(gen_random_uuid(), current_setting('t.org')::uuid, 'c2000000-0000-0000-0000-000000000001',
  'c3000000-0000-0000-0000-000000000001', 'ana@aluno.test', 'Classroom · Lista 1', now(), '', '{}', '[]', 'env1:2026', 'env1') is null),
  'o mesmo envio do Classroom não entra duas vezes');
reset role;
select pg_temp.confere((select count(*) = 1 from public.classroom_pendentes where entrega_id = 'c4000000-0000-0000-0000-000000000001' and drive_id = 'drvAna1'),
  'o arquivo do Drive do aluno fica esperando o professor escolher');
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select pg_temp.confere((select count(*) = 1 from public.classroom_pendentes), 'quem avalia vê os arquivos esperando');
select pg_temp.erro_contem($$delete from public.classroom_pendentes$$, '42501', 'o app não mexe na espera direto');
select pg_temp.como('30000000-0000-0000-0000-00000000000d', 'admin@zeta.test');
select pg_temp.confere((select count(*) = 0 from public.classroom_pendentes), 'outra empresa não vê os arquivos esperando');
reset role;
set role service_role;
select pg_temp.erro_contem($$select public.guardar_arquivo_classroom('c4000000-0000-0000-0000-000000000001', 'drvAna1', '00000000-0000-0000-0000-000000000000/classroom/x/lista.pdf', 'lista.pdf', 10, 'application/pdf')$$,
  'fora da pasta', 'arquivo só entra na pasta da própria empresa');
select public.guardar_arquivo_classroom('c4000000-0000-0000-0000-000000000001', 'drvAna1', current_setting('t.org') || '/classroom/c4/lista.pdf', 'lista.pdf', 10, 'application/pdf');
select pg_temp.erro_contem($$select public.guardar_arquivo_classroom('c4000000-0000-0000-0000-000000000001', 'drvAna1', current_setting('t.org') || '/classroom/c4/de-novo.pdf', 'x', 1, '')$$,
  'não está esperando', 'só entra arquivo que estava esperando');
reset role;
select pg_temp.confere((select count(*) = 0 from public.classroom_pendentes) and (select count(*) = 1 from public.arquivos_entrega where entrega_id = 'c4000000-0000-0000-0000-000000000001'),
  'o arquivo escolhido entra na entrega e sai da espera');

-- 4) Nota no Classroom: só aprovada, só em tarefa criada pelo Handback, uma vez por vez.
insert into public.analises (entrega_id, org_id, status, iniciada_em, concluida_em, conceito, devolutiva, aprovada_em)
  values ('c4000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'aprovada', now(), now(), 'BOM', 'Boa lista!', now());
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select pg_temp.erro_contem($$select public.reservar_envio_classroom('c4000000-0000-0000-0000-000000000001')$$, 'criada pelo Handback', 'tarefa criada à mão no Classroom não recebe nota pelo Handback');
reset role;
set role service_role;
select public.gravar_entrega_classroom('c4000000-0000-0000-0000-000000000002', current_setting('t.org')::uuid, 'c2000000-0000-0000-0000-000000000002',
  'c3000000-0000-0000-0000-000000000001', 'ana@aluno.test', 'Classroom · Lista 2', now(), 'resposta', '{}', '[]', 'env2:2026', 'env2');
reset role;
insert into public.integrantes (org_id, turma_id, grupo_id, email, nome)
  values (current_setting('t.org')::uuid, 'c1000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'ana@aluno.test', 'Ana Souza');
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select pg_temp.erro_contem($$select public.reservar_envio_classroom('c4000000-0000-0000-0000-000000000002')$$, 'Aprove a devolutiva', 'não lança nota sem aprovar');
reset role;
insert into public.analises (entrega_id, org_id, status, iniciada_em, concluida_em, conceito, devolutiva, aprovada_em)
  values ('c4000000-0000-0000-0000-000000000002', current_setting('t.org')::uuid, 'aprovada', now(), now(), 'BOM', 'Muito bem!', now());
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select pg_temp.confere((select r ->> 'curso' = '111' and r ->> 'tarefa' = '901' and r ->> 'envio' = 'env2' and (r ->> 'porcentagem')::int = 80
  and (r ->> 'nota_max')::numeric = 10 and r -> 'emails' = '["ana@aluno.test"]'::jsonb and r ->> 'por' = '30000000-0000-0000-0000-00000000000b'
  from (select public.reservar_envio_classroom('c4000000-0000-0000-0000-000000000002') r) x), 'reserva devolve a tarefa, o envio, os e-mails e a porcentagem');
select pg_temp.erro_contem($$select public.reservar_envio_classroom('c4000000-0000-0000-0000-000000000002')$$, 'já está indo', 'não lança duas vezes ao mesmo tempo');
select public.concluir_envio_classroom('c4000000-0000-0000-0000-000000000002', true, 8, '');
select pg_temp.confere((select classroom_status = 'enviada' and classroom_nota = 8 from public.analises where entrega_id = 'c4000000-0000-0000-0000-000000000002'),
  'nota lançada fica registrada');
select pg_temp.como('30000000-0000-0000-0000-00000000000d', 'admin@zeta.test');
select pg_temp.erro_contem($$select public.reservar_envio_classroom('c4000000-0000-0000-0000-000000000002')$$, 'não encontrada', 'outra empresa não lança nota alheia');
reset role;
select pg_temp.confere(exists (select 1 from public.atividades where acao = 'devolveu_classroom' and descricao like '%(8,0)'), 'lançar a nota fica no registro');

\echo
\echo 'TODOS OS TESTES DO CLASSROOM PASSARAM'
