-- Direct table privileges remain revoked. These policies are defense in depth
-- in case a future migration intentionally grants authenticated table access.
create policy user_profiles_select_self
on private.user_profiles
for select
to authenticated
using (user_id = (select auth.uid()));

create policy user_profiles_update_self
on private.user_profiles
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
