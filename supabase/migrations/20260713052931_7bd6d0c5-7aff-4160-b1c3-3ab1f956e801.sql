ALTER TABLE public.leads ADD COLUMN score integer NOT NULL DEFAULT 3 CHECK (score BETWEEN 1 AND 5);
ALTER TABLE public.leads ADD COLUMN notes text;
CREATE INDEX IF NOT EXISTS leads_score_idx ON public.leads (score DESC);