CREATE TABLE IF NOT EXISTS private.user_temp_passwords (
  user_id uuid PRIMARY KEY,
  temp_password text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_by uuid
);

REVOKE ALL ON TABLE private.user_temp_passwords FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE private.user_temp_passwords TO service_role;
ALTER TABLE private.user_temp_passwords ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_user_temp_password(
  _user_id uuid,
  _password text,
  _by uuid
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = private, public
AS $$
  INSERT INTO private.user_temp_passwords (user_id, temp_password, created_at, expires_at, created_by)
  VALUES (_user_id, _password, now(), now() + interval '7 days', _by)
  ON CONFLICT (user_id) DO UPDATE
  SET temp_password = EXCLUDED.temp_password,
      created_at = now(),
      expires_at = now() + interval '7 days',
      created_by = EXCLUDED.created_by;
$$;

CREATE OR REPLACE FUNCTION public.get_user_temp_password(_user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = private, public
AS $$
  SELECT temp_password
  FROM private.user_temp_passwords
  WHERE user_id = _user_id
    AND expires_at > now();
$$;

CREATE OR REPLACE FUNCTION public.clear_user_temp_password(_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = private, public
AS $$
  DELETE FROM private.user_temp_passwords WHERE user_id = _user_id;
$$;

REVOKE ALL ON FUNCTION public.set_user_temp_password(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_user_temp_password(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_user_temp_password(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_temp_password(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_temp_password(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_user_temp_password(uuid) TO service_role;