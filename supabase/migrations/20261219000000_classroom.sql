-- =====================================================================
--  Handback · Google Classroom
--  Cada professor conecta a PRÓPRIA conta Google (serviço 'classroom') e
--  liga uma turma do Classroom a uma turma do Handback: os alunos, as
--  tarefas e as entregas vêm de lá. Os arquivos que estão no Drive dos
--  alunos só chegam quando o professor os escolhe na janela do Google
--  (permissão drive.file): até lá ficam em classroom_pendentes.
--  O Google só deixa lançar nota em tarefa criada pelo próprio Handback
--  (classroom_nosso); a devolutiva escrita vai por e-mail, como sempre.
-- =====================================================================

alter type public.origem_entrega add value if not exists 'classroom';

alter table public.conexoes_google drop constraint if exists conexoes_google_servico_check;
alter table public.conexoes_google add constraint conexoes_google_servico_check
  check (servico in ('agenda', 'drive', 'classroom'));

-- ---------------------------------------------------------------------
-- O que veio do Classroom
-- ---------------------------------------------------------------------
alter table public.turmas
  add column classroom_por uuid references auth.users (id) on delete set null,
  add column classroom_curso text check (classroom_curso ~ '^[0-9]{1,30}$'),
  add column classroom_curso_nome text not null default '' check (length(classroom_curso_nome) <= 300),
  add column classroom_buscado_em timestamptz,
  add column classroom_erro text not null default '';
create unique index turmas_classroom_unica on public.turmas (classroom_por, classroom_curso) where classroom_curso is not null;

alter table public.etapas
  add column classroom_tarefa text check (classroom_tarefa ~ '^[0-9]{1,30}$'),
  -- Criada pelo Handback no Classroom: só nessas o Google deixa lançar nota.
  add column classroom_nosso boolean not null default false,
  add column classroom_nota_max numeric,
  add column classroom_link text not null default '';
create unique index etapas_classroom_unica on public.etapas (turma_id, classroom_tarefa) where classroom_tarefa is not null;

-- Aluno do Classroom que virou um cadastro individual (não estava em nenhuma equipe).
alter table public.grupos add column classroom_aluno text check (classroom_aluno ~ '^[0-9]{1,30}$');
create unique index grupos_classroom_unico on public.grupos (turma_id, classroom_aluno) where classroom_aluno is not null;

-- Cada envio no Classroom (id + hora em que foi entregue) vira uma entrega só uma vez.
alter table public.entregas
  add column classroom_chave text,
  add column classroom_envio text;
create unique index entregas_classroom_unica on public.entregas (etapa_id, classroom_chave) where classroom_chave is not null;

alter table public.analises
  add column classroom_status text check (classroom_status in ('enviando', 'enviada', 'erro')),
  add column classroom_iniciado_em timestamptz,
  add column classroom_enviada_em timestamptz,
  add column classroom_nota numeric,
  add column classroom_erro text not null default '';

-- Arquivos do Drive dos alunos que esperam o professor escolher na janela do Google.
create table public.classroom_pendentes (
  entrega_id uuid not null references public.entregas (id) on delete cascade,
  drive_id text not null check (drive_id ~ '^[A-Za-z0-9_-]{1,200}$'),
  org_id uuid not null references public.organizacoes (id) on delete cascade,
  etapa_id uuid not null references public.etapas (id) on delete cascade,
  nome text not null default '' check (length(nome) <= 300),
  primary key (entrega_id, drive_id)
);
create index classroom_pendentes_etapa_idx on public.classroom_pendentes (etapa_id);
alter table public.classroom_pendentes enable row level security;
revoke all on public.classroom_pendentes from anon, authenticated;
grant select on public.classroom_pendentes to authenticated;
grant select, insert, update, delete on public.classroom_pendentes to service_role;
create policy "avaliadores veem os arquivos esperando" on public.classroom_pendentes
  for select to authenticated using (public.pode_avaliar_org(org_id));

-- ---------------------------------------------------------------------
-- Grava uma entrega buscada no Classroom (só o servidor chama)
-- ---------------------------------------------------------------------
create function public.gravar_entrega_classroom(
  p_id uuid, p_org uuid, p_etapa uuid, p_grupo uuid, p_remetente text, p_assunto text,
  p_enviada_em timestamptz, p_comentario text, p_links text[], p_pendentes jsonb, p_chave text, p_envio text
)
returns public.entregas
language plpgsql
security definer
set search_path = ''
as $$
declare
  nova public.entregas;
  a jsonb;
begin
  if exists (select 1 from public.entregas where etapa_id = p_etapa and classroom_chave = p_chave) then
    return null; -- já buscada antes
  end if;
  nova := public.gravar_entrega_interna(p_id, p_org, p_etapa, p_grupo, 'classroom'::public.origem_entrega, null,
    p_remetente, p_assunto, p_enviada_em, p_comentario, p_links, '[]'::jsonb, null);
  update public.entregas set classroom_chave = p_chave, classroom_envio = p_envio where id = p_id returning * into nova;
  for a in select * from jsonb_array_elements(coalesce(p_pendentes, '[]'::jsonb)) loop
    insert into public.classroom_pendentes (entrega_id, drive_id, org_id, etapa_id, nome)
    values (p_id, a ->> 'id', p_org, p_etapa, left(coalesce(a ->> 'nome', ''), 300))
    on conflict do nothing;
  end loop;
  perform public.registrar(p_org, 'entrega', 'chegou_classroom',
    'Chegou do Google Classroom a entrega de ' || public.nome_etapa_grupo(p_etapa, p_grupo), p_id);
  return nova;
end;
$$;

-- Um arquivo escolhido pelo professor chegou: entra na entrega e sai da espera.
create function public.guardar_arquivo_classroom(p_entrega uuid, p_drive text, p_caminho text, p_nome text, p_tamanho bigint, p_tipo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.classroom_pendentes;
begin
  select * into p from public.classroom_pendentes where entrega_id = p_entrega and drive_id = p_drive for update;
  if not found then raise exception 'Este arquivo não está esperando.'; end if;
  if public.org_da_pasta(p_caminho) is distinct from p.org_id then raise exception 'Arquivo fora da pasta desta empresa.'; end if;
  insert into public.arquivos_entrega (org_id, entrega_id, caminho, nome, tamanho, tipo)
  values (p.org_id, p_entrega, p_caminho, coalesce(p_nome, ''), coalesce(p_tamanho, 0), coalesce(p_tipo, ''))
  on conflict (entrega_id, caminho) do nothing;
  delete from public.classroom_pendentes where entrega_id = p_entrega and drive_id = p_drive;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.gravar_entrega_classroom(uuid, uuid, uuid, uuid, text, text, timestamptz, text, text[], jsonb, text, text)',
    'public.guardar_arquivo_classroom(uuid, text, text, text, bigint, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Lançar a nota no Classroom: reserva (não manda duas vezes) e resultado
-- ---------------------------------------------------------------------
create function public.reservar_envio_classroom(p_entrega uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.entregas;
  a public.analises;
  et public.etapas;
  t public.turmas;
  o public.organizacoes;
begin
  select * into e from public.entregas where id = p_entrega;
  if not found or not public.pode_avaliar_org(e.org_id) then raise exception 'Entrega não encontrada.'; end if;
  if e.status <> 'recebida' then raise exception 'Esta entrega foi substituída por um reenvio: devolva a mais recente.'; end if;
  select * into a from public.analises where entrega_id = p_entrega for update;
  if not found or a.status <> 'aprovada' then raise exception 'Aprove a devolutiva antes de devolver.'; end if;
  if a.classroom_status = 'enviando' and a.classroom_iniciado_em > now() - interval '5 minutes' then
    raise exception 'Esta nota já está indo para o Classroom. Aguarde um pouco.';
  end if;
  select * into et from public.etapas where id = e.etapa_id;
  select * into t from public.turmas where id = et.turma_id;
  select * into o from public.organizacoes where id = e.org_id;
  if not o.ativa then raise exception 'Esta empresa está bloqueada.'; end if;
  if et.classroom_tarefa is null then raise exception 'Este ciclo não está no Classroom.'; end if;
  if not et.classroom_nosso then
    raise exception 'O Google só deixa lançar nota em tarefa criada pelo Handback. Lance esta nota direto no Classroom.';
  end if;
  if t.classroom_curso is null or t.classroom_por is null then raise exception 'A turma não está mais ligada ao Classroom.'; end if;

  update public.analises set classroom_status = 'enviando', classroom_iniciado_em = now(), classroom_erro = ''
  where entrega_id = p_entrega;

  return jsonb_build_object(
    'por', t.classroom_por,
    'curso', t.classroom_curso,
    'tarefa', et.classroom_tarefa,
    'nota_max', et.classroom_nota_max,
    'envio', e.classroom_envio,
    'emails', coalesce((select jsonb_agg(i.email) from public.integrantes i where i.grupo_id = e.grupo_id), '[]'::jsonb),
    'conceito', a.conceito,
    'porcentagem', o.notas_moodle -> a.conceito
  );
end;
$$;

create function public.concluir_envio_classroom(p_entrega uuid, p_ok boolean, p_nota numeric, p_erro text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.analises;
  e public.entregas;
begin
  select * into a from public.analises where entrega_id = p_entrega for update;
  if not found or not public.pode_avaliar_org(a.org_id) then raise exception 'Análise não encontrada.'; end if;
  if a.classroom_status is distinct from 'enviando' then return; end if;
  if p_ok then
    update public.analises set classroom_status = 'enviada', classroom_enviada_em = now(), classroom_nota = p_nota, classroom_erro = ''
    where entrega_id = p_entrega;
    select * into e from public.entregas where id = p_entrega;
    perform public.registrar(a.org_id, 'avaliacao', 'devolveu_classroom',
      'Lançou no Classroom a nota de ' || public.nome_etapa_grupo(e.etapa_id, e.grupo_id)
      || case when p_nota is not null then ' (' || replace(to_char(p_nota, 'FM999990.0'), '.', ',') || ')' else '' end, p_entrega);
  else
    update public.analises set
      classroom_status = case when a.classroom_enviada_em is not null then 'enviada' else 'erro' end,
      classroom_erro = left(coalesce(p_erro, ''), 1000)
    where entrega_id = p_entrega;
  end if;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['public.reservar_envio_classroom(uuid)', 'public.concluir_envio_classroom(uuid, boolean, numeric, text)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Registro de atividades: conectar e desconectar o Classroom.
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
  if p_acao in ('criou_senha', 'ativou_duas_etapas', 'trocou_celular', 'saiu_de_todos', 'conectou_gmail', 'desconectou_gmail',
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
