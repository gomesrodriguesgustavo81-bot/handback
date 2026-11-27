-- =====================================================================
--  Handback · Registro do aceite dos Termos e da Política de privacidade
--  Guarda quem aceitou, qual versão e quando (prova e consulta). Não
--  guarda IP, só uma marca embaralhada quando o cadastro vem da internet.
--  Dois caminhos: o cadastro (servidor, sem login ainda) e a criação da
--  senha (a própria pessoa logada, pela função registrar_aceite).
-- =====================================================================
create table public.aceites_termos (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,
  email text not null default '' check (length(email) <= 320),
  versao text not null check (length(versao) between 1 and 40),
  origem text not null check (origem in ('cadastro', 'senha')),
  ip_hash text not null default '' check (length(ip_hash) <= 64),
  criado_em timestamptz not null default now()
);
create index aceites_termos_user_idx on public.aceites_termos (user_id, criado_em desc);
create index aceites_termos_email_idx on public.aceites_termos (lower(email));

alter table public.aceites_termos enable row level security;
revoke all on public.aceites_termos from anon, authenticated;
grant select on public.aceites_termos to authenticated;
grant select, insert, update, delete on public.aceites_termos to service_role;
-- Cada pessoa vê só os próprios aceites; ninguém grava direto.
create policy "ver o proprio aceite" on public.aceites_termos
  for select to authenticated using (user_id = auth.uid());

create function public.registrar_aceite(p_versao text, p_origem text default 'senha')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  mail text;
begin
  if uid is null then raise exception 'Entre na sua conta primeiro.'; end if;
  if coalesce(length(trim(p_versao)), 0) not between 1 and 40 then raise exception 'Versão dos termos inválida.'; end if;
  if p_origem not in ('cadastro', 'senha') then raise exception 'Origem inválida.'; end if;
  select lower(email) into mail from auth.users where id = uid;
  insert into public.aceites_termos (user_id, email, versao, origem) values (uid, coalesce(mail, ''), trim(p_versao), p_origem);
end;
$$;
revoke all on function public.registrar_aceite(text, text) from public, anon;
grant execute on function public.registrar_aceite(text, text) to authenticated;
