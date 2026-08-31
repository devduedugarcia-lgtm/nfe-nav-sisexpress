-- Data API grants (nenhuma tabela pública possuía GRANT, causando "permission denied")
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sefaz_accounts TO authenticated;
GRANT ALL ON public.sefaz_accounts TO service_role;

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificates TO authenticated;
GRANT ALL ON public.certificates TO service_role;

-- Segredos do certificado permanecem inacessíveis ao app (só o servidor os manipula)
REVOKE SELECT (pfx_ciphertext, password_ciphertext) ON public.certificates FROM authenticated;
REVOKE UPDATE (pfx_ciphertext, password_ciphertext) ON public.certificates FROM authenticated;

-- Trigger de updated_at precisa ser executável pelo papel que dispara o UPDATE
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated;
