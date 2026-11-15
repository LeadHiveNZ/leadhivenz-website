-- =============================================================================
-- HostFix: make the "too many tries" limit exact
-- -----------------------------------------------------------------------------
-- Applied automatically when the site is deployed. You never paste this
-- anywhere. It is safe to run twice.
--
-- The limit used to count in fixed blocks on the clock (for a ten-minute limit:
-- :00 to :10, :10 to :20, and so on). Someone whose tries straddled the end of
-- a block got a fresh allowance, so "6 every ten minutes" could let through 12.
-- That mattered most for guesses at the admin password and sign-in codes.
--
-- Now the window starts at a visitor's first try and lasts the full time, so
-- the limit is what it says.
-- =============================================================================

create or replace function public.rate_limit_hit(
  p_key text,
  p_window_seconds integer,
  p_max_hits integer
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_now  timestamptz := clock_timestamp();
  v_hits integer;
begin
  if p_window_seconds < 1 or p_max_hits < 1 then
    raise exception 'rate_limit_hit: window and max must be positive';
  end if;

  -- One row per key. A row whose time has passed starts again at one.
  insert into public.rate_limits as r (bucket, hits, expires_at)
  values (p_key, 1, v_now + make_interval(secs => p_window_seconds))
  on conflict (bucket) do update
    set hits = case when r.expires_at <= v_now then 1 else r.hits + 1 end,
        expires_at = case when r.expires_at <= v_now then v_now + make_interval(secs => p_window_seconds) else r.expires_at end
  returning r.hits into v_hits;

  -- Tidy up rows that have run out, now and then.
  if random() < 0.05 then
    delete from public.rate_limits where expires_at < v_now;
  end if;

  return v_hits <= p_max_hits;
end
$$;

revoke execute on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
