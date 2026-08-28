-- RLS does not apply to TRUNCATE. These privileges were inherited from the
-- original broad table grants and would let any authenticated browser erase
-- every user's saved views or templates. Browser roles need ordinary DML only;
-- REFERENCES and TRIGGER are also unnecessary at runtime.

revoke truncate, references, trigger
on table public.saved_views, public.note_templates
from authenticated, anon;
