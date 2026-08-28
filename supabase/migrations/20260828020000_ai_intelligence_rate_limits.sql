-- Private accounting for the optional Task-4 assistant/embedding proxy. It
-- stores no prompt, source, output, or vector content and browser roles cannot
-- inspect or claim quota. The Edge Function calls it only after authenticating
-- the user and validating the explicit note scope.

create table public.ai_intelligence_rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count between 0 and 60),
  input_units bigint not null default 0 check (input_units between 0 and 2000000),
  updated_at timestamptz not null default now(),
  primary key (user_id, window_start)
);

alter table public.ai_intelligence_rate_limits enable row level security;

revoke all privileges on table public.ai_intelligence_rate_limits
from public, anon, authenticated;
grant select, insert, update, delete on table public.ai_intelligence_rate_limits
to service_role;

create or replace function public.claim_ai_intelligence_capacity(
  p_user_id uuid,
  p_input_units bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  claimed boolean := false;
  current_window timestamptz := date_trunc('hour', now());
begin
  if p_user_id is null or p_input_units is null or p_input_units < 1 or p_input_units > 100000 then
    return false;
  end if;

  delete from public.ai_intelligence_rate_limits
  where window_start < current_window - interval '48 hours';

  insert into public.ai_intelligence_rate_limits (
    user_id, window_start, request_count, input_units, updated_at
  ) values (
    p_user_id, current_window, 1, p_input_units, now()
  )
  on conflict (user_id, window_start) do update
  set request_count = public.ai_intelligence_rate_limits.request_count + 1,
      input_units = public.ai_intelligence_rate_limits.input_units + excluded.input_units,
      updated_at = now()
  where public.ai_intelligence_rate_limits.request_count < 60
    and public.ai_intelligence_rate_limits.input_units + excluded.input_units <= 2000000
  returning true into claimed;

  return coalesce(claimed, false);
end;
$function$;

revoke all on function public.claim_ai_intelligence_capacity(uuid, bigint)
from public, anon, authenticated;
grant execute on function public.claim_ai_intelligence_capacity(uuid, bigint)
to service_role;
