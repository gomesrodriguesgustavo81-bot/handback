-- Testes da ligação com o Moodle. Usa a empresa "Curso Epsilon" (04).
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

-- 1) Só quem administra liga o Moodle; o token nunca é lido pelo navegador.
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select pg_temp.erro_contem($$select public.salvar_conta_moodle(current_setting('t.org')::uuid, 'https://ava.test', 'AVA', 7, 'Prof', 'cifrado')$$,
  'Só quem administra', 'avaliador não liga o Moodle');
select pg_temp.como('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test');
select set_config('t.conta', public.salvar_conta_moodle(current_setting('t.org')::uuid, 'https://ava.test', 'AVA Teste', 7, 'Admin Epsilon', 'cifrado-1')::text, false);
select pg_temp.confere(public.salvar_conta_moodle(current_setting('t.org')::uuid, 'https://ava.test', 'AVA Teste', 7, 'Admin Epsilon', 'cifrado-2')::text = current_setting('t.conta'),
  'ligar de novo o mesmo Moodle renova a mesma conexão');
select pg_temp.confere((select count(*) = 1 and min(nome) = 'Admin Epsilon' from public.contas_moodle), 'quem ligou vê a conexão');
select pg_temp.erro_contem($$select token_cifrado from public.contas_moodle$$, '42501', 'token do Moodle não é lido pelo navegador');
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select pg_temp.confere((select count(*) = 0 from public.contas_moodle), 'outra pessoa não vê a conexão de quem ligou');
select pg_temp.erro_contem($$select public.desligar_conta_moodle(current_setting('t.conta')::uuid)$$, 'não encontrada', 'outra pessoa não desliga a conexão alheia');
reset role;
select pg_temp.confere((select token_cifrado = 'cifrado-2' from public.contas_moodle where id = current_setting('t.conta')::uuid), 'servidor lê o token mais novo');
select pg_temp.confere(exists (select 1 from public.atividades where acao = 'conectou_moodle' and descricao like 'Ligou o Moodle https://ava.test%'),
  'ligar o Moodle fica no registro');

-- 2) Turma ligada a uma disciplina (uma vez só), com tarefa e grupo vindos do Moodle.
insert into public.turmas (id, org_id, nome, modo, moodle_conta, moodle_curso, moodle_curso_nome)
  values ('a1000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'Design de Interação', 'grupos', current_setting('t.conta')::uuid, 55, 'Design de Interação');
select pg_temp.erro_contem($$insert into public.turmas (org_id, nome, moodle_conta, moodle_curso) values (current_setting('t.org')::uuid, 'Outra', current_setting('t.conta')::uuid, 55)$$,
  '23505', 'a mesma disciplina não vira duas turmas');
insert into public.etapas (id, org_id, turma_id, numero, titulo, entregaveis, moodle_tarefa, moodle_em_grupo, moodle_nota_max)
  values ('a2000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'a1000000-0000-0000-0000-000000000001', 1, 'Protótipo', array['Protótipo'], 901, true, 10);
insert into public.grupos (id, org_id, turma_id, nome, moodle_id, moodle_membros)
  values ('a3000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'a1000000-0000-0000-0000-000000000001', 'Grupo Azul', 'g:12', array[101, 102]);
select pg_temp.erro_contem($$insert into public.grupos (org_id, turma_id, nome, moodle_id) values (current_setting('t.org')::uuid, 'a1000000-0000-0000-0000-000000000001', 'Outro', 'g:12')$$,
  '23505', 'o mesmo grupo do Moodle não aparece duas vezes');
select pg_temp.erro_contem($$insert into public.grupos (org_id, turma_id, nome, moodle_id) values (current_setting('t.org')::uuid, 'a1000000-0000-0000-0000-000000000001', 'Ruim', 'x:1')$$,
  '23514', 'código do Moodle no formato certo');

-- 3) Entrega do Moodle: só o servidor grava, e o mesmo envio não entra duas vezes.
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test');
select pg_temp.erro_contem($$select public.gravar_entrega_moodle(gen_random_uuid(), current_setting('t.org')::uuid, 'a2000000-0000-0000-0000-000000000001',
  'a3000000-0000-0000-0000-000000000001', 'x', 'x', now(), 'x', '{}', '[]', '1:1')$$, '42501', 'o app não grava entrega do Moodle direto');
reset role;
set role service_role;
select pg_temp.confere((select (public.gravar_entrega_moodle('a4000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'a2000000-0000-0000-0000-000000000001',
  'a3000000-0000-0000-0000-000000000001', 'ana@aluno.test', 'Moodle · Protótipo', now() - interval '1 hour', 'Link do Figma', '{}', '[]', '77:1700000000')).origem = 'moodle'),
  'entrega do Moodle gravada com a origem certa');
select pg_temp.confere((select public.gravar_entrega_moodle(gen_random_uuid(), current_setting('t.org')::uuid, 'a2000000-0000-0000-0000-000000000001',
  'a3000000-0000-0000-0000-000000000001', 'ana@aluno.test', 'Moodle · Protótipo', now(), 'de novo', '{}', '[]', '77:1700000000') is null),
  'o mesmo envio do Moodle não entra duas vezes');
reset role;
select pg_temp.confere((select count(*) = 1 from public.entregas where etapa_id = 'a2000000-0000-0000-0000-000000000001'), 'só uma entrega gravada');
select pg_temp.confere(exists (select 1 from public.atividades where acao = 'chegou_moodle' and alvo_id = 'a4000000-0000-0000-0000-000000000001'),
  'chegada pelo Moodle fica no registro');

-- 4) Devolver no Moodle: só aprovada, uma vez por vez, com a porcentagem do conceito.
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select pg_temp.erro_contem($$select public.reservar_envio_moodle('a4000000-0000-0000-0000-000000000001')$$, 'Aprove a devolutiva', 'não devolve sem aprovar');
reset role;
insert into public.analises (entrega_id, org_id, status, iniciada_em, concluida_em, conceito, devolutiva, aprovada_em)
  values ('a4000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'aprovada', now(), now(), 'BOM', 'Pessoal, boa entrega!', now());
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select pg_temp.confere((select (r ->> 'tarefa')::int = 901 and (r ->> 'em_grupo')::boolean and (r -> 'membros') = '[101, 102]'::jsonb
  and (r ->> 'porcentagem')::int = 80 and (r ->> 'nota_max')::numeric = 10 and (r ->> 'conta') = current_setting('t.conta')
  from (select public.reservar_envio_moodle('a4000000-0000-0000-0000-000000000001') r) x), 'reserva devolve tarefa, membros e porcentagem do conceito');
select pg_temp.erro_contem($$select public.reservar_envio_moodle('a4000000-0000-0000-0000-000000000001')$$, 'já está sendo enviada', 'não devolve duas vezes ao mesmo tempo');
select public.concluir_envio_moodle('a4000000-0000-0000-0000-000000000001', true, 8, '');
select pg_temp.confere((select moodle_status = 'enviada' and moodle_nota = 8 and moodle_enviada_em is not null
  from public.analises where entrega_id = 'a4000000-0000-0000-0000-000000000001'), 'devolução registrada com a nota');
select public.reservar_envio_moodle('a4000000-0000-0000-0000-000000000001');
select public.concluir_envio_moodle('a4000000-0000-0000-0000-000000000001', false, null, 'Moodle fora do ar');
select pg_temp.confere((select moodle_status = 'enviada' and moodle_erro = 'Moodle fora do ar' and moodle_nota = 8
  from public.analises where entrega_id = 'a4000000-0000-0000-0000-000000000001'), 'falha numa nova devolução não apaga a anterior');
select pg_temp.como('30000000-0000-0000-0000-00000000000d', 'admin@zeta.test');
select pg_temp.erro_contem($$select public.reservar_envio_moodle('a4000000-0000-0000-0000-000000000001')$$, 'não encontrada', 'outra empresa não devolve entrega alheia');
reset role;
select pg_temp.confere(exists (select 1 from public.atividades where acao = 'devolveu_moodle' and descricao like '%Grupo Azul%(nota 8,0)'),
  'devolução no Moodle fica no registro, com a nota');

-- 5) Desligar o Moodle: a turma fica, mas sem conexão.
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test');
select public.desligar_conta_moodle(current_setting('t.conta')::uuid);
reset role;
select pg_temp.confere((select moodle_conta is null and moodle_curso = 55 from public.turmas where id = 'a1000000-0000-0000-0000-000000000001'),
  'desligar mantém a turma e as entregas, sem a conexão');
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select pg_temp.erro_contem($$select public.reservar_envio_moodle('a4000000-0000-0000-0000-000000000001')$$, 'não está mais ligada', 'turma desligada avisa para ligar de novo');
reset role;

\echo
\echo 'TODOS OS TESTES DO MOODLE PASSARAM'
