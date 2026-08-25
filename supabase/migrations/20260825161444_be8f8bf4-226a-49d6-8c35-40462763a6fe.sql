DROP POLICY IF EXISTS "app_settings_select" ON public.app_settings;
CREATE POLICY "app_settings_select_public_keys" ON public.app_settings
  FOR SELECT TO authenticated
  USING (public.is_master() OR key IN ('goal_growth'));

DROP POLICY IF EXISTS "evals insert master" ON public.store_evaluations;
CREATE POLICY "evals insert master" ON public.store_evaluations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_master() AND public.can_access_store(store_id));

DROP POLICY IF EXISTS "evals update master" ON public.store_evaluations;
CREATE POLICY "evals update master" ON public.store_evaluations
  FOR UPDATE TO authenticated
  USING (public.is_master() AND public.can_access_store(store_id))
  WITH CHECK (public.is_master() AND public.can_access_store(store_id));