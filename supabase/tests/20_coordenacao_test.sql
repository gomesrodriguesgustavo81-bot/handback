-- Testes do coordenador e da banca. Usa a empresa "Curso Epsilon" (04); o admin de outra empresa é o "Zeta".
\set ON_ERROR_STOP on
\pset tuples_only on

create or replace function pg_temp.como(uid uuid, email text, aal text default 'aal2') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, false);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'aal', aal)::text, false);
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
select set_config('t.zeta', (select id::text from public.organizacoes where slug = 'zeta'), false);

insert into auth.users (id, email) values
  ('30000000-0000-0000-0000-0000000000c1', 'coord@epsilon.test'),
  ('30000000-0000-0000-0000-0000000000c2', 'banca@epsilon.test'),
  ('30000000-0000-0000-0000-0000000000c3', 'semescopo@epsilon.test');

-- Duas turmas com entregas, uma delas com devolutiva aprovada cheia de "segredo".
insert into public.turmas (id, org_id, nome, modo) values
  ('f1000000-0000-0000-0000-00000000000a', current_setting('t.org')::uuid, 'Coord A', 'grupos'),
  ('f1000000-0000-0000-0000-00000000000b', current_setting('t.org')::uuid, 'Coord B', 'grupos');
insert into public.turmas (id, org_id, nome, modo) values ('f1000000-0000-0000-0000-0000000000ff', current_setting('t.zeta')::uuid, 'Turma da outra empresa', 'grupos');
insert into public.etapas (id, org_id, turma_id, numero, titulo, recebe_ate) values
  ('f2000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'f1000000-0000-0000-0000-00000000000a', 1, 'Diagnóstico', '2026-03-12'),
  ('f2000000-0000-0000-0000-000000000002', current_setting('t.org')::uuid, 'f1000000-0000-0000-0000-00000000000a', 2, 'Pesquisa', '2026-04-02'),
  ('f2000000-0000-0000-0000-000000000003', current_setting('t.org')::uuid, 'f1000000-0000-0000-0000-00000000000b', 1, 'Única', '2026-03-12');
insert into public.grupos (id, org_id, turma_id, nome) values
  ('f3000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'f1000000-0000-0000-0000-00000000000a', 'Equipe Azul'),
  ('f3000000-0000-0000-0000-000000000002', current_setting('t.org')::uuid, 'f1000000-0000-0000-0000-00000000000a', 'Equipe Roxa'),
  ('f3000000-0000-0000-0000-000000000003', current_setting('t.org')::uuid, 'f1000000-0000-0000-0000-00000000000b', 'Equipe Verde');
insert into public.entregas (id, org_id, etapa_id, grupo_id, origem, enviada_em, atrasada) values
  ('f4000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'f2000000-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000001', 'manual', now(), true),
  ('f4000000-0000-0000-0000-000000000002', current_setting('t.org')::uuid, 'f2000000-0000-0000-0000-000000000002', 'f3000000-0000-0000-0000-000000000001', 'manual', now(), false),
  ('f4000000-0000-0000-0000-000000000003', current_setting('t.org')::uuid, 'f2000000-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000002', 'manual', now(), false),
  ('f4000000-0000-0000-0000-000000000004', current_setting('t.org')::uuid, 'f2000000-0000-0000-0000-000000000003', 'f3000000-0000-0000-0000-000000000003', 'manual', now(), false);
insert into public.analises (entrega_id, org_id, status, conceito, devolutiva, analise_interna) values
  ('f4000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'aprovada', 'BOM', 'SEGREDO da devolutiva', 'SEGREDO interno da IA'),
  ('f4000000-0000-0000-0000-000000000002', current_setting('t.org')::uuid, 'pronta', 'EXCELENTE', 'rascunho ainda não aprovado', ''),
  ('f4000000-0000-0000-0000-000000000003', current_setting('t.org')::uuid, 'aprovada', 'REGULAR', 'SEGREDO 2', ''),
  ('f4000000-0000-0000-0000-000000000004', current_setting('t.org')::uuid, 'aprovada', 'RUIM', 'SEGREDO 3', '');
insert into storage.objects (bucket_id, name) values ('entregas', current_setting('t.org') || '/f4000000/arquivo-secreto.pdf');

-- 1) Convites de coordenação: o banco confere se o escopo faz sentido.
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test');
select pg_temp.erro_contem($$insert into public.convites (org_id, email, papel, criado_por, coord_tipo) values (current_setting('t.org')::uuid, 'x1@epsilon.test', 'coordenador', auth.uid(), 'banca')$$, '23514', 'banca sem nenhuma turma é recusada');
select pg_temp.erro_contem($$insert into public.convites (org_id, email, papel, criado_por, coord_tipo, coord_turmas) values (current_setting('t.org')::uuid, 'x2@epsilon.test', 'coordenador', auth.uid(), 'coordenador', array['f1000000-0000-0000-0000-00000000000a']::uuid[])$$, '23514', 'coordenador de todas as turmas não leva lista de turmas');
select pg_temp.erro_contem($$insert into public.convites (org_id, email, papel, criado_por) values (current_setting('t.org')::uuid, 'x3@epsilon.test', 'coordenador', auth.uid())$$, '23514', 'convite de coordenador sem o tipo é recusado');
select pg_temp.erro_contem($$insert into public.convites (org_id, email, papel, criado_por, coord_nomes) values (current_setting('t.org')::uuid, 'x4@epsilon.test', 'avaliador', auth.uid(), true)$$, '23514', 'só convite de coordenador pode pedir nomes');
select pg_temp.erro_contem($$insert into public.convites (org_id, email, papel, criado_por, coord_tipo, coord_turmas) values (current_setting('t.org')::uuid, 'x5@epsilon.test', 'coordenador', auth.uid(), 'banca', array['f1000000-0000-0000-0000-0000000000ff']::uuid[])$$, 'só turmas desta empresa', 'banca com turma de outra empresa é recusada');
insert into public.convites (org_id, email, papel, criado_por, coord_tipo) values (current_setting('t.org')::uuid, 'coord@epsilon.test', 'coordenador', auth.uid(), 'coordenador');
insert into public.convites (org_id, email, papel, criado_por, coord_tipo, coord_nomes, coord_turmas) values
  (current_setting('t.org')::uuid, 'banca@epsilon.test', 'coordenador', auth.uid(), 'banca', true, array['f1000000-0000-0000-0000-00000000000a']::uuid[]);
insert into public.convites (org_id, email, papel, criado_por, coord_tipo) values (current_setting('t.org')::uuid, 'semescopo@epsilon.test', 'coordenador', auth.uid(), 'coordenador');
reset role;

-- 2) Cada pessoa aceita o seu convite; o escopo é gravado.
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-0000000000c1', 'coord@epsilon.test');
select public.aceitar_convites();
select pg_temp.como('30000000-0000-0000-0000-0000000000c2', 'banca@epsilon.test');
select public.aceitar_convites();
reset role;
select pg_temp.confere((select papel = 'coordenador' from public.membros where user_id = '30000000-0000-0000-0000-0000000000c1' and org_id = current_setting('t.org')::uuid), 'quem aceita vira coordenador');
select pg_temp.confere((select tipo = 'coordenador' and not mostrar_nomes from public.coordenacao where user_id = '30000000-0000-0000-0000-0000000000c1'), 'coordenador começa sem ver nomes');
select pg_temp.confere((select tipo = 'banca' and mostrar_nomes from public.coordenacao where user_id = '30000000-0000-0000-0000-0000000000c2')
  and (select count(*) = 1 from public.coordenacao_turmas where user_id = '30000000-0000-0000-0000-0000000000c2'), 'banca guarda as turmas escolhidas e a escolha dos nomes');
-- Uma terceira pessoa vira coordenadora SEM escopo (por exemplo, papel trocado à mão): não pode ver nada.
update public.convites set aceito_em = now() where email = 'semescopo@epsilon.test';
insert into public.membros (org_id, user_id, papel) values (current_setting('t.org')::uuid, '30000000-0000-0000-0000-0000000000c3', 'coordenador');

-- 3) O coordenador não lê NADA da correção, direto nas tabelas.
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-0000000000c1', 'coord@epsilon.test');
select pg_temp.confere((select count(*) = 0 from public.entregas), 'coordenador não lê entregas');
select pg_temp.confere((select count(*) = 0 from public.analises), 'coordenador não lê análises, devolutivas nem alertas');
select pg_temp.confere((select count(*) = 0 from public.grupos), 'coordenador não lê alunos nem equipes direto');
select pg_temp.confere((select count(*) = 0 from public.integrantes), 'coordenador não lê e-mails dos alunos');
select pg_temp.confere((select count(*) = 0 from public.turmas), 'coordenador não lê as turmas direto (têm o endereço de recebimento)');
select pg_temp.confere((select count(*) = 0 from public.etapas), 'coordenador não lê as etapas direto');
select pg_temp.confere((select count(*) = 0 from public.arquivos_entrega), 'coordenador não lê a lista de arquivos');
select pg_temp.confere((select count(*) = 0 from storage.objects where bucket_id = 'entregas'), 'coordenador não lê os arquivos dos alunos');
select pg_temp.confere((select count(*) = 0 from public.convites), 'coordenador não vê convites');
select pg_temp.confere((select count(*) = 0 from public.atividades), 'coordenador não lê o registro de atividades');
select pg_temp.confere((select count(*) = 1 from public.coordenacao), 'coordenador só vê o próprio escopo');
select pg_temp.confere((select count(*) = 0 from public.organizacoes where id <> current_setting('t.org')::uuid), 'coordenador não vê outras empresas');
select pg_temp.confere((select count(*) = 0 from public.pessoas_da_org(current_setting('t.org')::uuid)), 'coordenador não vê a lista de pessoas com e-mail');
reset role;

-- 4) Ele também não escreve nada.
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-0000000000c1', 'coord@epsilon.test');
update public.analises set conceito = 'EXCELENTE';
update public.membros set papel = 'admin' where user_id = auth.uid();
update public.etapas set titulo = 'mexeu';
delete from public.turmas;
reset role;
select pg_temp.confere((select count(*) = 0 from public.analises where conceito = 'EXCELENTE' and status = 'aprovada'), 'coordenador não muda conceito');
select pg_temp.confere((select papel = 'coordenador' from public.membros where user_id = '30000000-0000-0000-0000-0000000000c1' and org_id = current_setting('t.org')::uuid), 'coordenador não vira administrador sozinho');
select pg_temp.confere((select count(*) = 0 from public.etapas where titulo = 'mexeu') and (select count(*) = 2 from public.turmas where org_id = current_setting('t.org')::uuid and nome in ('Coord A', 'Coord B')), 'coordenador não altera nem apaga cadastros');
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-0000000000c1', 'coord@epsilon.test');
select pg_temp.erro_contem($$insert into public.convites (org_id, email, papel, criado_por) values (current_setting('t.org')::uuid, 'amigo@x.test', 'admin', auth.uid())$$, 'row-level', 'coordenador não convida ninguém');
select pg_temp.erro_contem($$update public.coordenacao set mostrar_nomes = true$$, '42501', 'coordenador não liga os próprios nomes');
select pg_temp.erro_contem($$select public.gravar_analise('f4000000-0000-0000-0000-000000000001', '{}'::jsonb)$$, 'não encontrada', 'coordenador não grava análise');
reset role;

-- 5) O que ele vê: só números e conceito aprovado, sem nomes.
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-0000000000c1', 'coord@epsilon.test');
select pg_temp.confere((select count(*) = 5 from public.dados_coordenacao(current_setting('t.org')::uuid) where turma_nome in ('Coord A', 'Coord B')), 'coordenador vê as duas turmas');
select pg_temp.confere((select count(*) = 0 from public.dados_coordenacao(current_setting('t.org')::uuid) where grupo_nome is not null), 'sem a opção ligada, nenhum nome sai');
select pg_temp.confere((select count(*) = 3 from public.dados_coordenacao(current_setting('t.org')::uuid) where conceito is not null and turma_nome like 'Coord%'), 'só os conceitos já aprovados aparecem');
select pg_temp.confere((select conceito is null and entregou from public.dados_coordenacao(current_setting('t.org')::uuid) where etapa_titulo = 'Pesquisa' and grupo_n = (select grupo_n from public.dados_coordenacao(current_setting('t.org')::uuid) where etapa_titulo = 'Pesquisa' and entregou limit 1) limit 1),
  'conceito que ainda é rascunho da IA não aparece');
select pg_temp.confere((select count(*) = 1 from public.dados_coordenacao(current_setting('t.org')::uuid) where atrasada), 'a coordenação sabe quem entregou atrasado');
select pg_temp.confere(position('devolutiva' in pg_get_function_result('public.dados_coordenacao(uuid)'::regprocedure)) = 0
  and position('analise' in pg_get_function_result('public.dados_coordenacao(uuid)'::regprocedure)) = 0
  and position('email' in pg_get_function_result('public.dados_coordenacao(uuid)'::regprocedure)) = 0, 'a função não tem coluna de devolutiva, análise nem e-mail');
select pg_temp.confere(not exists (select 1 from public.dados_coordenacao(current_setting('t.org')::uuid) d where d::text ilike '%SEGREDO%' or d::text ilike '%arquivo-secreto%'), 'nada do texto da correção aparece');
reset role;

-- 6) Banca: só as turmas escolhidas, e com nomes porque o convite pediu.
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-0000000000c2', 'banca@epsilon.test');
select pg_temp.confere((select count(*) = 4 and count(distinct turma_nome) = 1 and min(turma_nome) = 'Coord A' from public.dados_coordenacao(current_setting('t.org')::uuid)), 'banca vê só a turma escolhida');
select pg_temp.confere((select count(*) = 4 from public.dados_coordenacao(current_setting('t.org')::uuid) where grupo_nome in ('Equipe Azul', 'Equipe Roxa')), 'banca vê os nomes quando o convite pediu');
select pg_temp.confere((select count(*) = 0 from public.grupos) and (select count(*) = 0 from public.entregas), 'banca também não lê a correção direto');
reset role;

-- 7) Sem escopo, ou sem as duas etapas, ou de outra empresa: nada.
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-0000000000c3', 'semescopo@epsilon.test');
select pg_temp.confere((select count(*) = 0 from public.dados_coordenacao(current_setting('t.org')::uuid)), 'coordenador sem escopo não vê nada (o padrão é fechado)');
select pg_temp.como('30000000-0000-0000-0000-0000000000c1', 'coord@epsilon.test', 'aal1');
select pg_temp.confere((select count(*) = 0 from public.dados_coordenacao(current_setting('t.org')::uuid)), 'sem as duas etapas (quando a empresa exige), nada aparece');
select pg_temp.como('30000000-0000-0000-0000-00000000000d', 'admin@zeta.test');
select pg_temp.confere((select count(*) = 0 from public.dados_coordenacao(current_setting('t.org')::uuid)), 'quem é de outra empresa não vê nada');
select pg_temp.confere((select count(*) = 0 from public.coordenacao), 'outra empresa não lê a coordenação');
reset role;

-- 8) Quem avalia continua vendo tudo, com nomes (o painel também serve de prévia).
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select pg_temp.confere((select count(*) >= 5 and count(*) filter (where grupo_nome is null) = 0 from public.dados_coordenacao(current_setting('t.org')::uuid) where turma_nome like 'Coord%'), 'quem avalia vê as turmas com nomes');
select pg_temp.confere((select count(*) >= 1 from public.entregas), 'quem avalia continua lendo as entregas');
reset role;

-- 9) Cada abertura fica no registro (no máximo uma a cada 10 minutos).
select pg_temp.confere((select count(*) = 1 from public.atividades where acao = 'abriu_coordenacao' and user_id = '30000000-0000-0000-0000-0000000000c1'), 'a abertura do painel pela coordenação fica no registro, sem repetir a cada tela');
select pg_temp.confere((select count(*) = 0 from public.atividades where acao = 'abriu_coordenacao' and user_id = '30000000-0000-0000-0000-00000000000c'), 'quem avalia não enche o registro');

-- 10) Quem deixa de ser coordenador perde o escopo.
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test');
select pg_temp.confere((select count(*) = 2 from public.coordenacao where org_id = current_setting('t.org')::uuid), 'quem administra vê o escopo dos coordenadores');
update public.membros set papel = 'participante' where user_id = '30000000-0000-0000-0000-0000000000c1' and org_id = current_setting('t.org')::uuid;
reset role;
select pg_temp.confere((select count(*) = 0 from public.coordenacao where user_id = '30000000-0000-0000-0000-0000000000c1'), 'trocar o papel apaga o escopo');
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-0000000000c1', 'coord@epsilon.test');
select pg_temp.confere((select count(*) = 0 from public.dados_coordenacao(current_setting('t.org')::uuid)), 'ex-coordenador não vê mais o painel');
reset role;

do $$ begin raise notice 'TODOS OS TESTES DA COORDENAÇÃO PASSARAM'; end $$;
