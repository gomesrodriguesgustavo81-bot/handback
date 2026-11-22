-- Imitação mínima do Supabase para testar as migrações num Postgres comum.
-- NÃO rode isto no Supabase de verdade: lá o esquema "auth" já existe.
create role anon nologin;
create role authenticated nologin;
create schema auth;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;

create table auth.users (
  id uuid primary key,
  email text not null
);

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

grant execute on all functions in schema auth to anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
