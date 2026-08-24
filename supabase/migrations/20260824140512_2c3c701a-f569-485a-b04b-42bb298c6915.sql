-- A tabela certificates foi criada sem GRANTs; sem eles o Data API nega acesso mesmo com RLS.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificates TO authenticated;
GRANT ALL ON public.certificates TO service_role;

-- Mantém os segredos (certificado e senha cifrados) fora do alcance de queries do app:
REVOKE SELECT (pfx_ciphertext, password_ciphertext) ON public.certificates FROM authenticated;
REVOKE UPDATE (pfx_ciphertext, password_ciphertext) ON public.certificates FROM authenticated;