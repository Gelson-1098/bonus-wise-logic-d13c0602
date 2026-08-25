CREATE TABLE public.revenue_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  receita_vendas numeric NOT NULL DEFAULT 0,
  taxa_servico numeric NOT NULL DEFAULT 0,
  faturamento_base_meta numeric GENERATED ALWAYS AS (receita_vendas + taxa_servico) STORED,
  tc numeric NOT NULL DEFAULT 0,
  source_file text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  imported_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, year, month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenue_history TO authenticated;
GRANT ALL ON public.revenue_history TO service_role;
ALTER TABLE public.revenue_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "revenue_history_select" ON public.revenue_history
  FOR SELECT TO authenticated USING (public.can_access_store(store_id));
CREATE POLICY "revenue_history_insert" ON public.revenue_history
  FOR INSERT TO authenticated WITH CHECK (public.is_master());
CREATE POLICY "revenue_history_update" ON public.revenue_history
  FOR UPDATE TO authenticated USING (public.is_master()) WITH CHECK (public.is_master());
CREATE POLICY "revenue_history_delete" ON public.revenue_history
  FOR DELETE TO authenticated USING (public.is_master());

CREATE TRIGGER t_revenue_history_updated BEFORE UPDATE ON public.revenue_history
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.store_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  base_year integer NOT NULL,
  faturamento_base_ano_anterior numeric NOT NULL DEFAULT 0,
  meta_faturamento numeric NOT NULL DEFAULT 0,
  tc_ano_anterior numeric NOT NULL DEFAULT 0,
  meta_tc numeric NOT NULL DEFAULT 0,
  growth_fat_pct numeric NOT NULL DEFAULT 10,
  growth_tc_pct numeric NOT NULL DEFAULT 10,
  version integer NOT NULL DEFAULT 1,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, year, month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_goals TO authenticated;
GRANT ALL ON public.store_goals TO service_role;
ALTER TABLE public.store_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store_goals_select" ON public.store_goals
  FOR SELECT TO authenticated USING (public.can_access_store(store_id));
CREATE POLICY "store_goals_insert" ON public.store_goals
  FOR INSERT TO authenticated WITH CHECK (public.is_master());
CREATE POLICY "store_goals_update" ON public.store_goals
  FOR UPDATE TO authenticated USING (public.is_master()) WITH CHECK (public.is_master());
CREATE POLICY "store_goals_delete" ON public.store_goals
  FOR DELETE TO authenticated USING (public.is_master());

CREATE TRIGGER t_store_goals_updated BEFORE UPDATE ON public.store_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_settings_select" ON public.app_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "app_settings_insert" ON public.app_settings
  FOR INSERT TO authenticated WITH CHECK (public.is_master());
CREATE POLICY "app_settings_update" ON public.app_settings
  FOR UPDATE TO authenticated USING (public.is_master()) WITH CHECK (public.is_master());

CREATE TRIGGER t_app_settings_updated BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_settings (key, value, description) VALUES
  ('goal_growth', '{"fat_pct": 10, "tc_pct": 10}'::jsonb, 'Percentual de crescimento aplicado sobre a base do ano anterior para gerar as metas de faturamento e TC');

ALTER TABLE public.store_targets ADD COLUMN IF NOT EXISTS manager_note text;