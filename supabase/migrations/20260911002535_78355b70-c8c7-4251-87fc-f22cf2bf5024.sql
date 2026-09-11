ALTER TABLE public.bonus_rule_versions
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_bonus_rule_versions_store_status
  ON public.bonus_rule_versions (store_id, status, year, quarter);