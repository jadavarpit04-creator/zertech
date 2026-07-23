-- Zertech v3.0: Clerk Migration - Fix user_id columns
-- Run this in Supabase SQL Editor

-- 1. Drop foreign key constraints referencing auth.users(id)
ALTER TABLE IF EXISTS public.profiles       DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE IF EXISTS public.integrations   DROP CONSTRAINT IF EXISTS integrations_user_id_fkey;
ALTER TABLE IF EXISTS public.workflow_settings DROP CONSTRAINT IF EXISTS workflow_settings_user_id_fkey;
ALTER TABLE IF EXISTS public.invoices       DROP CONSTRAINT IF EXISTS invoices_user_id_fkey;
ALTER TABLE IF EXISTS public.leads          DROP CONSTRAINT IF EXISTS leads_user_id_fkey;
ALTER TABLE IF EXISTS public.drafts         DROP CONSTRAINT IF EXISTS drafts_user_id_fkey;
ALTER TABLE IF EXISTS public.activity_log   DROP CONSTRAINT IF EXISTS activity_log_user_id_fkey;

-- 2. Change columns from UUID to TEXT
-- profiles.id IS the user_id (no separate user_id column here)
ALTER TABLE public.profiles              ALTER COLUMN id TYPE TEXT;
-- Other tables have a user_id column
ALTER TABLE public.workflow_settings     ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE public.integrations          ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE public.invoices              ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE public.leads                 ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE public.drafts                ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE public.activity_log          ALTER COLUMN user_id TYPE TEXT;

-- 3. Recreate indexes for performance
DROP INDEX IF EXISTS idx_invoices_user_id;
DROP INDEX IF EXISTS idx_leads_user_id;
DROP INDEX IF EXISTS idx_drafts_user_id;
DROP INDEX IF EXISTS idx_activity_log_user_id;
DROP INDEX IF EXISTS idx_integrations_user_id;

CREATE INDEX idx_invoices_user_id       ON public.invoices(user_id);
CREATE INDEX idx_leads_user_id          ON public.leads(user_id);
CREATE INDEX idx_drafts_user_id         ON public.drafts(user_id);
CREATE INDEX idx_activity_log_user_id   ON public.activity_log(user_id);
CREATE INDEX idx_integrations_user_id   ON public.integrations(user_id);
