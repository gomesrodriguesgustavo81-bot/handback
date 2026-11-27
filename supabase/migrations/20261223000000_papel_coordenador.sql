-- =====================================================================
--  Handback · Papel "coordenador" (parte 1: só o nome do papel)
--  Fica num arquivo à parte porque o Postgres não deixa usar um valor
--  novo na mesma transação em que ele nasce. O resto está no próximo.
-- =====================================================================
alter type public.papel add value if not exists 'coordenador';
