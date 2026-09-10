DROP VIEW IF EXISTS public.positions_public;

CREATE OR REPLACE FUNCTION public.list_positions_basic()
RETURNS TABLE (id uuid, name text, group_name text, active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.group_name, p.active
  FROM public.positions p
  WHERE auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid())
  ORDER BY p.name;
$$;

REVOKE ALL ON FUNCTION public.list_positions_basic() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_positions_basic() TO authenticated;