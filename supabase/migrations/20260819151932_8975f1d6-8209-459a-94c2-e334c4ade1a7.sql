CREATE TABLE public.sefaz_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cnpj text NOT NULL,
  uf text NOT NULL DEFAULT 'SP',
  environment text NOT NULL DEFAULT 'homologacao',
  ult_nsu bigint NOT NULL DEFAULT 0,
  last_sync_at timestamptz,
  last_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sefaz_accounts_cnpj_check CHECK (cnpj ~ '^[0-9]{14}$'),
  CONSTRAINT sefaz_accounts_uf_check CHECK (uf ~ '^[A-Z]{2}$'),
  CONSTRAINT sefaz_accounts_env_check CHECK (environment IN ('producao','homologacao'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sefaz_accounts TO authenticated;
GRANT ALL ON public.sefaz_accounts TO service_role;

ALTER TABLE public.sefaz_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY sefaz_accounts_select_own ON public.sefaz_accounts
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY sefaz_accounts_select_admin ON public.sefaz_accounts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY sefaz_accounts_insert_own ON public.sefaz_accounts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY sefaz_accounts_update_own ON public.sefaz_accounts
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY sefaz_accounts_delete_own ON public.sefaz_accounts
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER sefaz_accounts_set_updated_at
  BEFORE UPDATE ON public.sefaz_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.invoices
  ADD COLUMN source text NOT NULL DEFAULT 'demo',
  ADD COLUMN nsu bigint,
  ADD COLUMN schema_type text;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_source_check CHECK (source IN ('demo','sefaz'));

CREATE UNIQUE INDEX IF NOT EXISTS invoices_user_access_key_idx
  ON public.invoices (user_id, access_key);