-- ============================================================
-- Zertech — Full schema for project whonozmzgildsxrzsopp
-- Paste this ENTIRE file into Supabase SQL Editor and click Run.
-- ============================================================

-- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
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
CREATE POLICY "own profile" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- workflow_settings
CREATE TABLE IF NOT EXISTS public.workflow_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
CREATE POLICY "own workflow settings" ON public.workflow_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
CREATE POLICY "own invoices" ON public.invoices FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- leads
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','lost')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own leads" ON public.leads;
CREATE POLICY "own leads" ON public.leads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- drafts (includes scheduled_at + 'scheduled' status for Schedule-send)
CREATE TABLE IF NOT EXISTS public.drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
CREATE POLICY "own drafts" ON public.drafts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- activity_log
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
CREATE POLICY "own activity" ON public.activity_log FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- integrations
CREATE TABLE IF NOT EXISTS public.integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
CREATE POLICY "own integrations" ON public.integrations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- email_templates
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
CREATE POLICY "own templates" ON public.email_templates FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- emails (raw synced Gmail messages; used by gmail-service detection)
CREATE TABLE IF NOT EXISTS public.emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
CREATE POLICY "own emails" ON public.emails FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- trigger: create profile + default workflow settings on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, company, team_size)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'company', ''),
    COALESCE(NEW.raw_user_meta_data->>'team_size', '')
  );
  INSERT INTO public.workflow_settings (user_id, workflow, approval_required, auto_send)
  VALUES (NEW.id, 'invoice', true, false), (NEW.id, 'lead', true, false);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
