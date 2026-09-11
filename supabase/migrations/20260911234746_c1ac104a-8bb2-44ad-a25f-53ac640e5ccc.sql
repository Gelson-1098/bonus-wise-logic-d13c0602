ALTER TABLE public.bonus_rule_versions
  ADD COLUMN IF NOT EXISTS month integer;

ALTER TABLE public.bonus_rule_versions
  DROP CONSTRAINT IF EXISTS bonus_rule_versions_month_check;

ALTER TABLE public.bonus_rule_versions
  ADD CONSTRAINT bonus_rule_versions_month_check
  CHECK (month IS NULL OR month BETWEEN 1 AND 12);

CREATE INDEX IF NOT EXISTS idx_bonus_rule_versions_store_status_year_month
  ON public.bonus_rule_versions (store_id, status, year, month);

CREATE OR REPLACE FUNCTION public.save_bonus_rule_draft(
  _version_id uuid,
  _version_patch jsonb,
  _criteria jsonb,
  _deleted_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _criterion jsonb;
  _criterion_id uuid;
BEGIN
  IF NOT private.is_master() THEN
    RAISE EXCEPTION 'Apenas o Master pode salvar regras de bonificação.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.bonus_rule_versions WHERE id = _version_id
  ) THEN
    RAISE EXCEPTION 'Versão de regras não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.bonus_rule_versions
  SET
    name = COALESCE(NULLIF(btrim(_version_patch->>'name'), ''), name),
    min_trigger_pct = COALESCE((_version_patch->>'min_trigger_pct')::numeric, min_trigger_pct),
    alert_pct = COALESCE((_version_patch->>'alert_pct')::numeric, alert_pct),
    target_pct = COALESCE((_version_patch->>'target_pct')::numeric, target_pct),
    status = COALESCE((_version_patch->>'status')::public.version_status, status),
    published_at = CASE
      WHEN (_version_patch->>'status')::public.version_status = 'publicada' AND status <> 'publicada' THEN now()
      ELSE published_at
    END,
    updated_at = now()
  WHERE id = _version_id;

  DELETE FROM public.bonus_criteria
  WHERE version_id = _version_id
    AND id = ANY(COALESCE(_deleted_ids, ARRAY[]::uuid[]));

  FOR _criterion IN SELECT value FROM jsonb_array_elements(COALESCE(_criteria, '[]'::jsonb))
  LOOP
    _criterion_id := (_criterion->>'id')::uuid;

    INSERT INTO public.bonus_criteria (
      id, version_id, position_id, code, name, category, description,
      metric_type, unit, comparator, target_value, target_text,
      weight_pct, value_brl, is_eliminatory, eliminatory_action,
      is_required, requires_justification, active, sort_order, notes
    ) VALUES (
      _criterion_id,
      _version_id,
      NULLIF(_criterion->>'position_id', '')::uuid,
      NULLIF(_criterion->>'code', ''),
      COALESCE(NULLIF(btrim(_criterion->>'name'), ''), 'Novo indicador'),
      NULLIF(_criterion->>'category', ''),
      NULLIF(_criterion->>'description', ''),
      COALESCE(NULLIF(_criterion->>'metric_type', ''), 'percentual'),
      NULLIF(_criterion->>'unit', ''),
      NULLIF(_criterion->>'comparator', ''),
      NULLIF(_criterion->>'target_value', '')::numeric,
      NULLIF(_criterion->>'target_text', ''),
      NULLIF(_criterion->>'weight_pct', '')::numeric,
      NULLIF(_criterion->>'value_brl', '')::numeric,
      COALESCE((_criterion->>'is_eliminatory')::boolean, false),
      NULLIF(_criterion->>'eliminatory_action', ''),
      COALESCE((_criterion->>'is_required')::boolean, true),
      COALESCE((_criterion->>'requires_justification')::boolean, false),
      COALESCE((_criterion->>'active')::boolean, true),
      COALESCE((_criterion->>'sort_order')::integer, 0),
      NULLIF(_criterion->>'notes', '')
    )
    ON CONFLICT (id) DO UPDATE SET
      position_id = EXCLUDED.position_id,
      code = EXCLUDED.code,
      name = EXCLUDED.name,
      category = EXCLUDED.category,
      description = EXCLUDED.description,
      metric_type = EXCLUDED.metric_type,
      unit = EXCLUDED.unit,
      comparator = EXCLUDED.comparator,
      target_value = EXCLUDED.target_value,
      target_text = EXCLUDED.target_text,
      weight_pct = EXCLUDED.weight_pct,
      value_brl = EXCLUDED.value_brl,
      is_eliminatory = EXCLUDED.is_eliminatory,
      eliminatory_action = EXCLUDED.eliminatory_action,
      is_required = EXCLUDED.is_required,
      requires_justification = EXCLUDED.requires_justification,
      active = EXCLUDED.active,
      sort_order = EXCLUDED.sort_order,
      notes = EXCLUDED.notes,
      updated_at = now()
    WHERE public.bonus_criteria.version_id = _version_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Critério não pertence à versão selecionada.' USING ERRCODE = '42501';
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.save_bonus_rule_draft(uuid, jsonb, jsonb, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_bonus_rule_draft(uuid, jsonb, jsonb, uuid[]) TO authenticated, service_role;