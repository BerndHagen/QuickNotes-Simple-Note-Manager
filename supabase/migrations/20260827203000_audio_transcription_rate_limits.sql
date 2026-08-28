-- Server-side quota accounting for the optional Task 4 audio-file
-- transcription provider. The table contains no note or transcript content
-- and is inaccessible to browser roles. Only the authenticated Edge Function,
-- acting with the service role after validating the caller and source graph,
-- can claim capacity.

create table public.audio_transcription_rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count between 0 and 10),
  byte_count bigint not null default 0 check (byte_count between 0 and 157286400),
  updated_at timestamptz not null default now(),
  primary key (user_id, window_start)
);

alter table public.audio_transcription_rate_limits enable row level security;

revoke all privileges on table public.audio_transcription_rate_limits
from public, anon, authenticated;
grant select, insert, update, delete on table public.audio_transcription_rate_limits
to service_role;

create or replace function public.claim_audio_transcription_capacity(
  p_user_id uuid,
  p_byte_count bigint
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
  if p_user_id is null or p_byte_count is null or p_byte_count < 1 or p_byte_count > 25165824 then
    return false;
  end if;

  delete from public.audio_transcription_rate_limits
  where window_start < current_window - interval '48 hours';

  insert into public.audio_transcription_rate_limits (
    user_id,
    window_start,
    request_count,
    byte_count,
    updated_at
  ) values (
    p_user_id,
    current_window,
    1,
    p_byte_count,
    now()
  )
  on conflict (user_id, window_start) do update
  set request_count = public.audio_transcription_rate_limits.request_count + 1,
      byte_count = public.audio_transcription_rate_limits.byte_count + excluded.byte_count,
      updated_at = now()
  where public.audio_transcription_rate_limits.request_count < 10
    and public.audio_transcription_rate_limits.byte_count + excluded.byte_count <= 157286400
  returning true into claimed;

  return coalesce(claimed, false);
end;
$function$;

revoke all on function public.claim_audio_transcription_capacity(uuid, bigint)
from public, anon, authenticated;
grant execute on function public.claim_audio_transcription_capacity(uuid, bigint)
to service_role;
