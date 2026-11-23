-- =====================================================================
--  Handback · Painel de uso (só o dono do Handback)
--  Quanto já foi usado dos limites dos planos grátis: arquivos, banco,
--  análises de IA, e-mails recebidos, e-mails de login e Gmails ligados.
--  Só números, nunca o conteúdo dos espaços.
-- =====================================================================
create function public.uso_da_plataforma()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  inicio_dia timestamptz := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  inicio_mes timestamptz := date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  emails_login integer := null;
begin
  if not public.e_admin_plataforma() then raise exception 'Só o dono do Handback.'; end if;
  -- E-mails de convite, cadastro e senha nova na última hora (registro do login do Supabase, se existir).
  if to_regclass('auth.audit_log_entries') is not null then
    execute $q$select count(*)::int from auth.audit_log_entries
      where created_at > now() - interval '1 hour'
        and payload ->> 'action' in ('user_invited', 'user_recovery_requested', 'user_confirmation_requested', 'user_repeated_signup')$q$
      into emails_login;
  end if;
  return jsonb_build_object(
    'arquivos_bytes', (select coalesce(sum((o.metadata ->> 'size')::bigint), 0) from storage.objects o where o.bucket_id = 'entregas'),
    'banco_bytes', pg_database_size(current_database()),
    'analises_hoje', (select count(*) from public.analises a where a.iniciada_em >= inicio_dia),
    'analises_mes', (select count(*) from public.analises a where a.iniciada_em >= inicio_mes),
    'emails_hoje', (select count(*) from public.emails_recebidos e where e.recebido_em >= inicio_dia),
    'emails_mes', (select count(*) from public.emails_recebidos e where e.recebido_em >= inicio_mes),
    'emails_login_hora', emails_login,
    'gmails_conectados', (select count(*) from public.contas_gmail g where not g.invalida),
    'pessoas', (select count(*) from auth.users),
    'espacos', (select count(*) from public.organizacoes)
  );
end;
$$;
revoke execute on function public.uso_da_plataforma() from public, anon;
grant execute on function public.uso_da_plataforma() to authenticated;
