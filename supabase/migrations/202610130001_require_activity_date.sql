-- Preserve legacy undated activities until their hosts supply a real date.
-- Reject new undated activities and attempts to clear a scheduled date.
CREATE OR REPLACE FUNCTION public.require_activity_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.date_time IS NULL THEN
    RAISE EXCEPTION 'An activity requires a start date and time.'
      USING ERRCODE = '23502';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER require_activity_date
BEFORE INSERT OR UPDATE OF date_time ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.require_activity_date();
