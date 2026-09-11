CREATE OR REPLACE FUNCTION public.clone_bonus_rule_month(
  _source_version_id uuid,
  _store_id uuid,
  _year integer,
  _month integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, private
AS $$
DECLARE
  _source public.bonus_rule_versions%ROWTYPE;
  _new_id uuid;
  _store_name text;
BEGIN
  IF NOT public.is_master() THEN
    RAISE EXCEPTION 'Apenas o Master pode criar versões de bonificação.' USING ERRCODE = '42501';
  END IF;
  IF _month NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'Mês inválido.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(COALESCE(_store_id::text, 'global') || ':' || _year::text || ':' || _month::text));

  IF EXISTS (
    SELECT 1 FROM public.bonus_rule_versions
    WHERE store_id IS NOT DISTINCT FROM _store_id
      AND year = _year
      AND month = _month
  ) THEN
    RAISE EXCEPTION 'Já existe uma versão mensal para esta loja e competência.' USING ERRCODE = '23505';
  END IF;

  SELECT * INTO _source
  FROM public.bonus_rule_versions
  WHERE id = _source_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Versão de origem não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF _store_id IS NOT NULL THEN
    SELECT name INTO _store_name FROM public.stores WHERE id = _store_id;
    IF _store_name IS NULL THEN
      RAISE EXCEPTION 'Loja não encontrada.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  INSERT INTO public.bonus_rule_versions (
    name, year, quarter, month, status, starts_on, ends_on,
    min_trigger_pct, alert_pct, target_pct, notes, created_by, store_id
  ) VALUES (
    CASE WHEN _store_id IS NULL
      THEN to_char(make_date(_year, _month, 1), 'TMMonth/YYYY') || ' · Global'
      ELSE to_char(make_date(_year, _month, 1), 'TMMonth/YYYY') || ' · ' || _store_name
    END,
    _year,
    ((_month - 1) / 3) + 1,
    _month,
    'rascunho',
    make_date(_year, _month, 1),
    (make_date(_year, _month, 1) + interval '1 month - 1 day')::date,
    _source.min_trigger_pct,
    _source.alert_pct,
    _source.target_pct,
    _source.notes,
    auth.uid(),
    _store_id
  ) RETURNING id INTO _new_id;

  INSERT INTO public.bonus_criteria (
    version_id, position_id, code, name, category, description,
    metric_type, unit, comparator, target_value, target_text,
    weight_pct, value_brl, is_eliminatory, eliminatory_action,
    is_required, requires_justification, active, sort_order, notes
  )
  SELECT
    _new_id, position_id, code, name, category, description,
    metric_type, unit, comparator, target_value, target_text,
    weight_pct, value_brl, is_eliminatory, eliminatory_action,
    is_required, requires_justification, active, sort_order, notes
  FROM public.bonus_criteria
  WHERE version_id = _source_version_id;

  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.clone_bonus_rule_month(uuid, uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clone_bonus_rule_month(uuid, uuid, integer, integer) TO authenticated, service_role;