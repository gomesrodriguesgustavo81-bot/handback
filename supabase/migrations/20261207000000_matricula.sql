-- =====================================================================
--  Handback · Matrícula dos alunos
--  Cada integrante ganha um número opcional (matrícula, nº USP, RA…).
--  Vem do Moodle quando o site mostra esse número ao professor; também
--  dá para digitar. O nome continua sendo o que aparece em tudo.
-- =====================================================================

alter table public.integrantes
  add column matricula text not null default '' check (length(matricula) <= 40);

alter table public.integrantes
  add constraint integrantes_nome_tamanho check (length(nome) <= 200);
