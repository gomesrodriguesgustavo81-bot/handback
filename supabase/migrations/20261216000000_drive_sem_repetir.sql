-- =====================================================================
--  Handback · Drive sem arquivos repetidos
--  Várias rodadas podem levar arquivos ao Drive ao mesmo tempo (ao abrir
--  o app, ao chegar uma entrega, na rodada diária). Cada arquivo agora é
--  reservado por uma rodada só; se ela cair, outra pega depois de 3 minutos.
-- =====================================================================
alter table public.arquivos_entrega add column drive_pegou_em timestamptz;

create or replace function public.arquivos_para_drive(p_limite integer)
returns table (
  id uuid, caminho text, nome text, tipo text, org_id uuid,
  turma_id uuid, turma_nome text, grupo_id uuid, grupo_nome text,
  etapa_numero integer, drive_por uuid, tentativas integer
)
language sql
volatile
security definer
set search_path = ''
as $$
  with escolhidos as (
    select a.id
    from public.arquivos_entrega a
    join public.entregas e on e.id = a.entrega_id
    join public.grupos g on g.id = e.grupo_id
    join public.turmas t on t.id = g.turma_id
    where a.drive_id is null and a.caminho is not null and a.drive_tentativas < 5
      and t.drive_por is not null
      and (t.drive_antigos or e.registrada_em >= t.drive_desde)
      and (a.drive_pegou_em is null or a.drive_pegou_em < now() - interval '3 minutes')
    order by e.registrada_em
    limit p_limite
    for update of a skip locked
  ), pegos as (
    update public.arquivos_entrega a set drive_pegou_em = now()
    from escolhidos x where a.id = x.id
    returning a.id, a.caminho, a.nome, a.tipo, a.org_id, a.entrega_id, a.drive_tentativas
  )
  select p.id, p.caminho, p.nome, p.tipo, p.org_id,
         t.id, t.nome, g.id, g.nome, et.numero, t.drive_por, p.drive_tentativas
  from pegos p
  join public.entregas e on e.id = p.entrega_id
  join public.grupos g on g.id = e.grupo_id
  join public.turmas t on t.id = g.turma_id
  join public.etapas et on et.id = e.etapa_id;
$$;
revoke execute on function public.arquivos_para_drive(integer) from public, anon, authenticated;
grant execute on function public.arquivos_para_drive(integer) to service_role;
