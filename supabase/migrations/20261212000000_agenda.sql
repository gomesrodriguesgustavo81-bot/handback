-- =====================================================================
--  Handback · Google Agenda (e base para outras contas Google)
--  Cada pessoa conecta a PRÓPRIA conta Google, separado por serviço
--  (Agenda, Drive), com a menor permissão possível: o Handback só mexe
--  no que ele mesmo criou. O token fica cifrado e só o servidor lê.
--  Por turma: a agenda "Handback · <turma>" na conta de quem ligou,
--  com o abre e o prazo de cada etapa (e, se quiser, os alunos convidados).
-- =====================================================================

create table public.conexoes_google (
  user_id uuid not null references auth.users (id) on delete cascade,
  servico text not null check (servico in ('agenda', 'drive')),
  email text not null,
  token_cifrado text not null,
  conectada_em timestamptz not null default now(),
  invalida boolean not null default false,
  primary key (user_id, servico)
);
alter table public.conexoes_google enable row level security;
revoke all on public.conexoes_google from anon, authenticated;
-- A pessoa vê as próprias conexões, mas nunca o token.
grant select (user_id, servico, email, conectada_em, invalida) on public.conexoes_google to authenticated;
grant select, insert, update, delete on public.conexoes_google to service_role;
create policy "cada um ve as suas conexoes" on public.conexoes_google
  for select to authenticated using (user_id = auth.uid());

alter table public.turmas
  add column agenda_por uuid references auth.users (id) on delete set null,
  add column agenda_id text,
  add column agenda_itens text[] not null default '{prazo,abre}' check (agenda_itens <@ array['prazo', 'abre', 'aula']::text[]),
  add column agenda_convidar boolean not null default false,
  add column agenda_erro text not null default '',
  add column agenda_em timestamptz;

create table public.agenda_eventos (
  etapa_id uuid not null references public.etapas (id) on delete cascade,
  tipo text not null check (tipo in ('prazo', 'abre', 'aula')),
  turma_id uuid not null references public.turmas (id) on delete cascade,
  agenda_id text not null,
  evento_id text not null,
  assinatura text not null default '',
  primary key (etapa_id, tipo)
);
alter table public.agenda_eventos enable row level security;
revoke all on public.agenda_eventos from anon, authenticated;
grant select, insert, update, delete on public.agenda_eventos to service_role;

-- Eventos de etapas apagadas: guardados aqui para o servidor apagar da agenda.
create table public.agenda_apagar (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,
  agenda_id text not null,
  evento_id text not null
);
alter table public.agenda_apagar enable row level security;
revoke all on public.agenda_apagar from anon, authenticated;
grant select, insert, delete on public.agenda_apagar to service_role;

create function public.guardar_eventos_para_apagar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.agenda_apagar (user_id, agenda_id, evento_id)
  select t.agenda_por, old.agenda_id, old.evento_id from public.turmas t where t.id = old.turma_id and t.agenda_por is not null;
  return old;
end;
$$;
create trigger agenda_eventos_apagados before delete on public.agenda_eventos
  for each row when (pg_trigger_depth() > 0)
  execute function public.guardar_eventos_para_apagar();

-- Registro de atividades: conectar e desconectar Agenda e Drive.
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
    when 'ativou_duas_etapas' then 'Ativou a verificação em duas etapas'
    when 'trocou_celular' then 'Trocou o celular das duas etapas'
    when 'conectou_gmail' then 'Conectou o Gmail para enviar devolutivas'
    when 'desconectou_gmail' then 'Desconectou o Gmail'
    when 'conectou_agenda' then 'Conectou o Google Agenda'
    when 'desconectou_agenda' then 'Desconectou o Google Agenda'
    when 'conectou_drive' then 'Conectou o Google Drive'
    when 'desconectou_drive' then 'Desconectou o Google Drive'
  end;
  if descricao is null then raise exception 'Ação de acesso desconhecida.'; end if;
  if p_acao in ('criou_senha', 'ativou_duas_etapas', 'trocou_celular', 'saiu_de_todos', 'conectou_gmail', 'desconectou_gmail',
                'conectou_agenda', 'desconectou_agenda', 'conectou_drive', 'desconectou_drive') then
    tipo := 'seguranca';
  end if;
  select u.email into meu_email from auth.users u where u.id = eu;
  insert into public.atividades (org_id, user_id, email, tipo, acao, descricao, ip, aparelho)
  select x.org_id, eu, coalesce(meu_email, ''), tipo, p_acao, descricao, left(coalesce(p_ip, ''), 64), left(coalesce(p_aparelho, ''), 120)
  from (select null::uuid as org_id union all select m.org_id from public.membros m where m.user_id = eu) x;
end;
$$;
