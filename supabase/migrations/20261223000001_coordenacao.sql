-- =====================================================================
--  Handback · Coordenador e banca
--  Quem acompanha a escola ou o programa sem corrigir nada. Vê só
--  números e conceitos já aprovados, nunca a correção em si: devolutiva,
--  arquivos dos alunos, análise da IA, alertas, e-mails e contas.
--
--  A trava está AQUI, no banco, não só na tela:
--   • o papel "coordenador" não entra em pode_avaliar_org (por isso não
--     lê entregas, análises, grupos, integrantes nem arquivos);
--   • ve_org passa a deixar o coordenador de fora (por isso ele não lê
--     as turmas, que têm o endereço de recebimento, nem as etapas);
--   • o que ele vê vem de UMA função que devolve só números e conceito.
--  "Banca" é um coordenador limitado às turmas escolhidas.
-- =====================================================================

-- Quem não é coordenador continua igual; o coordenador não lê as tabelas direto.
create or replace function public.ve_org(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.dono_com_acesso(org) or coalesce(public.papel_na_org(org) in ('admin', 'avaliador', 'participante'), false);
$$;

create or replace function public.nome_do_papel(p public.papel)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p when 'admin' then 'Administrador' when 'avaliador' then 'Avaliador' when 'coordenador' then 'Coordenador' else 'Participante' end;
$$;

-- ---------------------------------------------------------------------
-- Escopo de cada coordenador
-- ---------------------------------------------------------------------
create table public.coordenacao (
  org_id uuid not null,
  user_id uuid not null,
  tipo text not null check (tipo in ('coordenador', 'banca')),
  -- Desligado por padrão: sem nomes, só os números da turma.
  mostrar_nomes boolean not null default false,
  criada_em timestamptz not null default now(),
  primary key (org_id, user_id),
  foreign key (org_id, user_id) references public.membros (org_id, user_id) on delete cascade
);

create table public.coordenacao_turmas (
  org_id uuid not null,
  user_id uuid not null,
  turma_id uuid not null references public.turmas (id) on delete cascade,
  primary key (org_id, user_id, turma_id),
  foreign key (org_id, user_id) references public.coordenacao (org_id, user_id) on delete cascade
);

alter table public.coordenacao enable row level security;
alter table public.coordenacao_turmas enable row level security;
revoke all on public.coordenacao, public.coordenacao_turmas from anon, authenticated;
grant select on public.coordenacao, public.coordenacao_turmas to authenticated;
grant select, insert, update, delete on public.coordenacao, public.coordenacao_turmas to service_role;
-- Só quem gere a empresa e a própria pessoa leem. Ninguém grava direto: só pelo aceite do convite.
create policy "gestor e o proprio veem a coordenacao" on public.coordenacao
  for select to authenticated using (public.pode_gerir_org(org_id) or user_id = auth.uid());
create policy "gestor e o proprio veem as turmas da coordenacao" on public.coordenacao_turmas
  for select to authenticated using (public.pode_gerir_org(org_id) or user_id = auth.uid());

-- Quem deixa de ser coordenador perde o escopo (e quem vira coordenador sem escopo não vê nada).
create function public.limpa_coordenacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.papel = 'coordenador' and new.papel <> 'coordenador' then
    delete from public.coordenacao where org_id = old.org_id and user_id = old.user_id;
  end if;
  return new;
end;
$$;
create trigger membros_limpa_coordenacao after update of papel on public.membros
  for each row execute function public.limpa_coordenacao();

-- ---------------------------------------------------------------------
-- Convites: levam o escopo junto
-- ---------------------------------------------------------------------
alter table public.convites
  add column coord_tipo text check (coord_tipo in ('coordenador', 'banca')),
  add column coord_nomes boolean not null default false,
  add column coord_turmas uuid[] not null default '{}' check (cardinality(coord_turmas) <= 100);
alter table public.convites add constraint convites_coordenacao_coerente check (
  ((papel = 'coordenador') = (coord_tipo is not null))
  and (papel = 'coordenador' or (coord_nomes = false and cardinality(coord_turmas) = 0))
  and (coord_tipo is distinct from 'coordenador' or cardinality(coord_turmas) = 0)
  and (coord_tipo is distinct from 'banca' or cardinality(coord_turmas) >= 1)
);

-- As turmas do convite têm que ser desta empresa.
create function public.confere_convite_coordenacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.papel = 'coordenador' and exists (
    select 1 from unnest(new.coord_turmas) t
    where not exists (select 1 from public.turmas x where x.id = t and x.org_id = new.org_id)
  ) then
    raise exception 'Escolha só turmas desta empresa.';
  end if;
  return new;
end;
$$;
create trigger convites_confere_coordenacao before insert or update on public.convites
  for each row execute function public.confere_convite_coordenacao();

create or replace function public.aceitar_convites()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  meu_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  total integer := 0;
  c record;
begin
  if auth.uid() is null or meu_email = '' then
    return 0;
  end if;

  for c in
    select * from public.convites
    where email = meu_email and aceito_em is null
    for update
  loop
    insert into public.membros (org_id, user_id, papel)
    values (c.org_id, auth.uid(), c.papel)
    on conflict (org_id, user_id) do nothing;

    -- Convite de coordenador: guarda o escopo (só se a pessoa realmente entrou como coordenadora).
    if c.papel = 'coordenador' and exists (
      select 1 from public.membros m where m.org_id = c.org_id and m.user_id = auth.uid() and m.papel = 'coordenador'
    ) then
      insert into public.coordenacao (org_id, user_id, tipo, mostrar_nomes)
      values (c.org_id, auth.uid(), c.coord_tipo, c.coord_nomes)
      on conflict (org_id, user_id) do nothing;
      insert into public.coordenacao_turmas (org_id, user_id, turma_id)
      select c.org_id, auth.uid(), t.id from public.turmas t
      where t.id = any (c.coord_turmas) and t.org_id = c.org_id
      on conflict do nothing;
    end if;

    update public.convites set aceito_em = now() where id = c.id;
    total := total + 1;
  end loop;

  return total;
end;
$$;

-- ---------------------------------------------------------------------
-- O que a coordenação enxerga
-- ---------------------------------------------------------------------
-- Turmas que a pessoa pode acompanhar: quem avalia vê todas; o coordenador, as dele (todas, se for
-- "coordenador"; só as escolhidas, se for "banca"). Sem duas etapas (quando a empresa exige), nenhuma.
create function public.coord_turmas_visiveis(org uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.id from public.turmas t
  where t.org_id = org and not t.arquivada
    and (
      public.pode_avaliar_org(org)
      or exists (
        select 1 from public.coordenacao c
        where c.org_id = org and c.user_id = auth.uid()
          and public.papel_na_org(org) = 'coordenador'
          and (c.tipo = 'coordenador'
               or exists (select 1 from public.coordenacao_turmas ct where ct.org_id = org and ct.user_id = c.user_id and ct.turma_id = t.id))
      )
    );
$$;

create function public.coord_mostra_nomes(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.pode_avaliar_org(org)
      or coalesce((select c.mostrar_nomes from public.coordenacao c
                   where c.org_id = org and c.user_id = auth.uid() and public.papel_na_org(org) = 'coordenador'), false);
$$;

-- Uma linha por (aluno ou equipe × etapa), só com o que a coordenação pode saber:
-- se entregou, se atrasou e o conceito JÁ APROVADO. Sem nomes quando a pessoa não pode vê-los
-- (aí vem só um número). Nunca devolve devolutiva, arquivo, análise da IA, alerta ou e-mail.
create function public.dados_coordenacao(p_org uuid)
returns table (
  turma_id uuid, turma_nome text, turma_modo text,
  etapa_id uuid, etapa_numero integer, etapa_titulo text, recebe_ate date,
  grupo_n integer, grupo_nome text,
  entregou boolean, atrasada boolean, conceito text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then return; end if;
  -- Cada abertura do painel pela coordenação fica no registro (no máximo uma a cada 10 minutos).
  if public.papel_na_org(p_org) = 'coordenador' and not exists (
    select 1 from public.atividades a
    where a.org_id = p_org and a.user_id = auth.uid() and a.acao = 'abriu_coordenacao' and a.criado_em > now() - interval '10 minutes'
  ) then
    insert into public.atividades (org_id, user_id, email, tipo, acao, descricao)
    values (p_org, auth.uid(), coalesce((select u.email from auth.users u where u.id = auth.uid()), ''), 'documento', 'abriu_coordenacao', 'Abriu o painel da coordenação');
  end if;
  return query
  select t.id, t.nome, t.modo,
         et.id, et.numero, et.titulo, et.recebe_ate,
         (dense_rank() over (partition by t.id order by g.id))::integer,
         case when public.coord_mostra_nomes(p_org) then g.nome end,
         e.id is not null,
         coalesce(e.atrasada, false),
         case when a.status = 'aprovada' and a.conceito in ('EXCELENTE', 'BOM', 'REGULAR', 'RUIM') then a.conceito end
  from public.turmas t
  join public.etapas et on et.turma_id = t.id and et.org_id = p_org
  join public.grupos g on g.turma_id = t.id and g.org_id = p_org and g.ativo and not g.escondido
  left join public.entregas e on e.etapa_id = et.id and e.grupo_id = g.id and e.status = 'recebida'
  left join public.analises a on a.entrega_id = e.id
  where t.org_id = p_org
    and t.id in (select public.coord_turmas_visiveis(p_org))
  order by t.nome, et.numero, 8
  limit 20000;
end;
$$;

revoke execute on function public.coord_turmas_visiveis(uuid), public.coord_mostra_nomes(uuid), public.dados_coordenacao(uuid) from public, anon;
grant execute on function public.coord_turmas_visiveis(uuid), public.coord_mostra_nomes(uuid), public.dados_coordenacao(uuid) to authenticated;
