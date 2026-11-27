-- Testes do registro de gasto da IA. Usa a empresa "Curso Epsilon" (04) e a turma do piloto (18).
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

select set_config('t.org', (select id::text from public.organizacoes where slug = 'curso-epsilon'), false);

insert into public.grupos (id, org_id, turma_id, nome) values
  ('e5000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'd1000000-0000-0000-0000-000000000001', 'Duda');
insert into public.entregas (id, org_id, etapa_id, grupo_id, origem, enviada_em) values
  ('e6000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'd2000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000001', 'manual', now());
insert into public.analises (entrega_id, org_id, status) values ('e6000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 'analisando');

-- 1) A análise grava os tokens num livro-caixa.
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select public.gravar_analise('e6000000-0000-0000-0000-000000000001', jsonb_build_object(
  'modelo', 'gemini-teste', 'segundos', 3, 'conceito', 'BOM', 'devolutiva', 'Pessoal, ótimo.', 'tokens_entrada', 1200, 'tokens_saida', 350));
reset role;
select pg_temp.confere((select count(*) = 1 and sum(tokens_entrada) = 1200 and sum(tokens_saida) = 350 and min(modelo) = 'gemini-teste'
  from public.uso_ia where entrega_id = 'e6000000-0000-0000-0000-000000000001'), 'a análise registra os tokens de entrada e de saída');

-- 2) Reanálise soma: o gasto da primeira continua lá.
update public.analises set status = 'analisando' where entrega_id = 'e6000000-0000-0000-0000-000000000001';
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select public.gravar_analise('e6000000-0000-0000-0000-000000000001', jsonb_build_object('modelo', 'gemini-teste', 'segundos', 2, 'conceito', 'BOM', 'devolutiva', 'Pessoal, ok.', 'tokens_entrada', 1000, 'tokens_saida', 300));
reset role;
select pg_temp.confere((select count(*) = 2 and sum(tokens_entrada) = 2200 and sum(tokens_saida) = 650 from public.uso_ia where entrega_id = 'e6000000-0000-0000-0000-000000000001'), 'a reanálise soma ao gasto, não apaga o anterior');

-- 3) Sem número, com texto, negativo ou absurdo: vira 0 e a análise segue valendo.
update public.analises set status = 'analisando' where entrega_id = 'e6000000-0000-0000-0000-000000000001';
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select public.gravar_analise('e6000000-0000-0000-0000-000000000001', jsonb_build_object('modelo', 'x', 'segundos', 1, 'conceito', 'BOM', 'devolutiva', 'ok', 'tokens_entrada', 'muitos', 'tokens_saida', -5));
reset role;
select pg_temp.confere((select count(*) = 3 and (select tokens_entrada = 0 and tokens_saida = 0 from public.uso_ia order by id desc limit 1) from public.uso_ia where entrega_id = 'e6000000-0000-0000-0000-000000000001'), 'valor que não é número ou é negativo vira zero');
update public.analises set status = 'analisando' where entrega_id = 'e6000000-0000-0000-0000-000000000001';
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select public.gravar_analise('e6000000-0000-0000-0000-000000000001', jsonb_build_object('modelo', 'x', 'segundos', 1, 'conceito', 'BOM', 'devolutiva', 'ok'));
reset role;
select pg_temp.confere((select count(*) = 4 from public.uso_ia where entrega_id = 'e6000000-0000-0000-0000-000000000001'), 'resposta sem tokens também grava a análise');

-- 4) Quem lê o gasto: quem administra; avaliador comum e outra empresa, não; ninguém grava direto.
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test');
select pg_temp.confere((select count(*) >= 4 from public.uso_ia), 'quem administra vê o gasto da IA da empresa');
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select pg_temp.confere((select count(*) = 0 from public.uso_ia), 'avaliador comum não vê o gasto');
select pg_temp.como('30000000-0000-0000-0000-00000000000d', 'admin@zeta.test');
select pg_temp.confere((select count(*) = 0 from public.uso_ia), 'outra empresa não vê o gasto');
select pg_temp.como('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test');
do $$ begin
  begin
    insert into public.uso_ia (org_id, tokens_entrada) values (current_setting('t.org')::uuid, 1);
    raise exception 'FALHOU: ninguém grava direto (não deu erro)';
  exception when insufficient_privilege then raise notice 'ok: ninguém grava o gasto direto na tabela';
  end;
end $$;
reset role;

do $$ begin raise notice 'TODOS OS TESTES DO GASTO DA IA PASSARAM'; end $$;
