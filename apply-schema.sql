-- ============================================================
-- Zertech — Full schema for project whonozmzgildsxrzsopp
-- Uses Better-Auth (NOT Supabase Auth) for user management.
-- Paste this ENTIRE file into Supabase SQL Editor and click Run.
-- ============================================================

-- ============================================================
-- BETTER-AUTH TABLES
-- ============================================================

-- better-auth user table
CREATE TABLE IF NOT EXISTS public."user" (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- better-auth session table
CREATE TABLE IF NOT EXISTS public."session" (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  token TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- better-auth account table
CREATE TABLE IF NOT EXISTS public."account" (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  password TEXT,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  refresh_token_expires_at TIMESTAMPTZ,
  scope TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- better-auth verification table
CREATE TABLE IF NOT EXISTS public."verification" (
  id TEXT NOT NULL PRIMARY KEY,
  value TEXT NOT NULL,
  identifier TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public."user", public."session", public."account", public."verification" TO service_role;
GRANT ALL ON public."user", public."session", public."account", public."verification" TO authenticated;

-- ============================================================
-- APP TABLES — All reference public."user"(id) (Better-Auth)
-- ============================================================

-- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT NOT NULL PRIMARY KEY REFERENCES public."user"(id) ON DELETE CASCADE,
  full_name TEXT,
  company TEXT,
  team_size TEXT,
  plan TEXT NOT NULL DEFAULT 'starter',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own profile" ON public.profiles;
-- Service role client can read all; for user-facing RLS we rely on the app layer
CREATE POLICY "own profile" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

-- workflow_settings
CREATE TABLE IF NOT EXISTS public.workflow_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  workflow TEXT NOT NULL CHECK (workflow IN ('invoice','lead')),
  auto_send BOOLEAN NOT NULL DEFAULT false,
  approval_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, workflow)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_settings TO authenticated;
GRANT ALL ON public.workflow_settings TO service_role;
ALTER TABLE public.workflow_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own workflow settings" ON public.workflow_settings;
CREATE POLICY "own workflow settings" ON public.workflow_settings FOR ALL USING (true) WITH CHECK (true);

-- invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','overdue','paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own invoices" ON public.invoices;
CREATE POLICY "own invoices" ON public.invoices FOR ALL USING (true) WITH CHECK (true);

-- leads (with score + notes columns)
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  source TEXT,
  notes TEXT,
  score INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','lost')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own leads" ON public.leads;
CREATE POLICY "own leads" ON public.leads FOR ALL USING (true) WITH CHECK (true);

-- drafts (includes scheduled_at + 'scheduled' status for Schedule-send)
CREATE TABLE IF NOT EXISTS public.drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('invoice','lead')),
  source_id UUID,
  recipient_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','sent','discarded','scheduled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drafts TO authenticated;
GRANT ALL ON public.drafts TO service_role;
ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own drafts" ON public.drafts;
CREATE POLICY "own drafts" ON public.drafts FOR ALL USING (true) WITH CHECK (true);

-- activity_log
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own activity" ON public.activity_log;
CREATE POLICY "own activity" ON public.activity_log FOR ALL USING (true) WITH CHECK (true);

-- integrations
CREATE TABLE IF NOT EXISTS public.integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('gmail','sheets','outlook','slack')),
  connected BOOLEAN NOT NULL DEFAULT false,
  token_data JSONB,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own integrations" ON public.integrations;
CREATE POLICY "own integrations" ON public.integrations FOR ALL USING (true) WITH CHECK (true);

-- email_templates
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('invoice','lead')),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own templates" ON public.email_templates;
CREATE POLICY "own templates" ON public.email_templates FOR ALL USING (true) WITH CHECK (true);

-- emails (raw synced Gmail messages; used by gmail-service detection)
CREATE TABLE IF NOT EXISTS public.emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  gmail_id TEXT NOT NULL,
  sender TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  body_snippet TEXT NOT NULL DEFAULT '',
  has_attachments BOOLEAN NOT NULL DEFAULT false,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_invoice BOOLEAN NOT NULL DEFAULT false,
  is_lead BOOLEAN NOT NULL DEFAULT false,
  score INT NOT NULL DEFAULT 0,
  UNIQUE (user_id, gmail_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emails TO authenticated;
GRANT ALL ON public.emails TO service_role;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own emails" ON public.emails;
CREATE POLICY "own emails" ON public.emails FOR ALL USING (true) WITH CHECK (true);

-- NOTE: No trigger needed. Better-Auth's events.createUser hook
-- (configured in src/lib/auth.ts) creates profile + workflow_settings
-- automatically when a new user signs up.
