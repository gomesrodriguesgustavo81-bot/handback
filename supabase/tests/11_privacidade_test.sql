-- Testes da privacidade dos clientes. Usa a empresa "Curso Epsilon" (04).
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
set role authenticated;

-- 1) O dono vê a lista e os números, mas não o conteúdo.
select pg_temp.como('30000000-0000-0000-0000-00000000000a', 'dono3@handback.test');
select pg_temp.confere((select pessoas >= 2 and entregas >= 1 and 'admin@epsilon.test' = any(administradores) and acesso_tipo is null
  from public.espacos_da_plataforma() where slug = 'curso-epsilon'), 'dono vê o espaço na lista, com os números de uso');
select pg_temp.confere((select count(*) = 0 from public.organizacoes where slug = 'curso-epsilon'), 'dono não abre o espaço sem acesso');
select pg_temp.confere((select count(*) = 0 from public.entregas where org_id = current_setting('t.org')::uuid), 'dono não vê as entregas');
select pg_temp.confere((select count(*) = 0 from public.analises where org_id = current_setting('t.org')::uuid), 'dono não vê as devolutivas');
select pg_temp.confere((select count(*) = 0 from public.membros where org_id = current_setting('t.org')::uuid), 'dono não vê as pessoas');
select pg_temp.confere(not public.pode_gerir_org(current_setting('t.org')::uuid), 'dono não administra o espaço sem acesso');
select public.mudar_situacao_espaco(current_setting('t.org')::uuid, true, 'teste', current_date + 14);
reset role;
select pg_temp.confere((select situacao = 'teste' and teste_ate = current_date + 14 from public.organizacoes where id = current_setting('t.org')::uuid),
  'dono muda a situação sem ver o conteúdo');
set role authenticated;

-- 2) Só o administrador do espaço libera o suporte.
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select pg_temp.erro_contem($$select public.liberar_suporte(current_setting('t.org')::uuid, 3)$$, 'Só quem administra', 'avaliador não libera o suporte');
select pg_temp.como('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test');
select pg_temp.erro_contem($$update public.organizacoes set situacao = 'ativo' where id = current_setting('t.org')::uuid$$, 'Só o dono', 'o administrador do espaço não muda a própria situação');
select pg_temp.erro_contem($$select public.liberar_suporte(current_setting('t.org')::uuid, 30)$$, '1, 3 ou 7', 'suporte só por 1, 3 ou 7 dias');
select public.liberar_suporte(current_setting('t.org')::uuid, 3);
select pg_temp.confere((select count(*) = 1 from public.acessos_suporte where org_id = current_setting('t.org')::uuid and encerrado_em is null),
  'o espaço vê o acesso liberado');

-- 3) Com o suporte liberado, o dono entra; tudo o que fizer fica no registro.
select pg_temp.como('30000000-0000-0000-0000-00000000000a', 'dono3@handback.test');
select pg_temp.confere((select count(*) = 1 from public.organizacoes where slug = 'curso-epsilon'), 'com suporte, dono abre o espaço');
select pg_temp.confere((select count(*) >= 1 from public.entregas where org_id = current_setting('t.org')::uuid), 'com suporte, dono vê as entregas');
select pg_temp.confere((select acesso_tipo = 'suporte' and acesso_ate > now() + interval '2 days' from public.espacos_da_plataforma() where slug = 'curso-epsilon'),
  'a lista mostra até quando o suporte vale');

-- 4) O administrador corta: o dono perde o acesso na hora.
select pg_temp.como('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test');
select public.cortar_suporte(current_setting('t.org')::uuid);
select pg_temp.como('30000000-0000-0000-0000-00000000000a', 'dono3@handback.test');
select pg_temp.confere((select count(*) = 0 from public.entregas where org_id = current_setting('t.org')::uuid), 'depois de cortado, dono não vê mais');

-- 5) Emergência: só o dono, com motivo, por 4 horas, e fica no registro do espaço.
select pg_temp.erro_contem($$select public.acesso_de_emergencia(current_setting('t.org')::uuid, 'curto')$$, 'motivo', 'emergência exige motivo');
select public.acesso_de_emergencia(current_setting('t.org')::uuid, 'Cliente relatou arquivo corrompido e não responde');
select pg_temp.confere((select count(*) >= 1 from public.entregas where org_id = current_setting('t.org')::uuid), 'na emergência, dono entra');
select pg_temp.confere((select acesso_tipo = 'emergencia' and acesso_ate < now() + interval '4 hours 1 minute' from public.espacos_da_plataforma() where slug = 'curso-epsilon'),
  'emergência vale por 4 horas');
select public.sair_do_suporte(current_setting('t.org')::uuid);
select pg_temp.confere((select count(*) = 0 from public.entregas where org_id = current_setting('t.org')::uuid), 'dono sai da emergência antes do prazo');
select pg_temp.como('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test');
select pg_temp.erro_contem($$select public.acesso_de_emergencia(current_setting('t.org')::uuid, 'quero ver tudo de todos')$$, 'Só o dono', 'cliente não usa o acesso de emergência');
select pg_temp.confere((select string_agg(acao, ',' order by criado_em) from public.atividades
  where org_id = current_setting('t.org')::uuid and acao in ('liberou_suporte', 'cortou_suporte', 'acesso_emergencia')) = 'liberou_suporte,cortou_suporte,acesso_emergencia',
  'o espaço vê no registro: liberou, cortou e a emergência');
select pg_temp.confere(exists (select 1 from public.atividades where org_id = current_setting('t.org')::uuid and acao = 'acesso_emergencia' and descricao like '%arquivo corrompido%'),
  'o motivo da emergência aparece no registro');
select pg_temp.como('30000000-0000-0000-0000-00000000000a', 'dono3@handback.test');
select pg_temp.erro_contem($$select public.assumir_espaco_vazio(current_setting('t.org')::uuid)$$, 'já tem pessoas', 'dono não assume espaço com pessoas');
select public.criar_organizacao('Teste do dono', 'teste-do-dono', 'empresa', '');
select public.assumir_espaco_vazio((select id from public.espacos_da_plataforma() where slug = 'teste-do-dono'));
select pg_temp.confere((select count(*) = 1 from public.organizacoes where slug = 'teste-do-dono'), 'dono assume o próprio espaço vazio e passa a ver');
reset role;

\echo
\echo 'TODOS OS TESTES DE PRIVACIDADE PASSARAM'
