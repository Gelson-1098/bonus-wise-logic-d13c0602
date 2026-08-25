CREATE OR REPLACE FUNCTION public.get_security_setting(_key text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'private', 'public'
AS $$
  SELECT value FROM private.security_settings WHERE key = _key;
$$;

REVOKE ALL ON FUNCTION public.get_security_setting(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_security_setting(text) FROM anon;
REVOKE ALL ON FUNCTION public.get_security_setting(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_security_setting(text) TO service_role;

CREATE OR REPLACE FUNCTION public.set_security_setting(_key text, _value text, _by uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'private', 'public'
AS $$
  INSERT INTO private.security_settings (key, value, updated_at, updated_by)
  VALUES (_key, _value, now(), _by)
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by;
$$;

REVOKE ALL ON FUNCTION public.set_security_setting(text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_security_setting(text, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.set_security_setting(text, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_security_setting(text, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_security_setting_meta(_key text)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'private', 'public'
AS $$
  SELECT updated_at FROM private.security_settings WHERE key = _key;
$$;

REVOKE ALL ON FUNCTION public.get_security_setting_meta(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_security_setting_meta(text) FROM anon;
REVOKE ALL ON FUNCTION public.get_security_setting_meta(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_security_setting_meta(text) TO service_role;