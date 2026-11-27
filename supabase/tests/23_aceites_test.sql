-- Testes do registro de aceite dos termos.
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

-- 1) A pessoa logada registra o aceite e vê só o dela.
set role authenticated;
select pg_temp.como('30000000-0000-0000-0000-00000000000c', 'prof@epsilon.test');
select public.registrar_aceite('2026-11-27', 'senha');
select pg_temp.confere((select count(*) = 1 and min(versao) = '2026-11-27' and min(origem) = 'senha' from public.aceites_termos), 'a pessoa registra o aceite com versão e origem');
select pg_temp.confere((select email = 'prof@epsilon.test' or email = '' from public.aceites_termos limit 1), 'o e-mail vem da conta, não de quem chama');
select pg_temp.como('30000000-0000-0000-0000-00000000000b', 'admin@epsilon.test');
select pg_temp.confere((select count(*) = 0 from public.aceites_termos), 'outra pessoa não vê o aceite alheio');

-- 2) Entradas inválidas são recusadas.
select pg_temp.erro_contem($$select public.registrar_aceite('', 'senha')$$, 'inválida', 'versão vazia é recusada');
select pg_temp.erro_contem($$select public.registrar_aceite('2026-11-27', 'hack')$$, 'Origem', 'origem desconhecida é recusada');

-- 3) Ninguém grava direto; sem login não registra.
do $$ begin
  begin insert into public.aceites_termos (versao, origem) values ('x', 'senha'); raise exception 'FALHOU: gravou direto';
  exception when insufficient_privilege then raise notice 'ok: gravar direto é negado'; end;
end $$;
reset role;
set role anon;
do $$ begin
  begin perform public.registrar_aceite('2026-11-27', 'senha'); raise exception 'FALHOU: anônimo registrou';
  exception when insufficient_privilege then raise notice 'ok: anônimo não executa a função'; end;
end $$;
reset role;
