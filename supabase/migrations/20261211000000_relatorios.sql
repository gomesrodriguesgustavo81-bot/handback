-- =====================================================================
--  Handback · Relatórios
--  Média final opcional por turma (desligada por padrão), com peso por
--  etapa (aula). Quem não usa média não vê nada disso nos relatórios.
-- =====================================================================

alter table public.turmas add column media_ativa boolean not null default false;
alter table public.etapas add column peso numeric(4, 1) not null default 1 check (peso >= 0 and peso <= 10);
