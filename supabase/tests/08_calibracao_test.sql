-- Testes da calibração (motivo da mudança de conceito). Usa a empresa de 04/05.
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

set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select public.reabrir_devolutiva('33000000-0000-0000-0000-000000000001');
-- conceito_ia é BOM (04). Mudar para REGULAR com motivo: guarda o motivo.
select public.revisar_devolutiva('33000000-0000-0000-0000-000000000001', 'REGULAR', 'Texto', false, '  Faltou a pesquisa com dados  ');
select pg_temp.confere((select motivo_mudanca = 'Faltou a pesquisa com dados' from public.analises where entrega_id = '33000000-0000-0000-0000-000000000001'),
  'motivo guardado quando o conceito muda');
-- Voltar ao conceito da IA apaga o motivo (não há o que explicar).
select public.revisar_devolutiva('33000000-0000-0000-0000-000000000001', 'BOM', 'Texto', false, 'qualquer coisa');
select pg_temp.confere((select motivo_mudanca = '' from public.analises where entrega_id = '33000000-0000-0000-0000-000000000001'),
  'sem mudança de conceito, sem motivo');
-- Chamada antiga (sem motivo) continua funcionando.
select public.revisar_devolutiva('33000000-0000-0000-0000-000000000001', 'BOM', 'Texto', true);
select pg_temp.confere((select status = 'aprovada' from public.analises where entrega_id = '33000000-0000-0000-0000-000000000001'),
  'revisão sem o motivo continua funcionando');
reset role;

\echo 'TODOS OS TESTES DE CALIBRACAO PASSARAM'
