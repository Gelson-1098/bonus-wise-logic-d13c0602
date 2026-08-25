ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'treinador';

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS private.security_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

REVOKE ALL ON private.security_settings FROM PUBLIC;
REVOKE ALL ON private.security_settings FROM anon;
REVOKE ALL ON private.security_settings FROM authenticated;
GRANT ALL ON private.security_settings TO service_role;

ALTER TABLE private.security_settings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE user_count INT;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  SELECT count(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'master')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END; $function$;