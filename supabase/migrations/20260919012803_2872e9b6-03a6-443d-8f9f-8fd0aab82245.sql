ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.must_change_password IS
'Indica que o usuário deve definir uma nova senha antes de acessar o sistema normalmente.';