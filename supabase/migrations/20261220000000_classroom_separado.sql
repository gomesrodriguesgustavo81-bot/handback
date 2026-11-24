-- =====================================================================
--  Handback · Classroom em turma própria
--  Uma turma vem de um lugar só: Moodle OU Classroom. Ligar uma sala do
--  Classroom cria uma turma nova (como o Moodle já faz).
--  Ciclo apagado no Handback não volta na próxima busca do Classroom.
-- =====================================================================

-- Arruma turmas do Moodle que foram ligadas ao Classroom por engano:
-- sai o que veio do Classroom (ciclos e alunos) e a ligação.
delete from public.etapas e using public.turmas t
  where t.id = e.turma_id and t.moodle_conta is not null and t.classroom_curso is not null and e.classroom_tarefa is not null;
delete from public.grupos g using public.turmas t
  where t.id = g.turma_id and t.moodle_conta is not null and t.classroom_curso is not null and g.classroom_aluno is not null;
update public.turmas
  set classroom_curso = null, classroom_curso_nome = '', classroom_por = null, classroom_buscado_em = null, classroom_erro = ''
  where moodle_conta is not null and classroom_curso is not null;

alter table public.turmas add constraint turmas_uma_origem check (moodle_conta is null or classroom_curso is null);

-- Tarefas do Classroom cujo ciclo foi apagado no Handback: a busca não traz de novo.
create table public.classroom_ignoradas (
  turma_id uuid not null references public.turmas (id) on delete cascade,
  tarefa text not null,
  primary key (turma_id, tarefa)
);
alter table public.classroom_ignoradas enable row level security;
revoke all on public.classroom_ignoradas from anon, authenticated;
grant select, insert, delete on public.classroom_ignoradas to service_role;

create function public.guardar_tarefa_ignorada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.classroom_ignoradas (turma_id, tarefa)
  select old.turma_id, old.classroom_tarefa
  where exists (select 1 from public.turmas t where t.id = old.turma_id)
  on conflict do nothing;
  return old;
end;
$$;
create trigger etapas_classroom_apagadas after delete on public.etapas
  for each row when (old.classroom_tarefa is not null)
  execute function public.guardar_tarefa_ignorada();
