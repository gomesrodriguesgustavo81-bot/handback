-- =====================================================================
--  Handback · Fase 2 (Entregas pelo site)
--  Quem está cadastrado num grupo (pelo e-mail) entra e envia arquivos,
--  links e comentário. Quem avalia vê o quadro de entregas por etapa.
--  Regras do protótipo: fora do prazo → "com atraso"; reenvio → a anterior
--  fica "substituída".
-- =====================================================================

-- ---------------------------------------------------------------------
-- Quem entrega: pessoas cujo e-mail (já confirmado pelo login) está num grupo
-- ---------------------------------------------------------------------
create function public.meu_email()
returns text
language sql
stable
set search_path = ''
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create function public.e_integrante(grupo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.integrantes i
    join public.grupos g on g.id = i.grupo_id
    where i.grupo_id = grupo and g.ativo and i.email = public.meu_email() and public.meu_email() <> ''
  );
$$;

create function public.e_integrante_da_org(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.integrantes i
    join public.grupos g on g.id = i.grupo_id
    where i.org_id = org and g.ativo and i.email = public.meu_email() and public.meu_email() <> ''
  );
$$;

-- Quem entrega também enxerga a empresa (nome e palavras), as etapas e o próprio grupo.
create policy "integrantes veem a empresa" on public.organizacoes
  for select to authenticated using (public.e_integrante_da_org(id));
create policy "integrantes veem etapas" on public.etapas
  for select to authenticated using (public.e_integrante_da_org(org_id));
create policy "integrantes veem o proprio grupo" on public.grupos
  for select to authenticated using (public.e_integrante(id));
create policy "integrantes veem colegas do grupo" on public.integrantes
  for select to authenticated using (public.e_integrante(grupo_id));

-- ---------------------------------------------------------------------
-- Entregas
-- ---------------------------------------------------------------------
create type public.status_entrega as enum ('recebida', 'substituida');

create table public.entregas (
  id uuid primary key,
  org_id uuid not null references public.organizacoes (id) on delete cascade,
  etapa_id uuid not null references public.etapas (id) on delete cascade,
  grupo_id uuid not null references public.grupos (id) on delete cascade,
  enviada_por uuid references auth.users (id) on delete set null,
  enviada_por_email text not null,
  registrada_pela_equipe boolean not null default true, -- false = registrada por quem avalia
  enviada_em timestamptz not null default now(),
  atrasada boolean not null default false,
  comentario text not null default '' check (length(comentario) <= 5000),
  links text[] not null default '{}' check (cardinality(links) <= 20),
  status public.status_entrega not null default 'recebida'
);
create index entregas_etapa_idx on public.entregas (org_id, etapa_id, grupo_id, enviada_em desc);
-- Só uma entrega "valendo" por grupo em cada etapa.
create unique index entregas_uma_valendo on public.entregas (etapa_id, grupo_id) where status = 'recebida';

create table public.arquivos_entrega (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes (id) on delete cascade,
  entrega_id uuid not null references public.entregas (id) on delete cascade,
  caminho text not null unique,
  nome text not null,
  tamanho bigint not null default 0,
  tipo text not null default ''
);
create index arquivos_entrega_idx on public.arquivos_entrega (entrega_id);

alter table public.entregas enable row level security;
alter table public.arquivos_entrega enable row level security;

-- Leitura: quem avalia vê tudo da empresa; quem entrega vê as do próprio grupo.
create policy "ver entregas" on public.entregas
  for select to authenticated
  using (public.pode_avaliar_org(org_id) or public.e_integrante(grupo_id));
create policy "ver arquivos" on public.arquivos_entrega
  for select to authenticated
  using (
    public.pode_avaliar_org(org_id)
    or exists (select 1 from public.entregas e where e.id = entrega_id and public.e_integrante(e.grupo_id))
  );
-- Gravação só pela função registrar_entrega (abaixo), que confere tudo.
-- Apagar: só quem gere a empresa.
create policy "gestores apagam entregas" on public.entregas
  for delete to authenticated using (public.pode_gerir_org(org_id));

-- ---------------------------------------------------------------------
-- Arquivos: área privada "entregas" no Storage
-- Caminho: <empresa>/<grupo>/<entrega>/<arquivo>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('entregas', 'entregas', false, 52428800) -- 50 MB por arquivo
on conflict (id) do nothing;

create function public.pode_mexer_na_pasta(caminho text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  partes text[] := string_to_array(caminho, '/');
  org uuid;
  grupo uuid;
begin
  if array_length(partes, 1) <> 4 then return false; end if;
  begin
    org := partes[1]::uuid;
    grupo := partes[2]::uuid;
    perform partes[3]::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  if not exists (select 1 from public.grupos g where g.id = grupo and g.org_id = org) then
    return false;
  end if;
  return public.pode_avaliar_org(org) or public.e_integrante(grupo);
end;
$$;

create policy "entregas: enviar arquivos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'entregas' and public.pode_mexer_na_pasta(name));
create policy "entregas: ler arquivos" on storage.objects
  for select to authenticated
  using (bucket_id = 'entregas' and public.pode_mexer_na_pasta(name));

-- ---------------------------------------------------------------------
-- Registrar a entrega (tudo de uma vez, conferindo permissões)
-- ---------------------------------------------------------------------
create function public.registrar_entrega(
  p_id uuid,
  p_etapa uuid,
  p_grupo uuid,
  p_comentario text,
  p_links text[],
  p_arquivos jsonb -- [{ "caminho", "nome", "tamanho", "tipo" }]
)
returns public.entregas
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid;
  ate date;
  pela_equipe boolean;
  nova public.entregas;
  a jsonb;
  prefixo text;
begin
  select e.org_id, e.recebe_ate into org, ate from public.etapas e where e.id = p_etapa;
  if org is null then
    raise exception 'Etapa não encontrada.';
  end if;
  if not exists (select 1 from public.grupos g where g.id = p_grupo and g.org_id = org) then
    raise exception 'Grupo não encontrado nesta empresa.';
  end if;
  if not exists (select 1 from public.organizacoes o where o.id = org and o.ativa) then
    raise exception 'Esta empresa está bloqueada.';
  end if;

  pela_equipe := public.e_integrante(p_grupo);
  if not (pela_equipe or public.pode_avaliar_org(org)) then
    raise exception 'Você não tem permissão para entregar por este grupo.';
  end if;

  if coalesce(jsonb_array_length(p_arquivos), 0) = 0
     and coalesce(cardinality(array_remove(p_links, '')), 0) = 0
     and coalesce(trim(p_comentario), '') = '' then
    raise exception 'A entrega está vazia: envie um arquivo, um link ou um comentário.';
  end if;

  -- A anterior deixa de valer.
  update public.entregas set status = 'substituida'
  where etapa_id = p_etapa and grupo_id = p_grupo and status = 'recebida';

  insert into public.entregas (id, org_id, etapa_id, grupo_id, enviada_por, enviada_por_email,
                               registrada_pela_equipe, atrasada, comentario, links)
  values (
    p_id, org, p_etapa, p_grupo, auth.uid(), public.meu_email(), pela_equipe,
    -- Atrasada se chegou depois do último dia de recebimento (horário de Brasília).
    ate is not null and (now() at time zone 'America/Sao_Paulo')::date > ate,
    coalesce(trim(p_comentario), ''),
    coalesce(array_remove(p_links, ''), '{}')
  )
  returning * into nova;

  prefixo := org::text || '/' || p_grupo::text || '/' || p_id::text || '/';
  for a in select * from jsonb_array_elements(coalesce(p_arquivos, '[]'::jsonb)) loop
    if left(a ->> 'caminho', length(prefixo)) <> prefixo then
      raise exception 'Arquivo fora da pasta desta entrega.';
    end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'entregas' and o.name = a ->> 'caminho') then
      raise exception 'Um dos arquivos não chegou a ser enviado. Tente de novo.';
    end if;
    insert into public.arquivos_entrega (org_id, entrega_id, caminho, nome, tamanho, tipo)
    values (org, p_id, a ->> 'caminho', coalesce(a ->> 'nome', ''), coalesce((a ->> 'tamanho')::bigint, 0),
            coalesce(a ->> 'tipo', ''));
  end loop;

  return nova;
end;
$$;

revoke execute on function public.registrar_entrega(uuid, uuid, uuid, text, text[], jsonb) from public, anon;
grant execute on function public.registrar_entrega(uuid, uuid, uuid, text, text[], jsonb) to authenticated;
