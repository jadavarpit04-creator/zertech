-- Add scheduled_at column + 'scheduled' status to drafts for the Schedule-send feature
ALTER TABLE public.drafts
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

ALTER TABLE public.drafts
  DROP CONSTRAINT IF EXISTS drafts_status_check;

ALTER TABLE public.drafts
  ADD CONSTRAINT drafts_status_check
  CHECK (status IN ('pending','approved','sent','discarded','scheduled'));
