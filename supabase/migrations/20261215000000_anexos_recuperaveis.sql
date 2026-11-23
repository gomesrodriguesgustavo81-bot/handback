-- =====================================================================
--  Handback · Anexos de e-mails ignorados
--  Por privacidade, o Handback não guarda os anexos de e-mails ignorados.
--  Guarda só o nome e o código do e-mail no serviço de recebimento, para
--  buscar os anexos de novo se alguém disser que aquele e-mail era entrega.
-- =====================================================================
alter table public.emails_recebidos
  add column origem_id text,
  add column anexos_pendentes jsonb not null default '[]';
