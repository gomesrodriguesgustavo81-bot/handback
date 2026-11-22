-- =====================================================================
--  Handback · Ligação com o Moodle que não se perde
--  - A turma guarda o endereço do Moodle: ao ligar de novo (depois de
--    desligar), ela volta a ficar ligada sozinha.
--  - A conexão guarda o motivo de ter sido cortada, para mostrar na tela.
-- =====================================================================

alter table public.contas_moodle
  add column erro text not null default '' check (length(erro) <= 500),
  add column erro_em timestamptz;
grant select (erro, erro_em) on public.contas_moodle to authenticated;

alter table public.turmas add column moodle_site text;
update public.turmas t set moodle_site = c.site from public.contas_moodle c where c.id = t.moodle_conta;

create or replace function public.salvar_conta_moodle(p_org uuid, p_site text, p_site_nome text, p_usuario bigint, p_nome text, p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  novo uuid;
begin
  if auth.uid() is null or not public.pode_gerir_org(p_org) then
    raise exception 'Só quem administra a conta pode ligar o Moodle.';
  end if;
  insert into public.contas_moodle (org_id, user_id, site, site_nome, moodle_usuario, nome, token_cifrado)
  values (p_org, auth.uid(), p_site, left(coalesce(p_site_nome, ''), 300), p_usuario, left(coalesce(p_nome, ''), 300), p_token)
  on conflict (org_id, user_id, site) do update
    set site_nome = excluded.site_nome, moodle_usuario = excluded.moodle_usuario, nome = excluded.nome,
        token_cifrado = excluded.token_cifrado, invalida = false, erro = '', erro_em = null, conectada_em = now()
  returning id into novo;

  -- Turmas desse Moodle que ficaram sem ligação voltam a usar esta.
  update public.turmas t set moodle_conta = novo, moodle_erro = ''
  where t.org_id = p_org and t.moodle_conta is null and t.moodle_site = p_site and t.moodle_curso is not null
    and not exists (select 1 from public.turmas x where x.moodle_conta = novo and x.moodle_curso = t.moodle_curso);

  perform public.registrar(p_org, 'seguranca', 'conectou_moodle', 'Ligou o Moodle ' || p_site || ' (como ' || coalesce(nullif(p_nome, ''), '?') || ')', novo);
  return novo;
end;
$$;
