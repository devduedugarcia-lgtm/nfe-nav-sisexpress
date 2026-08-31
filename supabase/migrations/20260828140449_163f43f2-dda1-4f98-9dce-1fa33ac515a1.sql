ALTER TABLE public.sefaz_accounts
  ADD COLUMN IF NOT EXISTS nfce_last_sync_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS nfce_last_status text,
  ADD COLUMN IF NOT EXISTS nfce_blocked_until timestamp with time zone;