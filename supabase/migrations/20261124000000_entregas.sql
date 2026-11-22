-- =====================================================================
--  Handback · Fase 2 (Entregas por e-mail)
--
--  Premissa: quem entrega NÃO usa o Handback. A equipe manda um e-mail para
--  o professor/gestor; o Gmail dele encaminha (por filtro) para o endereço de
--  recebimento da empresa no Handback. O Handback faz a triagem como o
--  protótipo: entrega reconhecida, "Para confirmar" ou ignorado.
--  Quem avalia também pode registrar uma entrega à mão.
--  Regras do protótipo: fora do prazo → "com atraso"; reenvio → a anterior
--  fica "substituída".
-- =====================================================================

-- ---------------------------------------------------------------------
-- Configuração do recebimento por empresa
-- ---------------------------------------------------------------------
alter table public.organizacoes
  add column caixa_token text not null unique
    default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
    check (caixa_token ~ '^[a-z0-9]{12}$'),
  add column etiqueta_assunto text not null default 'ENTREGA'
    check (length(trim(etiqueta_assunto)) between 1 and 40),
  add column modo_entrega text not null default 'confirmar'
    check (modo_entrega in ('confirmar', 'automatico')),
  add column assuntos_ignorar text not null
    default 'cadastro, bolsista, contrat, comprovante, document, fatura, holerite, ficha, pagamento, lembrete'
    check (length(assuntos_ignorar) <= 2000);

-- O token do endereço só pode ser trocado pelo dono da plataforma (ou pelo sistema).
create or replace function public.protege_campos_da_org()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and not public.e_admin_plataforma()
     and (new.ativa is distinct from old.ativa or new.slug is distinct from old.slug
          or new.frente is distinct from old.frente or new.caixa_token is distinct from old.caixa_token) then
    raise exception 'Só o dono da plataforma pode mudar endereço, frente, status ou caixa de entrada da empresa.';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- E-mails recebidos (o "raio-x": tudo o que chegou e o que foi decidido)
-- ---------------------------------------------------------------------
create type public.status_email as enum ('entrega', 'confirmar', 'ignorado', 'importado');

create table public.emails_recebidos (
  id uuid primary key,
  org_id uuid not null references public.organizacoes (id) on delete cascade,
  recebido_em timestamptz not null default now(),
  message_id text not null,
  responde_a text[] not null default '{}', -- In-Reply-To / References
  de_email text not null default '',
  de_nome text not null default '',
  assunto text not null default '',
  texto text not null default '',
  enviado_em timestamptz not null,
  links text[] not null default '{}',
  anexos jsonb not null default '[]', -- [{ caminho, nome, tamanho, tipo }]
  status public.status_email not null,
  motivo text not null default '',
  avisos text[] not null default '{}',
  etapa_sugerida uuid references public.etapas (id) on delete set null,
  grupo_sugerido uuid references public.grupos (id) on delete set null,
  entrega_id uuid,
  decidido_por uuid references auth.users (id) on delete set null,
  unique (org_id, message_id)
);
create index emails_org_status_idx on public.emails_recebidos (org_id, status, recebido_em desc);

-- ---------------------------------------------------------------------
-- Entregas
-- ---------------------------------------------------------------------
create type public.status_entrega as enum ('recebida', 'substituida');
create type public.origem_entrega as enum ('email', 'manual');

create table public.entregas (
  id uuid primary key,
  org_id uuid not null references public.organizacoes (id) on delete cascade,
  etapa_id uuid not null references public.etapas (id) on delete cascade,
  grupo_id uuid not null references public.grupos (id) on delete cascade,
  origem public.origem_entrega not null,
  email_id uuid references public.emails_recebidos (id) on delete set null,
  remetente text not null default '',
  assunto text not null default '',
  registrada_por uuid references auth.users (id) on delete set null,
  enviada_em timestamptz not null,
  registrada_em timestamptz not null default now(),
  atrasada boolean not null default false,
  comentario text not null default '' check (length(comentario) <= 20000),
  links text[] not null default '{}' check (cardinality(links) <= 50),
  status public.status_entrega not null default 'recebida'
);
create index entregas_etapa_idx on public.entregas (org_id, etapa_id, grupo_id, enviada_em desc);
-- Só uma entrega "valendo" por grupo em cada etapa.
create unique index entregas_uma_valendo on public.entregas (etapa_id, grupo_id) where status = 'recebida';

alter table public.emails_recebidos
  add constraint emails_entrega_fk foreign key (entrega_id) references public.entregas (id) on delete set null;

create table public.arquivos_entrega (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes (id) on delete cascade,
  entrega_id uuid not null references public.entregas (id) on delete cascade,
  caminho text not null,
  nome text not null,
  tamanho bigint not null default 0,
  tipo text not null default '',
  unique (entrega_id, caminho)
);
create index arquivos_entrega_idx on public.arquivos_entrega (entrega_id);

-- ---------------------------------------------------------------------
-- Regras de acesso: só quem avalia vê; ninguém grava direto nas tabelas
-- (tudo passa pelas funções abaixo, que conferem permissões).
-- ---------------------------------------------------------------------
alter table public.emails_recebidos enable row level security;
alter table public.entregas enable row level security;
alter table public.arquivos_entrega enable row level security;

create policy "avaliadores veem emails" on public.emails_recebidos
  for select to authenticated using (public.pode_avaliar_org(org_id));
create policy "avaliadores veem entregas" on public.entregas
  for select to authenticated using (public.pode_avaliar_org(org_id));
create policy "gestores apagam entregas" on public.entregas
  for delete to authenticated using (public.pode_gerir_org(org_id));
create policy "avaliadores veem arquivos" on public.arquivos_entrega
  for select to authenticated using (public.pode_avaliar_org(org_id));

-- ---------------------------------------------------------------------
-- Arquivos: área privada "entregas" no Storage
--   <empresa>/emails/<e-mail>/<arquivo>    (anexos recebidos por e-mail)
--   <empresa>/manual/<entrega>/<arquivo>   (registro à mão por quem avalia)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('entregas', 'entregas', false, 52428800) -- 50 MB por arquivo
on conflict (id) do nothing;

create function public.org_da_pasta(caminho text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return (string_to_array(caminho, '/'))[1]::uuid;
exception when others then
  return null;
end;
$$;

create policy "entregas: avaliadores leem arquivos" on storage.objects
  for select to authenticated
  using (bucket_id = 'entregas' and public.pode_avaliar_org(public.org_da_pasta(name)));
create policy "entregas: avaliadores enviam arquivos manuais" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'entregas'
    and (string_to_array(name, '/'))[2] = 'manual'
    and array_length(string_to_array(name, '/'), 1) = 4
    and public.pode_avaliar_org(public.org_da_pasta(name))
  );

-- ---------------------------------------------------------------------
-- Núcleo: grava uma entrega (uso interno; não pode ser chamado pelo app)
-- ---------------------------------------------------------------------
create function public.gravar_entrega_interna(
  p_id uuid,
  p_org uuid,
  p_etapa uuid,
  p_grupo uuid,
  p_origem public.origem_entrega,
  p_email uuid,
  p_remetente text,
  p_assunto text,
  p_enviada_em timestamptz,
  p_comentario text,
  p_links text[],
  p_arquivos jsonb,
  p_registrada_por uuid
)
returns public.entregas
language plpgsql
security definer
set search_path = ''
as $$
declare
  ate date;
  nova public.entregas;
  mais_nova boolean;
  a jsonb;
begin
  select e.recebe_ate into ate from public.etapas e where e.id = p_etapa and e.org_id = p_org;
  if not found then raise exception 'Etapa não encontrada nesta empresa.'; end if;
  if not exists (select 1 from public.grupos g where g.id = p_grupo and g.org_id = p_org) then
    raise exception 'Grupo não encontrado nesta empresa.';
  end if;

  -- Reenvio: a nova só substitui a atual se for mais recente.
  mais_nova := not exists (
    select 1 from public.entregas x
    where x.etapa_id = p_etapa and x.grupo_id = p_grupo and x.status = 'recebida' and x.enviada_em > p_enviada_em
  );
  if mais_nova then
    update public.entregas set status = 'substituida'
    where etapa_id = p_etapa and grupo_id = p_grupo and status = 'recebida';
  end if;

  insert into public.entregas (id, org_id, etapa_id, grupo_id, origem, email_id, remetente, assunto,
                               registrada_por, enviada_em, atrasada, comentario, links, status)
  values (
    p_id, p_org, p_etapa, p_grupo, p_origem, p_email, coalesce(p_remetente, ''), coalesce(p_assunto, ''),
    p_registrada_por, p_enviada_em,
    -- Atrasada se chegou depois do último dia de recebimento (horário de Brasília).
    ate is not null and (p_enviada_em at time zone 'America/Sao_Paulo')::date > ate,
    left(coalesce(trim(p_comentario), ''), 20000),
    coalesce(array_remove(p_links, ''), '{}'),
    case when mais_nova then 'recebida'::public.status_entrega else 'substituida'::public.status_entrega end
  )
  returning * into nova;

  for a in select * from jsonb_array_elements(coalesce(p_arquivos, '[]'::jsonb)) loop
    if public.org_da_pasta(a ->> 'caminho') is distinct from p_org then
      raise exception 'Arquivo fora da pasta desta empresa.';
    end if;
    insert into public.arquivos_entrega (org_id, entrega_id, caminho, nome, tamanho, tipo)
    values (p_org, p_id, a ->> 'caminho', coalesce(a ->> 'nome', ''), coalesce((a ->> 'tamanho')::bigint, 0),
            coalesce(a ->> 'tipo', ''));
  end loop;

  return nova;
end;
$$;

revoke execute on function public.gravar_entrega_interna(uuid, uuid, uuid, uuid, public.origem_entrega, uuid, text, text, timestamptz, text, text[], jsonb, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Ações do app (pessoas logadas que avaliam)
-- ---------------------------------------------------------------------

-- Registrar à mão (quando a entrega chegou por outro meio).
create function public.registrar_entrega_manual(
  p_id uuid,
  p_etapa uuid,
  p_grupo uuid,
  p_comentario text,
  p_links text[],
  p_arquivos jsonb
)
returns public.entregas
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid;
  a jsonb;
  prefixo text;
begin
  select e.org_id into org from public.etapas e where e.id = p_etapa;
  if org is null then raise exception 'Etapa não encontrada.'; end if;
  if not public.pode_avaliar_org(org) then
    raise exception 'Você não tem permissão para registrar entregas nesta empresa.';
  end if;
  if not exists (select 1 from public.organizacoes o where o.id = org and o.ativa) then
    raise exception 'Esta empresa está bloqueada.';
  end if;
  if coalesce(jsonb_array_length(p_arquivos), 0) = 0
     and coalesce(cardinality(array_remove(p_links, '')), 0) = 0
     and coalesce(trim(p_comentario), '') = '' then
    raise exception 'A entrega está vazia: envie um arquivo, um link ou um comentário.';
  end if;

  prefixo := org::text || '/manual/' || p_id::text || '/';
  for a in select * from jsonb_array_elements(coalesce(p_arquivos, '[]'::jsonb)) loop
    if left(a ->> 'caminho', length(prefixo)) <> prefixo then
      raise exception 'Arquivo fora da pasta desta entrega.';
    end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'entregas' and o.name = a ->> 'caminho') then
      raise exception 'Um dos arquivos não chegou a ser enviado. Tente de novo.';
    end if;
  end loop;

  return public.gravar_entrega_interna(p_id, org, p_etapa, p_grupo, 'manual', null,
    public.meu_email_ou_vazio(), 'Registrada à mão', now(), p_comentario, p_links, p_arquivos, auth.uid());
end;
$$;

create function public.meu_email_ou_vazio()
returns text
language sql
stable
set search_path = ''
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

-- Confirmar um e-mail como entrega (vem de "Para confirmar" ou dos ignorados).
create function public.importar_email(p_email uuid, p_etapa uuid, p_grupo uuid)
returns public.entregas
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.emails_recebidos;
  nova public.entregas;
begin
  select * into m from public.emails_recebidos where id = p_email for update;
  if not found or not public.pode_avaliar_org(m.org_id) then
    raise exception 'E-mail não encontrado.';
  end if;
  if m.status in ('entrega', 'importado') then
    raise exception 'Este e-mail já virou uma entrega.';
  end if;

  nova := public.gravar_entrega_interna(gen_random_uuid(), m.org_id, p_etapa, p_grupo, 'email', m.id,
    m.de_email, m.assunto, m.enviado_em, m.texto, m.links, m.anexos, auth.uid());

  update public.emails_recebidos
  set status = 'importado', entrega_id = nova.id, decidido_por = auth.uid()
  where id = m.id;
  return nova;
end;
$$;

-- Marcar um e-mail como "não é entrega".
create function public.ignorar_email(p_email uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.emails_recebidos;
begin
  select * into m from public.emails_recebidos where id = p_email for update;
  if not found or not public.pode_avaliar_org(m.org_id) then
    raise exception 'E-mail não encontrado.';
  end if;
  if m.status in ('entrega', 'importado') then
    raise exception 'Este e-mail já virou uma entrega; para desfazer, apague a entrega.';
  end if;
  update public.emails_recebidos set status = 'ignorado', decidido_por = auth.uid() where id = m.id;
end;
$$;

revoke execute on function public.registrar_entrega_manual(uuid, uuid, uuid, text, text[], jsonb) from public, anon;
revoke execute on function public.importar_email(uuid, uuid, uuid) from public, anon;
revoke execute on function public.ignorar_email(uuid) from public, anon;
grant execute on function public.registrar_entrega_manual(uuid, uuid, uuid, text, text[], jsonb) to authenticated;
grant execute on function public.importar_email(uuid, uuid, uuid) to authenticated;
grant execute on function public.ignorar_email(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Recebimento (usado só pelo servidor do Handback, com a chave secreta)
-- ---------------------------------------------------------------------

-- E-mails das pessoas da empresa (mensagens delas não contam como entrega).
create function public.emails_da_equipe_interna(org uuid)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(u.email::text) from public.membros m join auth.users u on u.id = m.user_id where m.org_id = org;
$$;

-- Grava o e-mail recebido e, se a triagem disse "entrega", a entrega também.
create function public.receber_email_interno(p_email jsonb, p_entrega uuid)
returns public.emails_recebidos
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.emails_recebidos;
begin
  insert into public.emails_recebidos (id, org_id, message_id, responde_a, de_email, de_nome, assunto, texto,
                                       enviado_em, links, anexos, status, motivo, avisos, etapa_sugerida, grupo_sugerido)
  values (
    (p_email ->> 'id')::uuid, (p_email ->> 'org_id')::uuid, p_email ->> 'message_id',
    coalesce(array(select jsonb_array_elements_text(p_email -> 'responde_a')), '{}'),
    coalesce(p_email ->> 'de_email', ''), coalesce(p_email ->> 'de_nome', ''), coalesce(p_email ->> 'assunto', ''),
    left(coalesce(p_email ->> 'texto', ''), 20000), (p_email ->> 'enviado_em')::timestamptz,
    coalesce(array(select jsonb_array_elements_text(p_email -> 'links')), '{}'),
    coalesce(p_email -> 'anexos', '[]'::jsonb),
    (p_email ->> 'status')::public.status_email, coalesce(p_email ->> 'motivo', ''),
    coalesce(array(select jsonb_array_elements_text(p_email -> 'avisos')), '{}'),
    (p_email ->> 'etapa_sugerida')::uuid, (p_email ->> 'grupo_sugerido')::uuid
  )
  on conflict (org_id, message_id) do nothing
  returning * into m;

  if m.id is null then
    return null; -- já recebido antes (o mesmo e-mail chegou de novo)
  end if;

  if m.status = 'entrega' then
    perform public.gravar_entrega_interna(p_entrega, m.org_id, m.etapa_sugerida, m.grupo_sugerido, 'email', m.id,
      m.de_email, m.assunto, m.enviado_em, m.texto, m.links, m.anexos, null);
    update public.emails_recebidos set entrega_id = p_entrega where id = m.id returning * into m;
  end if;
  return m;
end;
$$;

revoke execute on function public.emails_da_equipe_interna(uuid) from public, anon, authenticated;
revoke execute on function public.receber_email_interno(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.emails_da_equipe_interna(uuid) to service_role;
grant execute on function public.receber_email_interno(jsonb, uuid) to service_role;
grant execute on function public.gravar_entrega_interna(uuid, uuid, uuid, uuid, public.origem_entrega, uuid, text, text, timestamptz, text, text[], jsonb, uuid) to service_role;
