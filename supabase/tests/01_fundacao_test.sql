-- Testes das regras de acesso da Fase 0.
-- Cada bloco "entra" como uma pessoa e confere o que ela pode ver e fazer.
\set ON_ERROR_STOP on
\pset tuples_only on

create function pg_temp.como(uid uuid, email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, false);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'aal', 'aal2')::text, false);
end $$;

create function pg_temp.confere(ok boolean, o_que text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FALHOU: %', o_que; end if;
  raise notice 'ok: %', o_que;
end $$;

-- Pessoas de mentira
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'dono@handback.test'),
  ('00000000-0000-0000-0000-00000000000b', 'ana@escola.test'),
  ('00000000-0000-0000-0000-00000000000c', 'bia@contabil.test'),
  ('00000000-0000-0000-0000-00000000000d', 'curioso@qualquer.test');
insert into public.administradores_plataforma (user_id) values ('00000000-0000-0000-0000-00000000000a');

set role authenticated;

-- 1) O dono da plataforma cria duas empresas e convida um admin para cada.
select pg_temp.como('00000000-0000-0000-0000-00000000000a', 'dono@handback.test');
select public.criar_organizacao('Escola Alfa', 'escola-alfa', 'educacao', 'Ana@Escola.test');
select public.criar_organizacao('Contábil Beta', 'contabil-beta', 'escritorio', 'bia@contabil.test');
select pg_temp.confere((select count(*) from public.espacos_da_plataforma()) = 2, 'dono vê os 2 espaços na lista');
select pg_temp.confere((select count(*) from public.organizacoes) = 0, 'dono não vê o conteúdo dos espaços sem acesso');
reset role;
select pg_temp.confere(
  (select vocabulario ->> 'etapa' from public.organizacoes where slug = 'contabil-beta') = 'Competência',
  'escritório recebe o vocabulário padrão');
select set_config('teste.alfa', (select id::text from public.organizacoes where slug = 'escola-alfa'), false);
select set_config('teste.beta', (select id::text from public.organizacoes where slug = 'contabil-beta'), false);
set role authenticated;

-- 2) Ana entra, aceita o convite (o e-mail foi digitado com maiúsculas) e só vê a escola dela.
select pg_temp.como('00000000-0000-0000-0000-00000000000b', 'ana@escola.test');
select pg_temp.confere((select count(*) from public.organizacoes) = 0, 'antes do convite, Ana não vê nada');
select pg_temp.confere(public.aceitar_convites() = 1, 'Ana aceita 1 convite');
select pg_temp.confere(public.aceitar_convites() = 0, 'convite não é aceito duas vezes');
select pg_temp.confere((select count(*) from public.organizacoes) = 1, 'Ana vê só 1 empresa');
select pg_temp.confere((select slug from public.organizacoes) = 'escola-alfa', 'e é a Escola Alfa');
select pg_temp.confere((select count(*) from public.convites) = 1, 'Ana (admin) vê os convites da escola');

-- 3) Ana, como admin, convida um professor e renomeia a escola, mas não pode se desativar.
insert into public.convites (org_id, email, papel, criado_por)
  select id, 'prof@escola.test', 'avaliador', auth.uid() from public.organizacoes;
update public.organizacoes set nome = 'Escola Alfa Nova';
select pg_temp.confere((select nome from public.organizacoes) = 'Escola Alfa Nova', 'Ana renomeia a escola');
do $$ begin
  update public.organizacoes set ativa = false;
  raise exception 'FALHOU: Ana conseguiu desativar a empresa';
exception when raise_exception then
  if sqlerrm like 'FALHOU%' then raise; end if;
  raise notice 'ok: Ana não consegue desativar a empresa';
end $$;

-- 4) Ana não consegue criar empresa nem mexer na empresa dos outros.
do $$ begin
  perform public.criar_organizacao('Intrusa', 'intrusa', 'empresa', '');
  raise exception 'FALHOU: Ana criou empresa';
exception when raise_exception then
  if sqlerrm like 'FALHOU%' then raise; end if;
  raise notice 'ok: Ana não cria empresas';
end $$;
do $$ begin
  insert into public.convites (org_id, email, papel, criado_por)
    values (current_setting('teste.beta')::uuid, 'x@x.test', 'admin', auth.uid());
  raise exception 'FALHOU: Ana convidou alguém para o escritório';
exception when insufficient_privilege then
  raise notice 'ok: Ana não convida ninguém para outra empresa';
end $$;

-- 5) Bia (escritório) não vê nada da escola.
select pg_temp.como('00000000-0000-0000-0000-00000000000c', 'bia@contabil.test');
select pg_temp.confere(public.aceitar_convites() = 1, 'Bia aceita o convite do escritório');
select pg_temp.confere((select count(*) from public.organizacoes) = 1, 'Bia vê só 1 empresa');
select pg_temp.confere((select slug from public.organizacoes) = 'contabil-beta', 'e é o escritório dela');
select pg_temp.confere((select count(*) from public.convites where email like '%escola%') = 0, 'Bia não vê convites da escola');
select pg_temp.confere((select count(*) from public.membros) = 1, 'Bia só vê membros do escritório');
do $$
declare n integer;
begin
  update public.organizacoes set nome = 'Hackeada' where slug = 'escola-alfa';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: Bia alterou a escola'; end if;
  raise notice 'ok: Bia não altera a escola';
end $$;
do $$ begin
  insert into public.membros (org_id, user_id, papel)
    values (current_setting('teste.alfa')::uuid, auth.uid(), 'admin');
  raise exception 'FALHOU: Bia se colocou na escola';
exception when insufficient_privilege then
  raise notice 'ok: Bia não se coloca na escola';
end $$;

-- 6) Um curioso sem convite não vê nada e não consegue se colocar numa empresa.
select pg_temp.como('00000000-0000-0000-0000-00000000000d', 'curioso@qualquer.test');
select pg_temp.confere(public.aceitar_convites() = 0, 'curioso não tem convites');
select pg_temp.confere((select count(*) from public.organizacoes) = 0, 'curioso não vê empresas');
select pg_temp.confere((select count(*) from public.membros) = 0, 'curioso não vê membros');
do $$ begin
  insert into public.membros (org_id, user_id, papel)
    values (current_setting('teste.alfa')::uuid, auth.uid(), 'admin');
  raise exception 'FALHOU: curioso entrou na escola';
exception when insufficient_privilege then
  raise notice 'ok: curioso não entra na escola sozinho';
end $$;
reset role;

-- 7) Visitante sem login não chama as ações.
set role anon;
do $$ begin
  perform public.aceitar_convites();
  raise exception 'FALHOU: anônimo chamou aceitar_convites';
exception when insufficient_privilege then
  raise notice 'ok: anônimo não chama ações';
end $$;
reset role;

\echo 'TODOS OS TESTES PASSARAM'
