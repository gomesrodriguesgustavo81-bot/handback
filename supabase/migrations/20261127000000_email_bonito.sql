-- =====================================================================
--  Handback · E-mail da devolutiva com a cara do Handback
--  A reserva do envio passa a devolver também o nome da empresa e o
--  checklist (só o item e a situação, sem os comentários da IA).
-- =====================================================================

create or replace function public.reservar_envio(p_entrega uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.entregas;
  a public.analises;
  o public.organizacoes;
  m public.emails_recebidos;
  d record;
begin
  select * into e from public.entregas where id = p_entrega;
  if not found or not public.pode_avaliar_org(e.org_id) then raise exception 'Entrega não encontrada.'; end if;
  if e.status <> 'recebida' then raise exception 'Esta entrega foi substituída por um reenvio: envie a devolutiva da mais recente.'; end if;
  select * into a from public.analises where entrega_id = p_entrega for update;
  if not found or a.status <> 'aprovada' then raise exception 'Aprove a devolutiva antes de enviar.'; end if;
  if coalesce(trim(a.devolutiva), '') = '' then raise exception 'A devolutiva está vazia.'; end if;
  if a.envio_status = 'enviando' and a.envio_iniciado_em > now() - interval '5 minutes' then
    raise exception 'Esta devolutiva já está sendo enviada. Aguarde um pouco.';
  end if;
  select * into d from public.destinatarios_da_entrega(p_entrega);
  if cardinality(d.para) = 0 then
    raise exception 'Ninguém para receber: cadastre os e-mails dos integrantes.';
  end if;
  select * into o from public.organizacoes where id = e.org_id;
  if not o.ativa then raise exception 'Esta empresa está bloqueada.'; end if;
  if e.email_id is not null then select * into m from public.emails_recebidos where id = e.email_id; end if;

  update public.analises
  set envio_status = 'enviando', envio_iniciado_em = now(), envio_erro = '', atualizada_em = now()
  where entrega_id = p_entrega;

  return jsonb_build_object(
    'para', to_jsonb(d.para),
    'copia', to_jsonb(d.copia),
    'assunto', e.assunto,
    'origem', e.origem,
    'message_id', coalesce(m.message_id, ''),
    'referencias', to_jsonb(coalesce(m.responde_a, '{}'::text[])),
    'devolutiva', a.devolutiva,
    'conceito', a.conceito,
    'enviar_conceito', o.enviar_conceito,
    'grupo', (select nome from public.grupos where id = e.grupo_id),
    'empresa', o.nome,
    'checklist', coalesce((select jsonb_agg(jsonb_build_object('item', x.c ->> 'item', 'status', x.c ->> 'status') order by x.n)
                           from jsonb_array_elements(a.checklist) with ordinality as x(c, n)), '[]'::jsonb),
    'etapa', (select (o.vocabulario ->> 'etapa') || ' ' || numero || ' · ' || titulo from public.etapas where id = e.etapa_id)
  );
end;
$$;
