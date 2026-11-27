-- =====================================================================
--  Handback · Segurança da conta: trava que cresce, códigos de recuperação,
--  aparelhos conectados, senhas antigas (administradores) e sessão de 24 h
--  para quem administra.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Trava que cresce: a 1ª trava dura 1 minuto, a 2ª 5 minutos, da 3ª em diante 15
--    (as travas contam por 24 horas). Substitui a função da migração anterior.
-- ---------------------------------------------------------------------
alter table public.tentativas_login
  add column travas integer not null default 0 check (travas >= 0),
  add column ultima_trava timestamptz;

create or replace function public.login_falhou(p_hash text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.tentativas_login;
  n integer;
begin
  delete from public.tentativas_login
  where primeira_em < now() - interval '1 day' and (bloqueado_ate is null or bloqueado_ate < now())
    and (ultima_trava is null or ultima_trava < now() - interval '1 day');

  insert into public.tentativas_login (email_hash, falhas, primeira_em)
  values (p_hash, 1, now())
  on conflict (email_hash) do update set
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
    -- Travas anteriores nas últimas 24 horas aumentam o tempo.
    n := (case when t.ultima_trava is not null and t.ultima_trava > now() - interval '1 day' then t.travas else 0 end) + 1;
    update public.tentativas_login
       set bloqueado_ate = now() + (case n when 1 then interval '1 minute' when 2 then interval '5 minutes' else interval '15 minutes' end),
           travas = n,
           ultima_trava = now()
     where email_hash = p_hash
     returning * into t;
  end if;
  return t.bloqueado_ate;
end;
$$;

-- Entrou com sucesso: zera as tentativas (mas guarda o histórico de travas por 24 h).
create or replace function public.login_ok(p_hash text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.tentativas_login set falhas = 0, bloqueado_ate = null where email_hash = p_hash and ultima_trava is not null and ultima_trava > now() - interval '1 day';
  delete from public.tentativas_login where email_hash = p_hash and (ultima_trava is null or ultima_trava <= now() - interval '1 day');
$$;

-- ---------------------------------------------------------------------
-- 2) Códigos de recuperação da verificação em duas etapas (uso único)
-- ---------------------------------------------------------------------
create table public.codigos_recuperacao (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  hash text not null check (length(hash) between 32 and 128),
  usado_em timestamptz,
  criado_em timestamptz not null default now()
);
create index codigos_recuperacao_user_idx on public.codigos_recuperacao (user_id);
alter table public.codigos_recuperacao enable row level security;
revoke all on public.codigos_recuperacao from anon, authenticated;
grant select, insert, update, delete on public.codigos_recuperacao to service_role;

-- A pessoa vê só QUANTOS códigos ainda tem (nunca os códigos).
create function public.meus_codigos_de_recuperacao()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.codigos_recuperacao where user_id = auth.uid() and usado_em is null;
$$;
revoke execute on function public.meus_codigos_de_recuperacao() from public, anon;
grant execute on function public.meus_codigos_de_recuperacao() to authenticated;

-- ---------------------------------------------------------------------
-- 3) Senhas antigas (guarda só uma marca de cada, para administradores não repetirem)
-- ---------------------------------------------------------------------
create table public.senhas_antigas (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  marca text not null check (length(marca) between 32 and 300),
  criado_em timestamptz not null default now()
);
create index senhas_antigas_user_idx on public.senhas_antigas (user_id, criado_em desc);
alter table public.senhas_antigas enable row level security;
revoke all on public.senhas_antigas from anon, authenticated;
grant select, insert, update, delete on public.senhas_antigas to service_role;

-- ---------------------------------------------------------------------
-- 4) Quem administra? (dono da plataforma, administrador de empresa ou convidado para ser)
-- ---------------------------------------------------------------------
create function public.e_quem_administra()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.administradores_plataforma a where a.user_id = auth.uid())
      or exists (select 1 from public.membros m where m.user_id = auth.uid() and m.papel = 'admin')
      or exists (
        select 1 from public.convites c
        where c.aceito_em is null and c.papel = 'admin' and c.email = lower(coalesce(auth.jwt() ->> 'email', ''))
      );
$$;
revoke execute on function public.e_quem_administra() from public, anon;
grant execute on function public.e_quem_administra() to authenticated;

-- ---------------------------------------------------------------------
-- 5) Sessão de administrador vale 24 horas, depois pede a senha de novo
-- ---------------------------------------------------------------------
create function public.sessao_de_admin_vencida()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.e_quem_administra()
     and exists (
       select 1 from auth.sessions s
       where s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
         and s.created_at < now() - interval '24 hours'
     );
$$;
revoke execute on function public.sessao_de_admin_vencida() from public, anon;
grant execute on function public.sessao_de_admin_vencida() to authenticated;

-- ---------------------------------------------------------------------
-- 6) Aparelhos conectados da própria pessoa (sem mostrar o endereço de rede inteiro)
-- ---------------------------------------------------------------------
create function public.minhas_sessoes()
returns table (id uuid, criada_em timestamptz, atividade_em timestamptz, aparelho text, rede text, esta boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id,
         s.created_at,
         coalesce(s.refreshed_at, s.updated_at, s.created_at),
         left(coalesce(s.user_agent, ''), 200),
         -- Só o começo do endereço de rede: o bastante para reconhecer, sem expor o número todo.
         case when s.ip is null then '' else regexp_replace(host(s.ip), '(\.[0-9]+|:[0-9a-fA-F]*)$', '.x') end,
         s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
  from auth.sessions s
  where s.user_id = auth.uid() and (s.not_after is null or s.not_after > now())
  order by coalesce(s.refreshed_at, s.updated_at, s.created_at) desc
  limit 20;
$$;
revoke execute on function public.minhas_sessoes() from public, anon;
grant execute on function public.minhas_sessoes() to authenticated;

-- ---------------------------------------------------------------------
-- 7) O servidor precisa saber se o e-mail tem conta (para avisar quando a entrada travar),
--    sem revelar isso a quem digitou.
-- ---------------------------------------------------------------------
create function public.usuario_do_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1;
$$;
revoke execute on function public.usuario_do_email(text) from public, anon, authenticated;
grant execute on function public.usuario_do_email(text) to service_role;

-- ---------------------------------------------------------------------
-- 8) O registro de atividades ganha as ações novas de segurança
-- ---------------------------------------------------------------------
create or replace function public.registrar_acesso(p_acao text, p_ip text, p_aparelho text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  descricao text;
  tipo text := 'acesso';
  eu uuid := auth.uid();
  meu_email text;
begin
  if eu is null then return; end if;
  descricao := case p_acao
    when 'entrou_senha' then 'Entrou com e-mail e senha'
    when 'entrou_link' then 'Entrou pelo link do e-mail (convite, nova senha ou Google)'
    when 'confirmou_codigo' then 'Confirmou o código das duas etapas'
    when 'saiu' then 'Saiu'
    when 'saiu_de_todos' then 'Saiu de todos os aparelhos'
    when 'criou_senha' then 'Criou ou trocou a senha'
    when 'trocou_senha' then 'Trocou a senha (e saiu dos outros aparelhos)'
    when 'gerou_codigos_recuperacao' then 'Gerou códigos de recuperação das duas etapas'
    when 'usou_codigo_recuperacao' then 'Usou um código de recuperação (duas etapas desligadas)'
    when 'ativou_duas_etapas' then 'Ativou a verificação em duas etapas'
    when 'trocou_celular' then 'Trocou o celular das duas etapas'
    when 'conectou_gmail' then 'Conectou o Gmail para enviar devolutivas'
    when 'desconectou_gmail' then 'Desconectou o Gmail'
    when 'conectou_agenda' then 'Conectou o Google Agenda'
    when 'desconectou_agenda' then 'Desconectou o Google Agenda'
    when 'conectou_drive' then 'Conectou o Google Drive'
    when 'desconectou_drive' then 'Desconectou o Google Drive'
    when 'conectou_classroom' then 'Conectou o Google Classroom'
    when 'desconectou_classroom' then 'Desconectou o Google Classroom'
  end;
  if descricao is null then raise exception 'Ação de acesso desconhecida.'; end if;
  if p_acao in ('criou_senha', 'trocou_senha', 'gerou_codigos_recuperacao', 'usou_codigo_recuperacao', 'ativou_duas_etapas', 'trocou_celular', 'saiu_de_todos', 'conectou_gmail', 'desconectou_gmail',
                'conectou_agenda', 'desconectou_agenda', 'conectou_drive', 'desconectou_drive',
                'conectou_classroom', 'desconectou_classroom') then
    tipo := 'seguranca';
  end if;
  select u.email into meu_email from auth.users u where u.id = eu;
  insert into public.atividades (org_id, user_id, email, tipo, acao, descricao, ip, aparelho)
  select x.org_id, eu, coalesce(meu_email, ''), tipo, p_acao, descricao, left(coalesce(p_ip, ''), 64), left(coalesce(p_aparelho, ''), 120)
  from (select null::uuid as org_id union all select m.org_id from public.membros m where m.user_id = eu) x;
end;
$$;
