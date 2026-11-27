-- =====================================================================
--  Handback · Duas etapas sempre valem para quem administra
--  Até aqui a empresa podia deixar a verificação "opcional" e, então,
--  o administrador entrava só com a senha. Agora o administrador precisa
--  do código do celular sempre (depois dos 14 primeiros dias, como já
--  era para o dono da plataforma). Para os demais papéis, a escolha da
--  empresa continua valendo.
-- =====================================================================
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
    and ((m.papel <> 'admin' and not o.exigir_duas_etapas)
         or public.sessao_com_duas_etapas()
         or public.em_experiencia());
$$;

-- O app precisa saber que o administrador (ou quem foi convidado para
-- administrar) deve usar a segunda etapa, mesmo com a empresa "opcional".
create or replace function public.preciso_de_duas_etapas()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.administradores_plataforma a where a.user_id = auth.uid())
      or exists (
        select 1 from public.membros m join public.organizacoes o on o.id = m.org_id
        where m.user_id = auth.uid() and (o.exigir_duas_etapas or m.papel = 'admin')
      )
      or exists (
        select 1 from public.convites c join public.organizacoes o on o.id = c.org_id
        where c.aceito_em is null and c.email = lower(coalesce(auth.jwt() ->> 'email', ''))
          and (o.exigir_duas_etapas or c.papel = 'admin')
      );
$$;
