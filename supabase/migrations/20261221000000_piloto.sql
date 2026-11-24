-- Piloto automático por turma: o que chega já entra na fila da IA sozinho.
-- A aprovação continua sempre com o professor (nada sai para o aluno sem ele).

alter table public.turmas
  add column piloto boolean not null default false,
  -- Quem ligou: recebe o aviso "N análises prontas".
  add column piloto_por uuid references auth.users (id) on delete set null;

-- Liga ou desliga (só quem administra a empresa da turma).
create function public.ligar_piloto(p_turma uuid, p_ligar boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select org_id into v_org from public.turmas where id = p_turma;
  if v_org is null or auth.uid() is null or not public.pode_gerir_org(v_org) then
    raise exception 'Você não tem permissão para fazer isso.';
  end if;
  update public.turmas
  set piloto = p_ligar, piloto_por = case when p_ligar then auth.uid() else null end
  where id = p_turma;
end;
$$;
revoke execute on function public.ligar_piloto(uuid, boolean) from public, anon;
grant execute on function public.ligar_piloto(uuid, boolean) to authenticated;

-- Põe na fila as entregas da turma com piloto que ainda não têm análise.
-- Um lote por turma e por hora: um aviso só para o que chegou junto.
create function public.piloto_enfileirar(p_entregas uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  insert into public.fila_analises (entrega_id, org_id, lote, pedida_por)
  select e.id, e.org_id,
    md5(t.id::text || to_char(date_trunc('hour', now()), 'YYYYMMDDHH24'))::uuid,
    t.piloto_por
  from public.entregas e
  join public.etapas et on et.id = e.etapa_id
  join public.turmas t on t.id = et.turma_id
  left join public.analises a on a.entrega_id = e.id
  where e.id = any (p_entregas)
    and t.piloto and not t.arquivada
    and e.status = 'recebida'
    and cardinality(et.entregaveis) > 0
    and a.entrega_id is null
  on conflict (entrega_id) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.piloto_enfileirar(uuid[]) from public, anon, authenticated;
grant execute on function public.piloto_enfileirar(uuid[]) to service_role;

-- Varredura: o servidor chama depois que uma entrega termina de chegar
-- (e-mail, Moodle, Classroom) e na rodada diária. Não usa gatilho por arquivo
-- para a IA nunca começar com a entrega ainda pela metade.
create function public.piloto_varrer()
returns integer
language sql
security definer
set search_path = ''
as $$
  select public.piloto_enfileirar(coalesce(array_agg(e.id), '{}'))
  from public.entregas e
  join public.etapas et on et.id = e.etapa_id
  join public.turmas t on t.id = et.turma_id
  where t.piloto and e.status = 'recebida'
    and not exists (select 1 from public.analises a where a.entrega_id = e.id)
    and not exists (select 1 from public.fila_analises f where f.entrega_id = e.id);
$$;
revoke execute on function public.piloto_varrer() from public, anon, authenticated;
grant execute on function public.piloto_varrer() to service_role;

-- "Lembrar quem não entregou": o professor manda na hora, no máximo uma vez
-- por dia para cada aluno/equipe em cada ciclo (para não virar spam).
create table public.lembretes_manuais (
  etapa_id uuid not null references public.etapas (id) on delete cascade,
  grupo_id uuid not null references public.grupos (id) on delete cascade,
  dia date not null,
  enviado_por uuid references auth.users (id) on delete set null,
  enviado_em timestamptz not null default now(),
  primary key (etapa_id, grupo_id, dia)
);
alter table public.lembretes_manuais enable row level security;
revoke all on public.lembretes_manuais from anon, authenticated;
grant select, insert, delete on public.lembretes_manuais to service_role;
