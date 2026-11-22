-- Testes das regras da Fase 4 (envio das devolutivas pelo Gmail).
-- Usa a empresa "Curso Epsilon" criada em 04_analises_test.sql.
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
select pg_temp.confere((select enviar_conceito from public.organizacoes where slug = 'curso-epsilon'), 'empresa nasce mandando o conceito junto');

-- Uma entrega que chegou por e-mail (para responder na mesma conversa).
insert into public.grupos (id, org_id, nome) values ('32000000-0000-0000-0000-000000000002', current_setting('t.org')::uuid, 'Verde');
insert into public.emails_recebidos (id, org_id, message_id, responde_a, de_email, assunto, enviado_em, status)
  values ('34000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, '<orig@aluno>', array['<antes@aluno>'],
          'lider@verde.test', '[ENTREGA] Encontro 1 - Verde', now(), 'entrega');
set role service_role;
select public.gravar_entrega_interna('33000000-0000-0000-0000-000000000002', current_setting('t.org')::uuid,
  '31000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000002', 'email',
  '34000000-0000-0000-0000-000000000001', 'Lider@Verde.test', '[ENTREGA] Encontro 1 - Verde', now(), 'segue', '{}', '[]', null);
reset role;
insert into public.integrantes (org_id, grupo_id, email) values
  (current_setting('t.org')::uuid, '32000000-0000-0000-0000-000000000002', 'lider@verde.test'),
  (current_setting('t.org')::uuid, '32000000-0000-0000-0000-000000000002', 'ana@verde.test'),
  (current_setting('t.org')::uuid, '32000000-0000-0000-0000-000000000001', 'bia@azul.test');

set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');

-- 1) Destinatários: quem mandou o e-mail + cópia para os integrantes; entrega à mão vai para os integrantes.
select pg_temp.confere((select para = array['lider@verde.test'] and copia = array['ana@verde.test']
  from public.destinatarios_da_entrega('33000000-0000-0000-0000-000000000002')), 'e-mail vai para quem enviou, com cópia para a equipe');
select pg_temp.confere((select para = array['bia@azul.test'] and copia = '{}'
  from public.destinatarios_da_entrega('33000000-0000-0000-0000-000000000001')), 'entrega à mão vai para os integrantes');

-- 2) Só envia devolutiva aprovada.
select pg_temp.erro_contem($$select public.reservar_envio('33000000-0000-0000-0000-000000000001')$$,
  'Aprove a devolutiva', 'não envia devolutiva sem aprovar');
select public.revisar_devolutiva('33000000-0000-0000-0000-000000000001', 'BOM', 'Pessoal, boa entrega!', true);

-- 3) Reserva, não deixa enviar duas vezes ao mesmo tempo, e registra o envio.
select pg_temp.confere((select (r ->> 'devolutiva') = 'Pessoal, boa entrega!' and (r ->> 'conceito') = 'BOM'
  and (r -> 'para') = '["bia@azul.test"]'::jsonb and (r ->> 'etapa') like '% 1 · Diagnóstico'
  and (r ->> 'empresa') = 'Curso Epsilon' and jsonb_typeof(r -> 'checklist') = 'array'
  and (r -> 'checklist' -> 0) = '{"item": "Matriz CSD", "status": "ENTREGUE"}'::jsonb
  from (select public.reservar_envio('33000000-0000-0000-0000-000000000001') r) x), 'reserva devolve o texto e os destinatários');
select pg_temp.erro_contem($$select public.reservar_envio('33000000-0000-0000-0000-000000000001')$$,
  'já está sendo enviada', 'não envia duas vezes ao mesmo tempo');
select public.concluir_envio('33000000-0000-0000-0000-000000000001', true, 'prof@gmail.test', array['bia@azul.test'], 'msg-1', '');
select pg_temp.confere((select envio_status = 'enviada' and enviada_por = auth.uid() and enviada_para = array['bia@azul.test'] and envio_id = 'msg-1'
  from public.analises where entrega_id = '33000000-0000-0000-0000-000000000001'), 'envio registrado');

-- 4) Falha num reenvio não apaga que já foi enviada antes.
select public.reservar_envio('33000000-0000-0000-0000-000000000001');
select public.concluir_envio('33000000-0000-0000-0000-000000000001', false, '', '{}', '', 'Gmail recusou');
select pg_temp.confere((select envio_status = 'enviada' and envio_erro = 'Gmail recusou' and envio_id = 'msg-1'
  from public.analises where entrega_id = '33000000-0000-0000-0000-000000000001'), 'falha no reenvio mantém o envio anterior');

-- 5) Ninguém de fora envia, e ninguém lê o token do Gmail (nem o próprio dono, pelo navegador).
select pg_temp.como('30000000-0000-0000-0000-00000000000d', 'admin@zeta.test');
select pg_temp.erro_contem($$select public.reservar_envio('33000000-0000-0000-0000-000000000001')$$,
  'não encontrada', 'outra empresa não envia devolutiva alheia');
select pg_temp.erro_contem($$select * from public.destinatarios_da_entrega('33000000-0000-0000-0000-000000000002')$$,
  'não encontrada', 'outra empresa não vê os destinatários');
reset role;
insert into public.contas_gmail (user_id, email, token_cifrado) values
  ('30000000-0000-0000-0000-00000000000c', 'prof@gmail.test', 'cifrado'),
  ('30000000-0000-0000-0000-00000000000d', 'zeta@gmail.test', 'cifrado2');
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select pg_temp.confere((select count(*) = 1 and min(email) = 'prof@gmail.test' from public.contas_gmail), 'cada um vê só o próprio Gmail');
select pg_temp.erro_contem($$select token_cifrado from public.contas_gmail$$, '42501', 'token do Gmail não é lido pelo navegador');
select pg_temp.erro_contem($$insert into public.contas_gmail (user_id, email, token_cifrado) values (auth.uid(), 'x@x', 'y')$$,
  '42501', 'ninguém grava conexão do Gmail direto pelo navegador');
reset role;

\echo 'TODOS OS TESTES DE ENVIOS PASSARAM'
