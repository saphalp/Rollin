
BEGIN;

-- Delete conversation pins when the user who pinned them
-- permanently deletes their account.
ALTER TABLE public.conversation_pins
DROP CONSTRAINT IF EXISTS conversation_pins_pinned_by_fkey;

ALTER TABLE public.conversation_pins
ADD CONSTRAINT conversation_pins_pinned_by_fkey
FOREIGN KEY (pinned_by)
REFERENCES auth.users(id)
ON DELETE CASCADE;


-- Preserve university event sources when their associated
-- campus calendar submission is deleted.
ALTER TABLE public.university_event_sources
DROP CONSTRAINT IF EXISTS university_event_sources_submission_id_fkey;

ALTER TABLE public.university_event_sources
ADD CONSTRAINT university_event_sources_submission_id_fkey
FOREIGN KEY (submission_id)
REFERENCES public.campus_calendar_submissions(id)
ON DELETE SET NULL;

COMMIT;
