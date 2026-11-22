-- =====================================================================
--  Handback · Acesso seguro
--  Verificação em duas etapas (senha + código do app autenticador) exigida
--  pelo próprio banco: sem a segunda etapa, a pessoa não enxerga nem mexe
--  nos dados de uma empresa que exige 2 etapas. O dono da plataforma
--  sempre precisa das 2 etapas.
-- =====================================================================

alter table public.organizacoes add column exigir_duas_etapas boolean not null default true;

-- A sessão atual passou pela segunda etapa? (o Supabase grava "aal2" no token)
create function public.sessao_com_duas_etapas()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

create or replace function public.e_admin_plataforma()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.sessao_com_duas_etapas() and exists (
    select 1 from public.administradores_plataforma a
    where a.user_id = auth.uid()
  );
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
    and (not o.exigir_duas_etapas or public.sessao_com_duas_etapas());
$$;

-- Para o app saber se a pessoa precisa cadastrar/usar a segunda etapa:
-- é dona da plataforma ou participa de alguma empresa que exige.
create function public.preciso_de_duas_etapas()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.administradores_plataforma a where a.user_id = auth.uid())
      or exists (
        select 1 from public.membros m join public.organizacoes o on o.id = m.org_id
        where m.user_id = auth.uid() and o.exigir_duas_etapas
      )
      or exists (
        select 1 from public.convites c join public.organizacoes o on o.id = c.org_id
        where c.aceito_em is null and c.email = lower(coalesce(auth.jwt() ->> 'email', '')) and o.exigir_duas_etapas
      );
$$;

revoke execute on function public.preciso_de_duas_etapas() from public, anon;
grant execute on function public.preciso_de_duas_etapas() to authenticated;
grant execute on function public.sessao_com_duas_etapas() to authenticated;
