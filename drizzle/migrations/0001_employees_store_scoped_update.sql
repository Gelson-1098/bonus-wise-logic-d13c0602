DROP POLICY "employees update" ON public.employees;

CREATE POLICY "employees update"
  ON public.employees
  FOR UPDATE
  TO authenticated
  USING (public.can_access_store(store_id))
  WITH CHECK (public.can_access_store(store_id));