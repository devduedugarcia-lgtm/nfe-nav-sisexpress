ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS environment text;
CREATE INDEX IF NOT EXISTS invoices_user_source_env_idx ON public.invoices (user_id, source, environment);