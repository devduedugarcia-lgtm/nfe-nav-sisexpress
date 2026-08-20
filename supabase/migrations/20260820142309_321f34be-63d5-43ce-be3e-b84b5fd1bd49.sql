ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS pfx_ciphertext text,
  ADD COLUMN IF NOT EXISTS password_ciphertext text,
  ADD COLUMN IF NOT EXISTS subject_name text,
  ADD COLUMN IF NOT EXISTS holder_cnpj text,
  ADD COLUMN IF NOT EXISTS thumbprint text,
  ADD COLUMN IF NOT EXISTS valid_from date,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'valido';

REVOKE SELECT ON public.certificates FROM authenticated;
GRANT SELECT (id, user_id, file_name, valid_until, valid_from, uploaded_at, subject_name, holder_cnpj, thumbprint, status) ON public.certificates TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.certificates TO authenticated;
GRANT ALL ON public.certificates TO service_role;