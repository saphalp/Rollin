ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS place_id TEXT,
  ADD COLUMN IF NOT EXISTS formatted_address TEXT;
