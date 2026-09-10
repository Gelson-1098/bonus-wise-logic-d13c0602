-- Restringe leitura de dados confidenciais (valores base de cargos e formulas de bonus) ao Master
DROP POLICY IF EXISTS "positions read" ON public.positions;
CREATE POLICY "positions master read" ON public.positions
  FOR SELECT TO authenticated USING (public.is_master());

DROP POLICY IF EXISTS "criteria read" ON public.bonus_criteria;
CREATE POLICY "criteria master read" ON public.bonus_criteria
  FOR SELECT TO authenticated USING (public.is_master());

DROP POLICY IF EXISTS "versions read" ON public.bonus_rule_versions;
CREATE POLICY "versions master read" ON public.bonus_rule_versions
  FOR SELECT TO authenticated USING (public.is_master());

-- Visao sem dados salariais, para telas de cadastro/lancamento de qualquer usuario autorizado
CREATE OR REPLACE VIEW public.positions_public
WITH (security_invoker = false) AS
SELECT id, name, group_name, active FROM public.positions;

REVOKE ALL ON public.positions_public FROM anon;
GRANT SELECT ON public.positions_public TO authenticated;
GRANT SELECT ON public.positions_public TO service_role;