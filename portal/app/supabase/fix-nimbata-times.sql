-- One-off repair for calls uploaded before the October 2026 fix. Paste it all into Supabase → SQL Editor → Run.
-- Safe to run more than once: every call it moves is marked, and marked calls are never moved again.
--
--  1. Nimbata exports its times in UTC, but the portal read them as the partner's local time, so every call
--     sat 12 to 13 hours early (a call at 11am showed as 10pm the night before). Each one moves to its real time
--     and, where that crosses midnight at the end of a month, to the right month.
--  2. Nimbata writes missed calls as NOT_ANSWERED, which was being read as answered. Those become missed.
--  3. Calls that were never leads are removed: Nimbata's blocked spam numbers, test calls from Joe's phone,
--     and calls that never rang through to anyone (no destination, not answered).
--  4. A handful of calls on a handover day can end up with the outgoing partner once their real time is known.
--     Those are removed; uploading the Nimbata export again gives them to the partner who had the region.
--
-- The table it prints shows how many calls each step changed.

drop table if exists _fix;
create temp table _fix (step text, calls int);
begin;
-- the partner-edit guard only lets a logged-in admin change calls, and the SQL Editor isn't logged in as anyone
alter table public.calls disable trigger calls_guard;

with moved as (
  update public.calls c
     set called_at = (c.called_at at time zone cl.timezone) at time zone 'UTC',
         ym        = to_char(((c.called_at at time zone cl.timezone) at time zone 'UTC') at time zone cl.timezone, 'YYYY-MM'),
         raw       = c.raw || '{"_tz":"shifted"}'::jsonb
    from public.clients cl
   where cl.id = c.client_id
     and c.raw is not null and not (c.raw ? '_tz')
     and (c.raw ? 'Tracking Num (formatted)' or c.raw ? 'Tracking Name' or c.raw ? 'Destination Name'
          or c.raw ? 'Destination (formatted)' or c.raw ? 'Times Called' or c.raw ? 'Who Hungup')
  returning 1
) insert into _fix select '1. Times moved from UTC to local time', count(*) from moved;

-- if the export was uploaded again before this ran, the fresh copy and the moved copy are the same call:
-- keep the moved one (it carries the partner's Won/Lost tags) and drop the fresh one
with dupes as (
  delete from public.calls b
   using public.calls a
   where a.client_id = b.client_id and a.id <> b.id
     and a.raw->>'_tz' = 'shifted' and b.raw->>'_tz' in ('utc', 'local')
     and abs(extract(epoch from (a.called_at - b.called_at))) < 120
     and regexp_replace(a.caller_number, '\D', '', 'g') = regexp_replace(b.caller_number, '\D', '', 'g')
  returning 1
) insert into _fix select '1b. Duplicates from an earlier re-upload removed', count(*) from dupes;

with fixed as (
  update public.calls
     set outcome = 'missed'
   where outcome = 'answered'
     and upper(coalesce(raw->>'Outcome', raw->>'Call Outcome', '')) in ('NOT_ANSWERED', 'NO_ANSWER', 'BUSY', 'FAILED')
  returning 1
) insert into _fix select '2. Missed calls that showed as answered', count(*) from fixed;

with gone as (
  delete from public.calls
   where upper(coalesce(raw->>'Outcome', raw->>'Call Outcome', '')) = 'BLOCKED'
      or right(regexp_replace(caller_number, '\D', '', 'g'), 9) = '450925145'
      or (outcome <> 'answered'
          and (raw ? 'Destination Name' or raw ? 'Destination (formatted)' or raw ? 'Destination')
          and coalesce(nullif(btrim(raw->>'Destination Name', ' -'), ''), nullif(btrim(raw->>'Destination (formatted)', ' -'), ''),
                       nullif(btrim(raw->>'Destination', ' -'), '')) is null)
  returning 1
) insert into _fix select '3. Spam, test and never-rang-through calls removed', count(*) from gone;

with stray as (
  delete from public.calls c
   using public.clients cl
   where cl.id = c.client_id and not cl.active and cl.churned_on is not null
     and c.raw->>'_tz' = 'shifted'
     and c.called_at >= ((cl.churned_on + 1)::timestamp at time zone cl.timezone)
     and c.called_at <  ((cl.churned_on + 1)::timestamp at time zone cl.timezone) + interval '14 hours'
  returning 1
) insert into _fix select '4. Calls after a past partner''s last day removed', count(*) from stray;

alter table public.calls enable trigger calls_guard;
commit;
select * from _fix order by step;
