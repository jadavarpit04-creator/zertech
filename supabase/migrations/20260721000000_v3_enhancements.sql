-- ============================================================
-- Migration: v3 Enhancements
-- Description: Adds missing columns, indexes, and inboxes table
-- ============================================================

-- 1. leads table: score, notes, detected_at
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS score INT NOT NULL DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS detected_at TIMESTAMPTZ;

-- 2. invoices table: invoice_number, days_overdue, detected_at, meta
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS days_overdue INT NOT NULL DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS detected_at TIMESTAMPTZ;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3. drafts table: tone, updated_at
ALTER TABLE public.drafts ADD COLUMN IF NOT EXISTS tone TEXT DEFAULT 'professional';
ALTER TABLE public.drafts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- 4. profiles table: last_login
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS leads_score_idx ON public.leads(score DESC);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON public.invoices(status);
CREATE INDEX IF NOT EXISTS drafts_status_idx ON public.drafts(status);

-- 6. inboxes table for future multi-inbox support
CREATE TABLE IF NOT EXISTS public.inboxes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('gmail','outlook')),
  email_address TEXT,
  access_token TEXT,
  refresh_token TEXT,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  last_synced TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inboxes TO authenticated;
GRANT ALL ON public.inboxes TO service_role;

ALTER TABLE public.inboxes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own inboxes" ON public.inboxes;
CREATE POLICY "own inboxes"
  ON public.inboxes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
