-- =====================================================================
--  Handback · Apagar equipes que vieram do Moodle
--  Uma equipe do Moodle apagada no Handback voltaria na próxima busca.
--  Agora ela fica só escondida (e pausada): some das telas e o Moodle
--  não a traz de volta nem grava entregas nela.
-- =====================================================================

alter table public.grupos add column escondido boolean not null default false;
