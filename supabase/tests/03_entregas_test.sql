-- Testes das regras de acesso da Fase 2 (entregas por e-mail e à mão).
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

-- E-mail recebido no formato que o servidor manda para receber_email_interno.
create or replace function pg_temp.email(id uuid, org uuid, msg text, status text, etapa uuid, grupo uuid,
  enviado timestamptz default now(), anexos jsonb default '[]') returns jsonb language sql as $$
  select jsonb_build_object('id', id, 'org_id', org, 'message_id', msg, 'de_email', 'aluna@delta.test',
    'assunto', '[ENTREGA] Aula 2 - Azul', 'texto', 'Segue', 'enviado_em', enviado, 'links', '[]'::jsonb,
    'anexos', anexos, 'status', status, 'motivo', 'teste', 'avisos', '[]'::jsonb,
    'etapa_sugerida', etapa, 'grupo_sugerido', grupo);
$$;

insert into auth.users (id, email) values
  ('20000000-0000-0000-0000-00000000000a', 'dono2@handback.test'),
  ('20000000-0000-0000-0000-00000000000b', 'admin@delta.test'),
  ('20000000-0000-0000-0000-00000000000c', 'prof@delta.test'),
  ('20000000-0000-0000-0000-00000000000d', 'aluna@delta.test'),
  ('20000000-0000-0000-0000-00000000000e', 'admin@outra2.test');
insert into public.administradores_plataforma (user_id) values ('20000000-0000-0000-0000-00000000000a');

set role authenticated;
select pg_temp.como('20000000-0000-0000-0000-00000000000a', 'dono2@handback.test');
select public.criar_organizacao('Curso Delta', 'curso-delta', 'educacao', 'admin@delta.test');
select public.criar_organizacao('Outra 2', 'outra-2', 'empresa', 'admin@outra2.test');
select pg_temp.como('20000000-0000-0000-0000-00000000000b', 'admin@delta.test');
select public.aceitar_convites();
insert into public.convites (org_id, email, papel, criado_por)
  select id, 'prof@delta.test', 'avaliador', auth.uid() from public.organizacoes where slug = 'curso-delta';
select pg_temp.como('20000000-0000-0000-0000-00000000000c', 'prof@delta.test');
select public.aceitar_convites();
select pg_temp.como('20000000-0000-0000-0000-00000000000e', 'admin@outra2.test');
select public.aceitar_convites();
reset role;
select set_config('t.org', (select id::text from public.organizacoes where slug = 'curso-delta'), false);
insert into public.etapas (id, org_id, numero, titulo, recebe_ate) values
  ('21000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid, 1, 'Passada', current_date - 3),
  ('21000000-0000-0000-0000-000000000002', current_setting('t.org')::uuid, 2, 'Futura', current_date + 30);
insert into public.grupos (id, org_id, nome) values
  ('22000000-0000-0000-0000-00000000000a', current_setting('t.org')::uuid, 'Azul'),
  ('22000000-0000-0000-0000-00000000000b', current_setting('t.org')::uuid, 'Verde');
insert into public.integrantes (org_id, grupo_id, email) values
  (current_setting('t.org')::uuid, '22000000-0000-0000-0000-00000000000a', 'aluna@delta.test');
select pg_temp.confere((select caixa_token ~ '^[a-z0-9]{12}$' from public.organizacoes where slug = 'curso-delta'),
  'empresa ganha um código de caixa de entrada');

-- 1) O servidor (chave secreta) recebe um e-mail que a triagem reconheceu como entrega.
set role service_role;
insert into storage.objects (bucket_id, name) values
  ('entregas', current_setting('t.org') || '/emails/24000000-0000-0000-0000-000000000001/1-relatorio.pdf');
select public.receber_email_interno(pg_temp.email('24000000-0000-0000-0000-000000000001', current_setting('t.org')::uuid,
  '<m1@mail>', 'entrega', '21000000-0000-0000-0000-000000000002', '22000000-0000-0000-0000-00000000000a', now(),
  jsonb_build_array(jsonb_build_object('caminho', current_setting('t.org') || '/emails/24000000-0000-0000-0000-000000000001/1-relatorio.pdf',
    'nome', 'relatório.pdf', 'tamanho', 100, 'tipo', 'application/pdf'))),
  '25000000-0000-0000-0000-000000000001');
select pg_temp.confere((select count(*) from public.entregas) = 1, 'e-mail reconhecido vira entrega');
select pg_temp.confere((select count(*) from public.arquivos_entrega) = 1, 'anexo ligado à entrega');
select pg_temp.confere(
  (select public.receber_email_interno(pg_temp.email('24000000-0000-0000-0000-000000000009', current_setting('t.org')::uuid,
    '<m1@mail>', 'entrega', '21000000-0000-0000-0000-000000000002', '22000000-0000-0000-0000-00000000000a'),
    '25000000-0000-0000-0000-000000000009')) is null,
  'o mesmo e-mail chegando de novo não duplica');

-- 2) Reenvio mais novo substitui; um e-mail mais ANTIGO que chega depois não passa na frente.
select public.receber_email_interno(pg_temp.email('24000000-0000-0000-0000-000000000002', current_setting('t.org')::uuid,
  '<m2@mail>', 'entrega', '21000000-0000-0000-0000-000000000002', '22000000-0000-0000-0000-00000000000a', now() + interval '1 minute'),
  '25000000-0000-0000-0000-000000000002');
select public.receber_email_interno(pg_temp.email('24000000-0000-0000-0000-000000000003', current_setting('t.org')::uuid,
  '<m3@mail>', 'entrega', '21000000-0000-0000-0000-000000000002', '22000000-0000-0000-0000-00000000000a', now() - interval '1 day'),
  '25000000-0000-0000-0000-000000000003');
select pg_temp.confere(
  (select id from public.entregas where status = 'recebida') = '25000000-0000-0000-0000-000000000002',
  'vale a entrega enviada por último (mesmo que um e-mail antigo chegue depois)');

-- 3) Atraso pela data de envio.
select public.receber_email_interno(pg_temp.email('24000000-0000-0000-0000-000000000004', current_setting('t.org')::uuid,
  '<m4@mail>', 'entrega', '21000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-00000000000a'),
  '25000000-0000-0000-0000-000000000004');
select pg_temp.confere((select atrasada from public.entregas where id = '25000000-0000-0000-0000-000000000004'),
  'entrega depois do prazo fica com atraso');

-- 4) E-mail fora do padrão fica "para confirmar".
select public.receber_email_interno(pg_temp.email('24000000-0000-0000-0000-000000000005', current_setting('t.org')::uuid,
  '<m5@mail>', 'confirmar', null, null), null);
select public.receber_email_interno(pg_temp.email('24000000-0000-0000-0000-000000000006', current_setting('t.org')::uuid,
  '<m6@mail>', 'confirmar', null, null), null);
reset role;

-- 5) O professor (avaliador) vê tudo, importa um e ignora outro.
set role authenticated;
select pg_temp.como('20000000-0000-0000-0000-00000000000c', 'prof@delta.test');
select pg_temp.confere((select count(*) from public.emails_recebidos) = 6, 'professor vê os 6 e-mails recebidos');
select pg_temp.confere((select count(*) from storage.objects) = 1, 'professor abre os anexos');
select pg_temp.confere(
  (select grupo_id from public.importar_email('24000000-0000-0000-0000-000000000005',
     '21000000-0000-0000-0000-000000000002', '22000000-0000-0000-0000-00000000000b')) = '22000000-0000-0000-0000-00000000000b',
  'professor confirma um e-mail como entrega da equipe Verde');
select public.ignorar_email('24000000-0000-0000-0000-000000000006');
select pg_temp.confere(
  (select string_agg(status::text, ',' order by message_id) from public.emails_recebidos where message_id in ('<m5@mail>', '<m6@mail>')) = 'importado,ignorado',
  'e-mails ficam como importado e ignorado');
do $$ begin
  perform public.importar_email('24000000-0000-0000-0000-000000000005', '21000000-0000-0000-0000-000000000002', '22000000-0000-0000-0000-00000000000b');
  raise exception 'FALHOU: importou duas vezes';
exception when raise_exception then
  if sqlerrm like 'FALHOU%' then raise; end if;
  raise notice 'ok: o mesmo e-mail não vira duas entregas';
end $$;

-- 6) Registro à mão: arquivo tem que estar na pasta "manual" da própria entrega.
insert into storage.objects (bucket_id, name) values
  ('entregas', current_setting('t.org') || '/manual/25000000-0000-0000-0000-000000000007/1-foto.jpg');
select pg_temp.confere(
  (select origem::text from public.registrar_entrega_manual('25000000-0000-0000-0000-000000000007',
     '21000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-00000000000b', 'Recebido em mãos', '{}',
     jsonb_build_array(jsonb_build_object('caminho', current_setting('t.org') || '/manual/25000000-0000-0000-0000-000000000007/1-foto.jpg', 'nome', 'foto.jpg')))) = 'manual',
  'professor registra entrega à mão com arquivo');
do $$ begin
  insert into storage.objects (bucket_id, name) values
    ('entregas', current_setting('t.org') || '/emails/24000000-0000-0000-0000-000000000099/x.pdf');
  raise exception 'FALHOU: professor gravou na pasta de e-mails';
exception when insufficient_privilege then raise notice 'ok: só o servidor grava anexos de e-mail';
end $$;
do $$ begin
  perform public.registrar_entrega_manual('25000000-0000-0000-0000-000000000008', '21000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-00000000000b', '', '{""}', '[]');
  raise exception 'FALHOU: entrega vazia aceita';
exception when raise_exception then
  if sqlerrm like 'FALHOU%' then raise; end if;
  raise notice 'ok: entrega vazia é recusada';
end $$;
do $$ begin
  perform public.gravar_entrega_interna(gen_random_uuid(), current_setting('t.org')::uuid, '21000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-00000000000b', 'manual', null, '', '', now(), 'x', '{}', '[]', null);
  raise exception 'FALHOU: app chamou função interna';
exception when insufficient_privilege then raise notice 'ok: o app não chama a função interna de gravação';
end $$;
do $$ begin
  insert into public.entregas (id, org_id, etapa_id, grupo_id, origem, enviada_em)
    values (gen_random_uuid(), current_setting('t.org')::uuid, '21000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-00000000000b', 'manual', now());
  raise exception 'FALHOU: gravou entrega direto na tabela';
exception when insufficient_privilege then raise notice 'ok: ninguém grava entrega direto na tabela';
end $$;
do $$ begin
  perform public.receber_email_interno('{}'::jsonb, null);
  raise exception 'FALHOU: app chamou o recebimento';
exception when insufficient_privilege then raise notice 'ok: só o servidor chama o recebimento de e-mails';
end $$;

-- 7) A aluna (só e-mail cadastrado) e a outra empresa não veem nada.
select pg_temp.como('20000000-0000-0000-0000-00000000000d', 'aluna@delta.test');
select pg_temp.confere((select count(*) from public.organizacoes) + (select count(*) from public.entregas)
  + (select count(*) from public.emails_recebidos) + (select count(*) from storage.objects) = 0,
  'quem só entrega por e-mail não vê nada no Handback');
select pg_temp.como('20000000-0000-0000-0000-00000000000e', 'admin@outra2.test');
select pg_temp.confere((select count(*) from public.entregas) + (select count(*) from public.emails_recebidos)
  + (select count(*) from storage.objects) = 0, 'outra empresa não vê entregas, e-mails nem arquivos');
do $$ begin
  perform public.ignorar_email('24000000-0000-0000-0000-000000000001');
  raise exception 'FALHOU: outra empresa mexeu no e-mail';
exception when raise_exception then
  if sqlerrm like 'FALHOU%' then raise; end if;
  raise notice 'ok: outra empresa não mexe nos e-mails do curso';
end $$;
do $$ begin
  update public.organizacoes set caixa_token = 'aaaaaaaaaaaa' where slug = 'outra-2';
  raise exception 'FALHOU: admin trocou o código da caixa';
exception when raise_exception then
  if sqlerrm like 'FALHOU%' then raise; end if;
  raise notice 'ok: admin da empresa não troca o código da caixa de entrada';
end $$;
reset role;

\echo 'TODOS OS TESTES DE ENTREGAS PASSARAM'
