-- =====================================================================
--  Handback · Limite de tentativas de entrar
--  Depois de 5 senhas erradas seguidas para o mesmo e-mail, a entrada fica
--  travada por 15 minutos (mesmo com a senha certa). Guarda só uma marca
--  embaralhada do e-mail, nunca o e-mail. Só o servidor mexe aqui.
-- =====================================================================
create table public.tentativas_login (
  email_hash text primary key check (length(email_hash) between 16 and 128),
  falhas integer not null default 0 check (falhas >= 0),
  primeira_em timestamptz not null default now(),
  bloqueado_ate timestamptz
);

alter table public.tentativas_login enable row level security;
revoke all on public.tentativas_login from anon, authenticated;
grant select, insert, update, delete on public.tentativas_login to service_role;

-- Até quando a entrada está travada (null se não está).
create function public.login_bloqueio(p_hash text)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select t.bloqueado_ate from public.tentativas_login t
  where t.email_hash = p_hash and t.bloqueado_ate > now();
$$;

-- Registra uma senha errada. Devolve até quando travou (null se ainda não travou).
create function public.login_falhou(p_hash text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.tentativas_login;
begin
  -- Limpeza: marcas antigas e já destravadas não precisam ficar.
  delete from public.tentativas_login
  where primeira_em < now() - interval '1 day' and (bloqueado_ate is null or bloqueado_ate < now());

  insert into public.tentativas_login (email_hash, falhas, primeira_em)
  values (p_hash, 1, now())
  on conflict (email_hash) do update set
    -- Janela de 15 minutos: erros antigos não contam, e uma trava vencida recomeça do zero.
    falhas = case when public.tentativas_login.primeira_em < now() - interval '15 minutes'
                    or (public.tentativas_login.bloqueado_ate is not null and public.tentativas_login.bloqueado_ate < now())
                  then 1 else public.tentativas_login.falhas + 1 end,
    primeira_em = case when public.tentativas_login.primeira_em < now() - interval '15 minutes'
                         or (public.tentativas_login.bloqueado_ate is not null and public.tentativas_login.bloqueado_ate < now())
                       then now() else public.tentativas_login.primeira_em end,
    bloqueado_ate = case when public.tentativas_login.bloqueado_ate is not null and public.tentativas_login.bloqueado_ate > now()
                         then public.tentativas_login.bloqueado_ate else null end
  returning * into t;

  if t.falhas >= 5 and t.bloqueado_ate is null then
    update public.tentativas_login set bloqueado_ate = now() + interval '15 minutes' where email_hash = p_hash returning * into t;
  end if;
  return t.bloqueado_ate;
end;
$$;

-- Entrou com sucesso: zera a contagem.
create function public.login_ok(p_hash text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.tentativas_login where email_hash = p_hash;
$$;

revoke execute on function public.login_bloqueio(text), public.login_falhou(text), public.login_ok(text) from public, anon, authenticated;
grant execute on function public.login_bloqueio(text), public.login_falhou(text), public.login_ok(text) to service_role;
