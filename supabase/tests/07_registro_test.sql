-- Testes do registro de atividades. Usa a empresa "Curso Epsilon" (04).
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

-- 1) O que já aconteceu nos testes anteriores ficou registrado sozinho.
select pg_temp.confere((select count(*) from public.atividades where org_id = current_setting('t.org')::uuid and acao = 'aprovou') >= 1, 'aprovação registrada');
select pg_temp.confere((select count(*) from public.atividades where org_id = current_setting('t.org')::uuid and acao = 'enviou'
  and descricao like '%bia@azul.test%') >= 1, 'envio registrado com os destinatários');
select pg_temp.confere((select count(*) from public.atividades where org_id = current_setting('t.org')::uuid and acao = 'convidou'
  and descricao like 'Convidou prof@epsilon.test como Avaliador') = 1, 'convite registrado');
select pg_temp.confere((select count(*) from public.atividades where org_id = current_setting('t.org')::uuid and acao = 'mudou_duas_etapas') >= 1,
  'mudança da exigência das duas etapas registrada');
select pg_temp.confere((select user_id = '30000000-0000-0000-0000-00000000000c' from public.atividades
  where org_id = current_setting('t.org')::uuid and acao = 'aprovou' order by id limit 1), 'registro guarda quem fez');

set role authenticated;
-- 2) Professor registra o próprio acesso e abre um documento.
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select public.registrar_acesso('entrou_senha', '200.1.2.3', 'Chrome no Android');
select public.registrar_documento(current_setting('t.org')::uuid, 'baixou_arquivo', 'Baixou relatorio.pdf', null, '200.1.2.3', 'Chrome no Android');
select pg_temp.erro_contem($$select public.registrar_acesso('apagou_tudo', '', '')$$, 'desconhecida', 'não aceita ação inventada');
-- Ele não vê o registro da empresa (só o administrador vê), mas vê os próprios acessos.
select pg_temp.confere((select count(*) from public.atividades where org_id is not null) = 0, 'avaliador não vê o registro da empresa');
select pg_temp.confere((select count(*) from public.atividades where acao = 'entrou_senha') = 1, 'cada um vê os próprios acessos');
-- Ninguém grava, altera ou apaga direto.
select pg_temp.erro_contem($$insert into public.atividades (tipo, acao) values ('acesso', 'falso')$$, '42501', 'ninguém grava direto no registro');

-- 3) Administrador vê tudo da empresa, mas não consegue apagar nem alterar.
select pg_temp.como('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test');
select pg_temp.confere((select count(*) from public.atividades where org_id = current_setting('t.org')::uuid and acao = 'baixou_arquivo'
  and ip = '200.1.2.3') = 1, 'administrador vê quem baixou o arquivo, com IP');
select pg_temp.confere((select count(*) from public.atividades where org_id = current_setting('t.org')::uuid and acao = 'entrou_senha') = 1,
  'administrador vê os acessos das pessoas da empresa');
select pg_temp.erro_contem($$delete from public.atividades$$, '42501', 'administrador não apaga o registro');
select pg_temp.erro_contem($$update public.atividades set descricao = 'x'$$, '42501', 'administrador não altera o registro');

-- 4) Outra empresa não vê nada.
select pg_temp.como('30000000-0000-0000-0000-00000000000d', 'admin@zeta.test');
select pg_temp.confere((select count(*) from public.atividades where org_id = current_setting('t.org')::uuid) = 0, 'outra empresa não vê o registro');
select pg_temp.erro_contem($$select public.registrar_documento('$$ || current_setting('t.org') || $$', 'abriu_entrega', 'x', null, '', '')$$,
  'não encontrada', 'outra empresa não grava no registro alheio');
select pg_temp.erro_contem($$select public.registrar_falha_login('prof@epsilon.test', '', '')$$, '42501', 'só o servidor registra senha errada');
reset role;

-- 5) Senha errada aparece para a empresa da pessoa.
set role service_role;
select public.registrar_falha_login('PROF@epsilon.test', '9.9.9.9', 'Firefox');
reset role;
select pg_temp.confere((select count(*) from public.atividades where org_id = current_setting('t.org')::uuid and acao = 'senha_errada' and ip = '9.9.9.9') = 1,
  'tentativa com senha errada aparece para a empresa da pessoa');

\echo 'TODOS OS TESTES DE REGISTRO PASSARAM'
