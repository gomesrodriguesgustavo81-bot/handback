-- Testes das escolhas "o professor decide". Usa a empresa "Curso Epsilon" (04); "Zeta" é outra empresa.
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

insert into public.turmas (id, org_id, nome, modo) values ('f5000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'Escolhas', 'grupos');
insert into public.etapas (id, org_id, turma_id, numero, titulo, entregaveis) values
  ('f5100000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'f5000000-0000-0000-0000-000000000001', 1, 'Única', '{Lista}');
insert into public.grupos (id, org_id, turma_id, nome) values ('f5200000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'f5000000-0000-0000-0000-000000000001', 'Equipe Teste');
insert into public.entregas (id, org_id, etapa_id, grupo_id, origem, enviada_em) values
  ('f5300000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'f5100000-0000-0000-0000-000000000001', 'f5200000-0000-0000-0000-000000000001', 'manual', now());
insert into public.analises (entrega_id, org_id, status) values ('f5300000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'analisando');

-- Roda uma análise nova (a IA diz BOM) como o professor.
create or replace function pg_temp.analisar() returns void language plpgsql as $$
begin
  reset role;
  update public.analises set status = 'analisando' where entrega_id = 'f5300000-0000-0000-0000-000000000001';
  set role authenticated;
  perform pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
  perform public.gravar_analise('f5300000-0000-0000-0000-000000000001', jsonb_build_object('modelo', 'teste', 'segundos', 1, 'conceito', 'BOM', 'devolutiva', 'Pessoal, ok.'));
end $$;

-- 1) Padrão: a escolha é exigida, a sugestão vem como rascunho.
select pg_temp.analisar();
reset role;
select pg_temp.confere((select conceito = 'BOM' and conceito_ia = 'BOM' and not conceito_escolhido from public.analises where entrega_id = 'f5300000-0000-0000-0000-000000000001'), 'padrão: sugestão da IA como rascunho, ainda não escolhido');
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select pg_temp.erro_contem($$select public.revisar_devolutiva('f5300000-0000-0000-0000-000000000001', 'BOM', 'Pessoal, ok.', true)$$, 'Escolha o conceito antes de aprovar', 'aprovar sem escolher o conceito não passa');
select pg_temp.erro_contem($$select public.revisar_devolutiva('f5300000-0000-0000-0000-000000000001', 'PENDENTE', 'Pessoal, ok.', true, '', true)$$, 'Escolha o conceito antes de aprovar', 'aprovar com conceito em branco não passa quando a escolha é exigida');
select public.revisar_devolutiva('f5300000-0000-0000-0000-000000000001', 'BOM', 'Pessoal, ok.', false);
reset role;
select pg_temp.confere((select not conceito_escolhido and status = 'pronta' from public.analises where entrega_id = 'f5300000-0000-0000-0000-000000000001'), 'salvar rascunho sem escolher não conta como escolha');
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select public.revisar_devolutiva('f5300000-0000-0000-0000-000000000001', 'BOM', 'Pessoal, ok.', true, '', true);
reset role;
select pg_temp.confere((select conceito_escolhido and status = 'aprovada' and aprovada_por is not null from public.analises where entrega_id = 'f5300000-0000-0000-0000-000000000001'), 'escolhendo, a aprovação passa e fica registrada como escolha do professor');

-- 2) Reanálise: a escolha anterior não vale mais.
select pg_temp.analisar();
reset role;
select pg_temp.confere((select not conceito_escolhido from public.analises where entrega_id = 'f5300000-0000-0000-0000-000000000001'), 'reanálise zera a escolha anterior');

-- 3) Sem sugestão (na conta): o conceito começa em branco, mas a IA registra o que achou.
update public.organizacoes set ia_sem_sugestao = true where id = current_setting('t.org')::uuid;
select pg_temp.analisar();
reset role;
select pg_temp.confere((select conceito = 'PENDENTE' and conceito_ia = 'BOM' from public.analises where entrega_id = 'f5300000-0000-0000-0000-000000000001'), 'sem sugestão: o conceito vem em branco e a IA guarda o que achou');
-- 4) A turma pode mudar o que a conta definiu.
update public.turmas set ia_sem_sugestao = false where id = 'f5000000-0000-0000-0000-000000000001';
select pg_temp.analisar();
reset role;
select pg_temp.confere((select conceito = 'BOM' from public.analises where entrega_id = 'f5300000-0000-0000-0000-000000000001'), 'a turma muda o que a conta definiu');
update public.turmas set ia_sem_sugestao = null where id = 'f5000000-0000-0000-0000-000000000001';
update public.organizacoes set ia_sem_sugestao = false where id = current_setting('t.org')::uuid;

-- 5) Escolha desligada: aprovar sem escolher passa, e o registro diz que foi a sugestão aceita.
update public.turmas set ia_exigir_conceito = false where id = 'f5000000-0000-0000-0000-000000000001';
select pg_temp.analisar();
select public.revisar_devolutiva('f5300000-0000-0000-0000-000000000001', 'BOM', 'Pessoal, ok.', true);
reset role;
select pg_temp.confere((select status = 'aprovada' and not conceito_escolhido and conceito = conceito_ia from public.analises where entrega_id = 'f5300000-0000-0000-0000-000000000001'), 'com a escolha desligada, aceitar a sugestão passa e fica registrado como tal');
update public.turmas set ia_exigir_conceito = null where id = 'f5000000-0000-0000-0000-000000000001';

-- 6) Motivo da mudança, quando a conta pede.
update public.organizacoes set ia_pedir_motivo = true where id = current_setting('t.org')::uuid;
select pg_temp.analisar();
select pg_temp.erro_contem($$select public.revisar_devolutiva('f5300000-0000-0000-0000-000000000001', 'REGULAR', 'Pessoal, ok.', true, '', true)$$, 'Diga o motivo', 'mudar o conceito sem motivo não passa quando o motivo é pedido');
select public.revisar_devolutiva('f5300000-0000-0000-0000-000000000001', 'REGULAR', 'Pessoal, ok.', true, '  Faltou a pesquisa  ', true);
reset role;
select pg_temp.confere((select status = 'aprovada' and motivo_mudanca = 'Faltou a pesquisa' from public.analises where entrega_id = 'f5300000-0000-0000-0000-000000000001'), 'com motivo, a mudança passa e o motivo fica guardado');
select pg_temp.analisar();
select public.revisar_devolutiva('f5300000-0000-0000-0000-000000000001', 'BOM', 'Pessoal, ok.', true, '', true);
reset role;
select pg_temp.confere((select status = 'aprovada' from public.analises where entrega_id = 'f5300000-0000-0000-0000-000000000001'), 'concordar com a IA não pede motivo');
update public.organizacoes set ia_sem_sugestao = true where id = current_setting('t.org')::uuid;
select pg_temp.analisar();
select public.revisar_devolutiva('f5300000-0000-0000-0000-000000000001', 'REGULAR', 'Pessoal, ok.', true, '', true);
reset role;
select pg_temp.confere((select status = 'aprovada' from public.analises where entrega_id = 'f5300000-0000-0000-0000-000000000001'), 'sem sugestão, o motivo não é cobrado (o professor não viu o que a IA achou)');
update public.organizacoes set ia_sem_sugestao = false, ia_pedir_motivo = false where id = current_setting('t.org')::uuid;

-- 7) Quem muda essas escolhas: só quem administra. Avaliador, outra empresa e as funções internas, não.
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
update public.organizacoes set ia_exigir_conceito = false where id = current_setting('t.org')::uuid;
update public.turmas set ia_exigir_conceito = false where id = 'f5000000-0000-0000-0000-000000000001';
select pg_temp.como('30000000-0000-0000-0000-00000000000d', 'admin@zeta.test');
update public.organizacoes set ia_exigir_conceito = false where id = current_setting('t.org')::uuid;
reset role;
select pg_temp.confere((select ia_exigir_conceito from public.organizacoes where id = current_setting('t.org')::uuid) and (select ia_exigir_conceito is null from public.turmas where id = 'f5000000-0000-0000-0000-000000000001'), 'avaliador e outra empresa não mudam as escolhas');
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test');
update public.organizacoes set ia_nome_codigo = false where id = current_setting('t.org')::uuid;
reset role;
select pg_temp.confere((select not ia_nome_codigo from public.organizacoes where id = current_setting('t.org')::uuid), 'quem administra muda as escolhas da conta');
update public.organizacoes set ia_nome_codigo = true where id = current_setting('t.org')::uuid;
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select pg_temp.erro_contem($$select * from public.config_ia(current_setting('t.org')::uuid, null)$$, '42501', 'a função interna das escolhas não é chamada de fora');

-- 8) Baixar o registro de supervisão entra no registro de atividades.
select public.registrar_documento(current_setting('t.org')::uuid, 'baixou_supervisao', 'Baixou o registro de supervisão', null, '1.2.3.4', 'teste');
select pg_temp.erro_contem($$select public.registrar_documento(current_setting('t.org')::uuid, 'inventada', 'x', null, '', '')$$, 'Ação desconhecida', 'ação desconhecida continua recusada');
reset role;
select pg_temp.confere((select count(*) = 1 from public.atividades where acao = 'baixou_supervisao' and org_id = current_setting('t.org')::uuid), 'o download do registro fica no registro de atividades');

do $$ begin raise notice 'TODOS OS TESTES DAS ESCOLHAS DO PROFESSOR PASSARAM'; end $$;
