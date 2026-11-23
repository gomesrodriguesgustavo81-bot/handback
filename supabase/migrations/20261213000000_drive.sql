-- =====================================================================
--  Handback · Google Drive
--  Por turma, os arquivos das entregas podem ir para o Drive de quem
--  ligou (pastas Handback › turma › equipe, criadas sozinhas). A
--  permissão drive.file só deixa o Handback mexer no que ele criou.
--  O arquivo chega primeiro no Handback e o servidor leva para o Drive
--  logo depois (e apaga a cópia daqui, liberando espaço).
-- =====================================================================

alter table public.turmas
  add column drive_por uuid references auth.users (id) on delete set null,
  add column drive_desde timestamptz,
  add column drive_antigos boolean not null default false,
  add column drive_erro text not null default '';

alter table public.arquivos_entrega
  alter column caminho drop not null,
  add column drive_id text,
  add column drive_por uuid references auth.users (id) on delete set null,
  add column drive_tentativas integer not null default 0,
  add column drive_erro text not null default '';
create index arquivos_entrega_sem_drive_idx on public.arquivos_entrega (entrega_id) where drive_id is null;

-- Pastas criadas no Drive de cada pessoa ('raiz', 'turma:<id>', 'grupo:<id>').
create table public.drive_pastas (
  user_id uuid not null references auth.users (id) on delete cascade,
  chave text not null check (chave ~ '^(raiz|turma:[0-9a-f-]{36}|grupo:[0-9a-f-]{36})$'),
  pasta_id text not null,
  primary key (user_id, chave)
);
alter table public.drive_pastas enable row level security;
revoke all on public.drive_pastas from anon, authenticated;
grant select, insert, update, delete on public.drive_pastas to service_role;

-- Arquivos que esperam ir para o Drive (só o servidor chama).
create function public.arquivos_para_drive(p_limite integer)
returns table (
  id uuid, caminho text, nome text, tipo text, org_id uuid,
  turma_id uuid, turma_nome text, grupo_id uuid, grupo_nome text,
  etapa_numero integer, drive_por uuid, tentativas integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.caminho, a.nome, a.tipo, a.org_id,
         t.id, t.nome, g.id, g.nome, et.numero, t.drive_por, a.drive_tentativas
  from public.arquivos_entrega a
  join public.entregas e on e.id = a.entrega_id
  join public.grupos g on g.id = e.grupo_id
  join public.turmas t on t.id = g.turma_id
  join public.etapas et on et.id = e.etapa_id
  where a.drive_id is null and a.caminho is not null and a.drive_tentativas < 5
    and t.drive_por is not null
    and (t.drive_antigos or e.registrada_em >= t.drive_desde)
  order by e.registrada_em
  limit p_limite;
$$;
revoke execute on function public.arquivos_para_drive(integer) from public, anon, authenticated;
grant execute on function public.arquivos_para_drive(integer) to service_role;

-- Situação da turma (para a tela): quantos já estão no Drive e quantos esperam.
create function public.situacao_drive(p_turma uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'no_drive', count(*) filter (where a.drive_id is not null),
    'esperando', count(*) filter (where a.drive_id is null and a.caminho is not null and t.drive_por is not null
                                  and (t.drive_antigos or e.registrada_em >= t.drive_desde) and a.drive_tentativas < 5),
    'com_erro', count(*) filter (where a.drive_id is null and a.drive_tentativas >= 5)
  )
  from public.arquivos_entrega a
  join public.entregas e on e.id = a.entrega_id
  join public.grupos g on g.id = e.grupo_id
  join public.turmas t on t.id = g.turma_id
  where t.id = p_turma and public.pode_avaliar_org(t.org_id);
$$;
revoke execute on function public.situacao_drive(uuid) from public, anon;
grant execute on function public.situacao_drive(uuid) to authenticated, service_role;
