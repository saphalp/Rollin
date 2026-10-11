-- Add status column to activities
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'expired'));

-- Immediately expire any activities whose date_time has already passed
UPDATE public.activities
SET status = 'expired'
WHERE date_time IS NOT NULL
  AND date_time < NOW()
  AND status = 'active';

-- Schedule a daily job via pg_cron to auto-expire past activities
SELECT cron.schedule(
  'expire-past-activities',
  '0 0 * * *',
  $$
    UPDATE public.activities
    SET status = 'expired'
    WHERE date_time IS NOT NULL
      AND date_time < NOW()
      AND status = 'active';
  $$
);
