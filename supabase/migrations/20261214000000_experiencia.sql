-- =====================================================================
--  Handback · Primeiros 14 dias só com a senha
--  Quem acabou de criar a conta conhece o Handback sem o app autenticador.
--  Depois de 14 dias (ou assim que cadastrar o app), volta a valer a regra
--  da empresa. O dono da plataforma continua sempre com as duas etapas.
-- =====================================================================

-- A pessoa logada está nos 14 primeiros dias e ainda não cadastrou o app?
create function public.em_experiencia()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from auth.users u where u.id = auth.uid() and u.created_at > now() - interval '14 days')
     and not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status::text = 'verified')
     and not exists (select 1 from public.administradores_plataforma a where a.user_id = auth.uid());
$$;

-- Até quando vai a experiência (null se não está nela).
create function public.fim_da_experiencia()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select u.created_at + interval '14 days' from auth.users u
  where u.id = auth.uid() and public.em_experiencia();
$$;

create or replace function public.papel_na_org(org uuid)
returns public.papel
language sql
stable
security definer
set search_path = ''
as $$
  select m.papel
  from public.membros m
  join public.organizacoes o on o.id = m.org_id
  where m.org_id = org and m.user_id = auth.uid()
    and (not o.exigir_duas_etapas or public.sessao_com_duas_etapas() or public.em_experiencia());
$$;

revoke execute on function public.em_experiencia() from public, anon;
revoke execute on function public.fim_da_experiencia() from public, anon;
grant execute on function public.em_experiencia() to authenticated;
grant execute on function public.fim_da_experiencia() to authenticated;
