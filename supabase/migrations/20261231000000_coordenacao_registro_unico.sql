-- Registro da abertura do painel da coordenação: uma linha só, mesmo com pedidos ao mesmo tempo.
create or replace function public.dados_coordenacao(p_org uuid)
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
  -- O cadeado evita duas aberturas simultâneas (a tela pode pedir duas vezes ao mesmo tempo) gravarem duas linhas.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || p_org::text || ':coordenacao', 0));
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

revoke execute on function public.dados_coordenacao(uuid) from public, anon;
grant execute on function public.dados_coordenacao(uuid) to authenticated;
