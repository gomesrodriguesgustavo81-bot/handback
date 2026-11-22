-- =====================================================================
--  Handback · Registro de atividades
--  Quem fez o quê e quando: acessos, documentos abertos, avaliações,
--  pessoas e ajustes. Só se acrescenta: ninguém altera nem apaga (nem o
--  administrador). O administrador da empresa vê o da empresa; cada pessoa
--  vê os próprios acessos; o dono da plataforma vê tudo.
-- =====================================================================

create table public.atividades (
  id bigint generated always as identity primary key,
  org_id uuid references public.organizacoes (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  email text not null default '',
  tipo text not null check (tipo in ('acesso', 'seguranca', 'documento', 'avaliacao', 'entrega', 'pessoas', 'cadastros', 'ajustes')),
  acao text not null,
  descricao text not null default '',
  alvo_id uuid,
  ip text not null default '',
  aparelho text not null default '',
  criado_em timestamptz not null default now()
);
create index atividades_org_idx on public.atividades (org_id, criado_em desc);
create index atividades_user_idx on public.atividades (user_id, criado_em desc);

alter table public.atividades enable row level security;
create policy "quem pode ver o registro" on public.atividades
  for select to authenticated using (
    (org_id is not null and public.pode_gerir_org(org_id))
    or (org_id is null and public.e_admin_plataforma())
    or (user_id = auth.uid() and org_id is null and tipo in ('acesso', 'seguranca'))
  );
-- Só leitura pelo app; a gravação é feita pelas funções abaixo (e pelos gatilhos).
revoke all on public.atividades from anon, authenticated;
grant select on public.atividades to authenticated;
grant select, insert on public.atividades to service_role;

-- ---------------------------------------------------------------------
-- Gravação interna (usada pelos gatilhos). Quem fez = quem está logado.
-- ---------------------------------------------------------------------
create function public.registrar(p_org uuid, p_tipo text, p_acao text, p_descricao text, p_alvo uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Empresa sendo apagada: não há o que registrar dentro dela.
  if p_org is not null and not exists (select 1 from public.organizacoes o where o.id = p_org) then return; end if;
  insert into public.atividades (org_id, user_id, email, tipo, acao, descricao, alvo_id)
  values (
    p_org, auth.uid(),
    coalesce(auth.jwt() ->> 'email', (select u.email from auth.users u where u.id = auth.uid()), ''),
    p_tipo, p_acao, left(coalesce(p_descricao, ''), 500), p_alvo
  );
end;
$$;
revoke execute on function public.registrar(uuid, text, text, text, uuid) from public, anon, authenticated;

create function public.nome_do_papel(p public.papel)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p when 'admin' then 'Administrador' when 'avaliador' then 'Avaliador' else 'Participante' end;
$$;

-- ---------------------------------------------------------------------
-- Chamadas pelo app (com o IP e o aparelho da pessoa)
-- ---------------------------------------------------------------------

-- Acessos e segurança da própria conta: grava uma linha geral e uma em cada empresa da pessoa.
create function public.registrar_acesso(p_acao text, p_ip text, p_aparelho text)
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
  end;
  if descricao is null then raise exception 'Ação de acesso desconhecida.'; end if;
  if p_acao in ('criou_senha', 'ativou_duas_etapas', 'trocou_celular', 'saiu_de_todos', 'conectou_gmail', 'desconectou_gmail') then
    tipo := 'seguranca';
  end if;
  select u.email into meu_email from auth.users u where u.id = eu;
  insert into public.atividades (org_id, user_id, email, tipo, acao, descricao, ip, aparelho)
  select x.org_id, eu, coalesce(meu_email, ''), tipo, p_acao, descricao, left(coalesce(p_ip, ''), 64), left(coalesce(p_aparelho, ''), 120)
  from (select null::uuid as org_id union all select m.org_id from public.membros m where m.user_id = eu) x;
end;
$$;

-- Documentos e relatórios abertos (precisa enxergar a empresa).
create function public.registrar_documento(p_org uuid, p_acao text, p_descricao text, p_alvo uuid, p_ip text, p_aparelho text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.ve_org(p_org) then raise exception 'Empresa não encontrada.'; end if;
  if p_acao not in ('abriu_entrega', 'baixou_arquivo', 'abriu_relatorio') then raise exception 'Ação desconhecida.'; end if;
  insert into public.atividades (org_id, user_id, email, tipo, acao, descricao, alvo_id, ip, aparelho)
  values (
    p_org, auth.uid(), coalesce((select u.email from auth.users u where u.id = auth.uid()), ''),
    'documento', p_acao, left(coalesce(p_descricao, ''), 500), p_alvo,
    left(coalesce(p_ip, ''), 64), left(coalesce(p_aparelho, ''), 120)
  );
end;
$$;

-- Senha errada (chamada pelo servidor, com a chave secreta): avisa o dono e as empresas da pessoa.
create function public.registrar_falha_login(p_email text, p_ip text, p_aparelho text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  alvo uuid;
begin
  select u.id into alvo from auth.users u where lower(u.email) = lower(trim(p_email));
  insert into public.atividades (org_id, user_id, email, tipo, acao, descricao, ip, aparelho)
  select x.org_id, alvo, left(lower(trim(coalesce(p_email, ''))), 320), 'acesso', 'senha_errada',
         'Tentativa de entrar com senha errada', left(coalesce(p_ip, ''), 64), left(coalesce(p_aparelho, ''), 120)
  from (select null::uuid as org_id union all select m.org_id from public.membros m where alvo is not null and m.user_id = alvo) x;
end;
$$;

revoke execute on function public.registrar_acesso(text, text, text) from public, anon;
grant execute on function public.registrar_acesso(text, text, text) to authenticated;
revoke execute on function public.registrar_documento(uuid, text, text, uuid, text, text) from public, anon;
grant execute on function public.registrar_documento(uuid, text, text, uuid, text, text) to authenticated;
revoke execute on function public.registrar_falha_login(text, text, text) from public, anon, authenticated;
grant execute on function public.registrar_falha_login(text, text, text) to service_role;

-- ---------------------------------------------------------------------
-- Gatilhos: registram sozinhos o que muda nos dados
-- ---------------------------------------------------------------------
create function public.nome_etapa_grupo(p_etapa uuid, p_grupo uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select g.nome from public.grupos g where g.id = p_grupo), '?') || ' · ' ||
         coalesce((select (o.vocabulario ->> 'etapa') || ' ' || e.numero from public.etapas e join public.organizacoes o on o.id = e.org_id where e.id = p_etapa), '?');
$$;

create function public.reg_convites()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.registrar(new.org_id, 'pessoas', 'convidou', 'Convidou ' || new.email || ' como ' || public.nome_do_papel(new.papel), new.id);
  elsif tg_op = 'DELETE' and old.aceito_em is null then
    perform public.registrar(old.org_id, 'pessoas', 'cancelou_convite', 'Cancelou o convite de ' || old.email, old.id);
  end if;
  return null;
end;
$$;
create trigger reg_convites after insert or delete on public.convites for each row execute function public.reg_convites();

create function public.reg_membros()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  quem text;
begin
  select u.email into quem from auth.users u where u.id = coalesce(new.user_id, old.user_id);
  if tg_op = 'INSERT' then
    perform public.registrar(new.org_id, 'pessoas', 'entrou_na_empresa', coalesce(quem, '?') || ' entrou na empresa como ' || public.nome_do_papel(new.papel), new.user_id);
  elsif tg_op = 'UPDATE' and new.papel is distinct from old.papel then
    perform public.registrar(new.org_id, 'pessoas', 'mudou_papel',
      'Mudou o papel de ' || coalesce(quem, '?') || ' de ' || public.nome_do_papel(old.papel) || ' para ' || public.nome_do_papel(new.papel), new.user_id);
  elsif tg_op = 'DELETE' then
    perform public.registrar(old.org_id, 'pessoas', 'removeu', 'Removeu ' || coalesce(quem, '?') || ' da empresa', old.user_id);
  end if;
  return null;
end;
$$;
create trigger reg_membros after insert or update or delete on public.membros for each row execute function public.reg_membros();

create function public.reg_organizacoes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.exigir_duas_etapas is distinct from old.exigir_duas_etapas then
    perform public.registrar(new.id, 'seguranca', 'mudou_duas_etapas',
      case when new.exigir_duas_etapas then 'Tornou obrigatória a verificação em duas etapas' else 'Deixou opcional a verificação em duas etapas' end);
  end if;
  if new.ativa is distinct from old.ativa then
    perform public.registrar(new.id, 'ajustes', 'mudou_status', case when new.ativa then 'Empresa liberada' else 'Empresa bloqueada' end);
  end if;
  if (to_jsonb(new) - 'exigir_duas_etapas' - 'ativa' - 'atualizada_em') is distinct from (to_jsonb(old) - 'exigir_duas_etapas' - 'ativa' - 'atualizada_em') then
    perform public.registrar(new.id, 'ajustes', 'alterou_ajustes', 'Alterou os ajustes da empresa');
  end if;
  return null;
end;
$$;
create trigger reg_organizacoes after update on public.organizacoes for each row execute function public.reg_organizacoes();

create function public.reg_nova_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.registrar(new.id, 'ajustes', 'criou_empresa', 'Empresa criada no Handback');
  return null;
end;
$$;
create trigger reg_nova_org after insert on public.organizacoes for each row execute function public.reg_nova_org();

create function public.reg_cadastros()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  linha jsonb := to_jsonb(coalesce(new, old));
  o text := case tg_op when 'INSERT' then 'Cadastrou' when 'UPDATE' then 'Alterou' else 'Apagou' end;
  coisa text;
begin
  coisa := case tg_table_name
    when 'etapas' then (select o2.vocabulario ->> 'etapa' from public.organizacoes o2 where o2.id = (linha ->> 'org_id')::uuid) || ' ' || (linha ->> 'numero') || ' · ' || (linha ->> 'titulo')
    when 'grupos' then (linha ->> 'nome')
    when 'integrantes' then 'o e-mail ' || (linha ->> 'email') || ' em ' || coalesce((select g.nome from public.grupos g where g.id = (linha ->> 'grupo_id')::uuid), '?')
  end;
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'atualizada_em') = (to_jsonb(old) - 'atualizada_em') then return null; end if;
  perform public.registrar((linha ->> 'org_id')::uuid, 'cadastros', lower(o) || '_' || tg_table_name, o || ' ' || coalesce(coisa, '?'), (linha ->> 'id')::uuid);
  return null;
end;
$$;
create trigger reg_etapas after insert or update or delete on public.etapas for each row execute function public.reg_cadastros();
create trigger reg_grupos after insert or update or delete on public.grupos for each row execute function public.reg_cadastros();
create trigger reg_integrantes after insert or delete on public.integrantes for each row execute function public.reg_cadastros();

create function public.reg_entregas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.registrar(new.org_id, 'entrega',
    case when new.origem = 'manual' then 'registrou_entrega' else 'recebeu_entrega' end,
    case when new.origem = 'manual' then 'Registrou à mão a entrega de ' else 'Entrega recebida por e-mail de ' end
      || public.nome_etapa_grupo(new.etapa_id, new.grupo_id), new.id);
  return null;
end;
$$;
create trigger reg_entregas after insert on public.entregas for each row execute function public.reg_entregas();

create function public.reg_emails()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and new.status in ('importado', 'ignorado') then
    perform public.registrar(new.org_id, 'entrega',
      case new.status when 'importado' then 'confirmou_email' else 'ignorou_email' end,
      case new.status when 'importado' then 'Confirmou como entrega o e-mail “' else 'Ignorou o e-mail “' end
        || left(coalesce(nullif(new.assunto, ''), '(sem assunto)'), 120) || '” de ' || new.de_email, new.id);
  end if;
  return null;
end;
$$;
create trigger reg_emails after update on public.emails_recebidos for each row execute function public.reg_emails();

create function public.reg_analises()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.entregas;
  nome text;
begin
  select * into e from public.entregas where id = new.entrega_id;
  nome := public.nome_etapa_grupo(e.etapa_id, e.grupo_id);
  if new.status = 'analisando' and (tg_op = 'INSERT' or old.status is distinct from 'analisando') then
    perform public.registrar(new.org_id, 'avaliacao', 'pediu_analise', 'Pediu a análise da IA de ' || nome, new.entrega_id);
  elsif tg_op = 'UPDATE' and new.status = 'aprovada' and old.status is distinct from 'aprovada' then
    perform public.registrar(new.org_id, 'avaliacao', 'aprovou', 'Aprovou a devolutiva de ' || nome || ' (' || coalesce(new.conceito, '?') || ')', new.entrega_id);
  elsif tg_op = 'UPDATE' and old.status = 'aprovada' and new.status = 'pronta' then
    perform public.registrar(new.org_id, 'avaliacao', 'reabriu', 'Reabriu a devolutiva de ' || nome, new.entrega_id);
  elsif tg_op = 'UPDATE' and new.status = 'pronta' and old.status = 'pronta'
        and (new.devolutiva is distinct from old.devolutiva or new.conceito is distinct from old.conceito) then
    perform public.registrar(new.org_id, 'avaliacao', 'editou', 'Editou a devolutiva de ' || nome || ' (' || coalesce(new.conceito, '?') || ')', new.entrega_id);
  end if;
  if tg_op = 'UPDATE' and new.envio_status = 'enviada' and new.envio_id is distinct from old.envio_id and new.envio_id <> '' then
    perform public.registrar(new.org_id, 'avaliacao', 'enviou',
      'Enviou a devolutiva de ' || nome || ' para ' || array_to_string(new.enviada_para, ', '), new.entrega_id);
  end if;
  return null;
end;
$$;
create trigger reg_analises after insert or update on public.analises for each row execute function public.reg_analises();
