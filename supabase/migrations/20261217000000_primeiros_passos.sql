-- =====================================================================
--  Handback · Primeiros passos
--  Marca quando a mensagem com o endereço de entrega foi copiada para a
--  turma (um dos passos da lista de quem acabou de chegar).
-- =====================================================================
alter table public.turmas add column mensagem_copiada_em timestamptz;
