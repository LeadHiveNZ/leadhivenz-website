-- ============================================================================
--  LeadHive Partner Portal — Supabase schema  (v1)
--  Paste the whole file into the Supabase SQL editor and run it once.
--  Safe to re-run: everything is "if not exists" / "or replace".
-- ============================================================================

create extension if not exists pgcrypto;

-- ───────────────────────────── clients ─────────────────────────────────────
create table if not exists public.clients (
  id                 uuid primary key default gen_random_uuid(),
  business_name      text not null,
  initials           text not null default '',
  contact_name       text not null default '',
  email              text unique,                       -- the partner's login email (lower case)
  phone              text not null default '',          -- the number Nimbata forwards to
  niche              text not null default 'Emergency plumber',
  region             text not null default '',
  country            text not null default 'NZ' check (country in ('NZ','AU')),
  timezone           text not null default 'Pacific/Auckland',
  package_name       text not null default 'Starter',
  monthly_fee        numeric not null default 1500,
  lead_target_min    int not null default 15,
  lead_target_max    int not null default 25,
  started_on         date not null default current_date,
  billing_day        int not null default 1 check (billing_day between 1 and 28),
  show_cost_per_lead boolean not null default false,   -- retired: partners never see cost per lead
  show_ad_spend      boolean not null default false,
  avg_job_value      numeric not null default 450,   -- Joe's estimate of a typical job, used when a lead has no estimate of its own
  active             boolean not null default true,
  churned_on         date,
  churn_reason       text,                           -- price, capacity, quality, in_house, seasonal, other
  churn_note         text not null default '',
  predecessor_id     uuid references public.clients(id) on delete set null,  -- the partner this one replaced in the region
  created_at         timestamptz not null default now()
);
alter table public.clients add column if not exists predecessor_id uuid references public.clients(id) on delete set null;
alter table public.clients add column if not exists avg_job_value numeric not null default 450;
alter table public.clients add column if not exists churned_on date;
alter table public.clients add column if not exists churn_reason text;
alter table public.clients add column if not exists churn_note text not null default '';

-- Admin-only secrets (the enquiry webhook key). Kept out of `clients` so a partner can never read it.
create table if not exists public.client_secrets (
  client_id   uuid primary key references public.clients(id) on delete cascade,
  webhook_key text not null unique default encode(gen_random_bytes(16), 'hex')
);

create or replace function public.ensure_client_secret() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.client_secrets (client_id) values (new.id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists clients_ensure_secret on public.clients;
create trigger clients_ensure_secret after insert on public.clients
  for each row execute function public.ensure_client_secret();

-- ───────────────────────────── profiles ────────────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  role         text not null default 'client' check (role in ('admin','client')),
  client_id    uuid references public.clients(id) on delete set null,
  last_seen_at timestamptz,
  created_at   timestamptz not null default now()
);
alter table public.profiles add column if not exists last_seen_at timestamptz;

-- partners call this when the portal opens; admin sees "last opened" per partner
create or replace function public.touch_seen() returns void
language sql security definer set search_path = public as $$
  update public.profiles set last_seen_at = now() where id = auth.uid();
$$;
revoke all on function public.touch_seen() from public;
grant execute on function public.touch_seen() to authenticated;

-- helpers used by the policies (security definer so they never recurse into RLS)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.my_client_id() returns uuid
language sql stable security definer set search_path = public as $$
  select client_id from public.profiles where id = auth.uid();
$$;

-- every new auth user gets a profile. hello@leadhivenz.com is the admin; anyone else is a
-- partner, linked to the client row whose email matches (if there is one yet).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_client uuid;
begin
  select id into v_client from public.clients where lower(email) = lower(new.email) limit 1;
  insert into public.profiles (id, email, role, client_id)
  values (new.id, lower(new.email),
          case when lower(new.email) = 'hello@leadhivenz.com' then 'admin' else 'client' end,
          v_client)
  on conflict (id) do update set email = excluded.email, client_id = coalesce(public.profiles.client_id, excluded.client_id);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- if a client row is created (or its email changed) after the person already signed up, link them
create or replace function public.link_profile_to_client() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is not null then
    update public.profiles set client_id = new.id
    where lower(email) = lower(new.email) and role = 'client' and client_id is distinct from new.id;
  end if;
  return new;
end $$;
drop trigger if exists clients_link_profile on public.clients;
create trigger clients_link_profile after insert or update of email on public.clients
  for each row execute function public.link_profile_to_client();

-- ───────────────────────────── months ──────────────────────────────────────
create table if not exists public.months (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  ym           text not null check (ym ~ '^\d{4}-\d{2}$'),
  status       text not null default 'draft' check (status in ('draft','published')),
  summary      text not null default '',
  points       jsonb not null default '[]'::jsonb,       -- [{"title":"...","body":"..."}] up to 3
  pdf_path     text,                                      -- storage path in the `reports` bucket
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (client_id, ym)
);

-- Google Ads spend lives in its own admin-only table. Partners only ever see it through the
-- v_month_ad_spend view, and only when their show_ad_spend flag is on.
create table if not exists public.month_private (
  month_id uuid primary key references public.months(id) on delete cascade,
  ad_spend numeric not null default 0
);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists months_touch on public.months;
create trigger months_touch before update on public.months
  for each row execute function public.touch_updated_at();

-- ───────────────────────────── calls ───────────────────────────────────────
create table if not exists public.calls (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id) on delete cascade,
  ym              text not null check (ym ~ '^\d{4}-\d{2}$'),
  called_at       timestamptz not null,
  caller_number   text not null default '',
  duration_sec    int not null default 0,
  outcome         text not null default 'answered' check (outcome in ('answered','missed','voicemail')),
  tracking_number text,
  source          text,
  campaign        text,
  keyword         text,
  city            text,
  recording_url   text,            -- external (Nimbata) recording link
  recording_path  text,            -- or a file in the `recordings` bucket: <client_id>/<file>
  nimbata_call_id text,
  admin_note      text not null default '',
  summary         text not null default '',   -- AI call summary from the CSV ("Summary" column), shown to the partner
  estimated_value numeric,         -- Joe's estimate for this job (from the CSV "Value" column or typed in)
  client_status   text not null default 'new' check (client_status in ('new','ongoing','quoted','won','lost','not_lead','spam')),
  job_value       numeric not null default 0 check (job_value >= 0),   -- the partner's real number
  client_note     text not null default '',
  raw             jsonb,
  created_at      timestamptz not null default now()
);
alter table public.calls add column if not exists estimated_value numeric;
alter table public.calls add column if not exists summary text not null default '';
alter table public.calls drop constraint if exists calls_client_status_check;
alter table public.calls add constraint calls_client_status_check check (client_status in ('new','ongoing','quoted','won','lost','not_lead','spam'));
create index if not exists calls_client_ym on public.calls (client_id, ym);
create unique index if not exists calls_client_nimbata on public.calls (client_id, nimbata_call_id) where nimbata_call_id is not null;

-- ───────────────────────────── enquiries ───────────────────────────────────
create table if not exists public.enquiries (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  ym            text,                                   -- filled by trigger from received_at in the client's timezone
  received_at   timestamptz not null default now(),
  name          text not null default '',
  phone         text not null default '',
  suburb        text not null default '',
  message       text not null default '',
  is_urgent     boolean not null default false,
  page          text,
  source        text not null default 'website',
  admin_note    text not null default '',
  estimated_value numeric,
  client_status text not null default 'new' check (client_status in ('new','ongoing','quoted','won','lost','not_lead','spam')),
  job_value     numeric not null default 0 check (job_value >= 0),
  client_note   text not null default '',
  created_at    timestamptz not null default now()
);
alter table public.enquiries add column if not exists admin_note text not null default '';
alter table public.enquiries add column if not exists estimated_value numeric;
alter table public.enquiries drop constraint if exists enquiries_client_status_check;
alter table public.enquiries add constraint enquiries_client_status_check check (client_status in ('new','ongoing','quoted','won','lost','not_lead','spam'));
create index if not exists enquiries_client_ym on public.enquiries (client_id, ym);

create or replace function public.set_enquiry_ym() returns trigger
language plpgsql security definer set search_path = public as $$
declare tz text;
begin
  if new.ym is null then
    select timezone into tz from public.clients where id = new.client_id;
    new.ym := to_char(new.received_at at time zone coalesce(tz, 'Pacific/Auckland'), 'YYYY-MM');
  end if;
  return new;
end $$;
drop trigger if exists enquiries_set_ym on public.enquiries;
create trigger enquiries_set_ym before insert or update of received_at on public.enquiries
  for each row execute function public.set_enquiry_ym();

-- Partners may only change the three outcome columns on their own leads. Admin can change anything.
create or replace function public.guard_partner_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  -- "not a lead" and "spam" are LeadHive's call, never the partner's (it would hand them a refund argument)
  if new.client_status in ('not_lead','spam') and new.client_status is distinct from old.client_status then
    raise exception 'Only LeadHive can mark a lead as not a lead or spam';
  end if;
  if (to_jsonb(new) - 'client_status' - 'job_value' - 'client_note')
     is distinct from
     (to_jsonb(old) - 'client_status' - 'job_value' - 'client_note') then
    raise exception 'Partners can only change the lead outcome, job value and note';
  end if;
  return new;
end $$;
drop trigger if exists calls_guard on public.calls;
create trigger calls_guard before update on public.calls
  for each row execute function public.guard_partner_update();
drop trigger if exists enquiries_guard on public.enquiries;
create trigger enquiries_guard before update on public.enquiries
  for each row execute function public.guard_partner_update();

-- ───────────────────────────── row level security ─────────────────────────
alter table public.clients        enable row level security;
alter table public.client_secrets enable row level security;
alter table public.profiles       enable row level security;
alter table public.months         enable row level security;
alter table public.month_private  enable row level security;
alter table public.calls          enable row level security;
alter table public.enquiries      enable row level security;

-- profiles: you can read your own; admin can read and edit all
drop policy if exists "profiles read own"  on public.profiles;
create policy "profiles read own"  on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles admin write" on public.profiles;
create policy "profiles admin write" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- clients: partner reads own row; admin everything
drop policy if exists "clients read" on public.clients;
create policy "clients read" on public.clients for select to authenticated using (public.is_admin() or id = public.my_client_id());
drop policy if exists "clients admin write" on public.clients;
create policy "clients admin write" on public.clients for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- secrets: admin only
drop policy if exists "secrets admin" on public.client_secrets;
create policy "secrets admin" on public.client_secrets for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- months: partner reads own published; admin everything
drop policy if exists "months read" on public.months;
create policy "months read" on public.months for select to authenticated
  using (public.is_admin() or (client_id = public.my_client_id() and status = 'published'));
drop policy if exists "months admin write" on public.months;
create policy "months admin write" on public.months for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ad spend table: admin only (partners go through the view below)
drop policy if exists "month_private admin" on public.month_private;
create policy "month_private admin" on public.month_private for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- calls + enquiries: partner reads and updates own (trigger limits the columns); admin everything
drop policy if exists "calls read" on public.calls;
create policy "calls read" on public.calls for select to authenticated using (public.is_admin() or client_id = public.my_client_id());
drop policy if exists "calls partner update" on public.calls;
create policy "calls partner update" on public.calls for update to authenticated
  using (public.is_admin() or client_id = public.my_client_id()) with check (public.is_admin() or client_id = public.my_client_id());
drop policy if exists "calls admin insert" on public.calls;
create policy "calls admin insert" on public.calls for insert to authenticated with check (public.is_admin());
drop policy if exists "calls admin delete" on public.calls;
create policy "calls admin delete" on public.calls for delete to authenticated using (public.is_admin());

drop policy if exists "enquiries read" on public.enquiries;
create policy "enquiries read" on public.enquiries for select to authenticated using (public.is_admin() or client_id = public.my_client_id());
drop policy if exists "enquiries partner update" on public.enquiries;
create policy "enquiries partner update" on public.enquiries for update to authenticated
  using (public.is_admin() or client_id = public.my_client_id()) with check (public.is_admin() or client_id = public.my_client_id());
drop policy if exists "enquiries admin insert" on public.enquiries;
create policy "enquiries admin insert" on public.enquiries for insert to authenticated with check (public.is_admin());
drop policy if exists "enquiries admin delete" on public.enquiries;
create policy "enquiries admin delete" on public.enquiries for delete to authenticated using (public.is_admin());

-- ───────────────────────────── views ───────────────────────────────────────
-- Ad spend, visible to admin always and to a partner only when their flag is on and the month is published.
-- (Runs with the view owner's rights on purpose; the where clause is the access rule.)
create or replace view public.v_month_ad_spend as
  select mp.month_id, m.client_id, m.ym, mp.ad_spend
  from public.month_private mp
  join public.months m on m.id = mp.month_id
  join public.clients c on c.id = m.client_id
  where public.is_admin()
     or (m.client_id = public.my_client_id() and c.show_ad_spend and m.status = 'published');
grant select on public.v_month_ad_spend to authenticated;

-- Per client per month counts (respects RLS, so a partner only sees their own rows).
create or replace view public.v_lead_counts with (security_invoker = true) as
  with c as (
    select client_id, ym,
           count(*)                                   as calls,
           count(*) filter (where outcome = 'answered') as answered,
           count(*) filter (where client_status = 'spam') as spam,
           count(*) filter (where client_status = 'won')  as won,
           coalesce(sum(job_value) filter (where client_status = 'won'), 0) as won_value
    from public.calls group by client_id, ym),
  e as (
    select client_id, ym,
           count(*) as enquiries,
           count(*) filter (where client_status = 'spam') as spam,
           count(*) filter (where client_status = 'won')  as won,
           coalesce(sum(job_value) filter (where client_status = 'won'), 0) as won_value
    from public.enquiries group by client_id, ym)
  select coalesce(c.client_id, e.client_id) as client_id,
         coalesce(c.ym, e.ym)               as ym,
         coalesce(c.calls, 0)               as calls,
         coalesce(c.answered, 0)            as answered,
         coalesce(e.enquiries, 0)           as enquiries,
         coalesce(c.calls, 0) + coalesce(e.enquiries, 0) - coalesce(c.spam, 0) - coalesce(e.spam, 0) as leads,
         coalesce(c.won, 0) + coalesce(e.won, 0)             as won,
         coalesce(c.won_value, 0) + coalesce(e.won_value, 0) as won_value
  from c full outer join e on c.client_id = e.client_id and c.ym = e.ym;
grant select on public.v_lead_counts to authenticated;

-- ───────────────────────────── admin RPC: replace a month of calls (opt-in) ───────
-- Wipes the month's calls and loads the file instead, carrying over partner tags on calls that
-- match (same Nimbata call id, or same caller within 2 minutes). Used only when the admin ticks
-- "replace" on the upload screen; the default is merge_month_calls below.
create or replace function public.replace_month_calls(p_client uuid, p_ym text, p_rows jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  drop table if exists _old, _new;

  create temp table _old on commit drop as
    select nimbata_call_id, called_at, regexp_replace(caller_number, '\D', '', 'g') as digits,
           client_status, job_value, client_note
    from public.calls where client_id = p_client and ym = p_ym;

  create temp table _new on commit drop as
    select distinct on (called_at, caller_number) *
    from (
      select (r->>'called_at')::timestamptz                 as called_at,
             coalesce(r->>'caller_number', '')               as caller_number,
             coalesce((r->>'duration_sec')::int, 0)          as duration_sec,
             coalesce(nullif(r->>'outcome',''), 'answered')  as outcome,
             r->>'tracking_number'                           as tracking_number,
             r->>'source'                                    as source,
             r->>'campaign'                                  as campaign,
             r->>'keyword'                                   as keyword,
             r->>'city'                                      as city,
             nullif(r->>'recording_url', '')                 as recording_url,
             nullif(r->>'nimbata_call_id', '')               as nimbata_call_id,
             coalesce(r->>'admin_note', '')                  as admin_note,
             coalesce(r->>'summary', '')                     as summary,
             nullif(r->>'estimated_value', '')::numeric      as estimated_value,
             r->'raw'                                        as raw
      from jsonb_array_elements(p_rows) r
    ) x
    order by called_at, caller_number, nimbata_call_id;

  delete from public.calls where client_id = p_client and ym = p_ym;

  insert into public.calls (client_id, ym, called_at, caller_number, duration_sec, outcome, tracking_number, source,
                            campaign, keyword, city, recording_url, nimbata_call_id, admin_note, summary, estimated_value, raw,
                            client_status, job_value, client_note)
  select p_client, p_ym, n.called_at, n.caller_number, n.duration_sec, n.outcome, n.tracking_number, n.source,
         n.campaign, n.keyword, n.city, n.recording_url, n.nimbata_call_id, n.admin_note, n.summary, n.estimated_value, n.raw,
         coalesce(o.client_status, 'new'), coalesce(o.job_value, 0), coalesce(o.client_note, '')
  from _new n
  left join lateral (
    select client_status, job_value, client_note from _old o
    where (n.nimbata_call_id is not null and o.nimbata_call_id = n.nimbata_call_id)
       or (abs(extract(epoch from (o.called_at - n.called_at))) < 120
           and o.digits = regexp_replace(n.caller_number, '\D', '', 'g'))
    limit 1
  ) o on true
  on conflict (client_id, nimbata_call_id) where nimbata_call_id is not null do nothing;

  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.replace_month_calls(uuid, text, jsonb) from public;
grant execute on function public.replace_month_calls(uuid, text, jsonb) to authenticated;


-- ───────────────────────────── admin RPC: merge a CSV into a month (the default) ──────────
-- Adds calls that aren't in the portal yet and refreshes the admin fields on ones that are
-- (matched by Nimbata call id, or same caller within 2 minutes). Partner tags are never touched,
-- and calls missing from the file are left alone, so fortnightly or overlapping uploads are safe.
create or replace function public.merge_month_calls(p_client uuid, p_ym text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n_upd int := 0; n_ins int := 0;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  drop table if exists _new;
  create temp table _new on commit drop as
    select distinct on (called_at, caller_number) *
    from (
      select (r->>'called_at')::timestamptz                 as called_at,
             coalesce(r->>'caller_number', '')               as caller_number,
             coalesce((r->>'duration_sec')::int, 0)          as duration_sec,
             coalesce(nullif(r->>'outcome',''), 'answered')  as outcome,
             r->>'tracking_number'                           as tracking_number,
             r->>'source'                                    as source,
             r->>'campaign'                                  as campaign,
             r->>'keyword'                                   as keyword,
             r->>'city'                                      as city,
             nullif(r->>'recording_url', '')                 as recording_url,
             nullif(r->>'nimbata_call_id', '')               as nimbata_call_id,
             coalesce(r->>'admin_note', '')                  as admin_note,
             coalesce(r->>'summary', '')                     as summary,
             nullif(r->>'estimated_value', '')::numeric      as estimated_value,
             r->'raw'                                        as raw
      from jsonb_array_elements(p_rows) r
    ) x
    order by called_at, caller_number, nimbata_call_id;

  -- refresh existing matches
  with matched as (
    select c.id as call_id, n.*
    from _new n
    join lateral (
      select id from public.calls c
      where c.client_id = p_client and c.ym = p_ym
        and ((n.nimbata_call_id is not null and c.nimbata_call_id = n.nimbata_call_id)
             or (abs(extract(epoch from (c.called_at - n.called_at))) < 120
                 and regexp_replace(c.caller_number, '\D', '', 'g') = regexp_replace(n.caller_number, '\D', '', 'g')))
      limit 1
    ) c on true
  ), upd as (
    update public.calls c set
      duration_sec = m.duration_sec, outcome = m.outcome,
      tracking_number = coalesce(m.tracking_number, c.tracking_number), source = coalesce(m.source, c.source),
      campaign = coalesce(m.campaign, c.campaign), keyword = coalesce(m.keyword, c.keyword), city = coalesce(m.city, c.city),
      recording_url = coalesce(m.recording_url, c.recording_url), nimbata_call_id = coalesce(c.nimbata_call_id, m.nimbata_call_id),
      admin_note = case when m.admin_note <> '' then m.admin_note else c.admin_note end,
      summary = case when m.summary <> '' then m.summary else c.summary end,
      estimated_value = coalesce(m.estimated_value, c.estimated_value), raw = coalesce(m.raw, c.raw)
    from matched m where c.id = m.call_id
    returning c.id
  ) select count(*) into n_upd from upd;

  -- add the rest
  with ins as (
    insert into public.calls (client_id, ym, called_at, caller_number, duration_sec, outcome, tracking_number, source,
                              campaign, keyword, city, recording_url, nimbata_call_id, admin_note, summary, estimated_value, raw)
    select p_client, p_ym, n.called_at, n.caller_number, n.duration_sec, n.outcome, n.tracking_number, n.source,
           n.campaign, n.keyword, n.city, n.recording_url, n.nimbata_call_id, n.admin_note, n.summary, n.estimated_value, n.raw
    from _new n
    where not exists (
      select 1 from public.calls c
      where c.client_id = p_client and c.ym = p_ym
        and ((n.nimbata_call_id is not null and c.nimbata_call_id = n.nimbata_call_id)
             or (abs(extract(epoch from (c.called_at - n.called_at))) < 120
                 and regexp_replace(c.caller_number, '\D', '', 'g') = regexp_replace(n.caller_number, '\D', '', 'g'))))
    on conflict (client_id, nimbata_call_id) where nimbata_call_id is not null do nothing
    returning id
  ) select count(*) into n_ins from ins;

  return jsonb_build_object('inserted', n_ins, 'updated', n_upd);
end $$;
revoke all on function public.merge_month_calls(uuid, text, jsonb) from public;
grant execute on function public.merge_month_calls(uuid, text, jsonb) to authenticated;



-- ───────────────────────────── admin RPC: merge web enquiries from a CSV ───────────
-- For enquiries that arrived by email before the landing page webhook was connected. Matches on
-- phone digits + time (within 10 minutes) so re-uploads are safe; partner tags are kept.
create or replace function public.merge_enquiries(p_client uuid, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n_ins int := 0; n_upd int := 0;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  drop table if exists _enq;
  create temp table _enq on commit drop as
    select distinct on (received_at, phone) *
    from (
      select (r->>'received_at')::timestamptz        as received_at,
             coalesce(r->>'name', '')                as name,
             coalesce(r->>'phone', '')               as phone,
             coalesce(r->>'suburb', '')              as suburb,
             coalesce(r->>'message', '')             as message,
             coalesce((r->>'is_urgent')::boolean, false) as is_urgent,
             nullif(r->>'page', '')                  as page,
             coalesce(nullif(r->>'source',''), 'website') as source,
             nullif(r->>'estimated_value', '')::numeric as estimated_value
      from jsonb_array_elements(p_rows) r
    ) x order by received_at, phone;

  with matched as (
    select e.id as enq_id, n.* from _enq n
    join lateral (
      select id from public.enquiries e
      where e.client_id = p_client
        and regexp_replace(e.phone, '\D', '', 'g') = regexp_replace(n.phone, '\D', '', 'g')
        and abs(extract(epoch from (e.received_at - n.received_at))) < 600
      limit 1) e on true
  ), upd as (
    update public.enquiries e set name = case when m.name <> '' then m.name else e.name end, suburb = case when m.suburb <> '' then m.suburb else e.suburb end,
      message = case when m.message <> '' then m.message else e.message end, is_urgent = m.is_urgent or e.is_urgent, page = coalesce(m.page, e.page),
      estimated_value = coalesce(m.estimated_value, e.estimated_value)
    from matched m where e.id = m.enq_id returning e.id
  ) select count(*) into n_upd from upd;

  with ins as (
    insert into public.enquiries (client_id, received_at, name, phone, suburb, message, is_urgent, page, source, estimated_value)
    select p_client, n.received_at, n.name, n.phone, n.suburb, n.message, n.is_urgent, n.page, n.source, n.estimated_value
    from _enq n
    where not exists (
      select 1 from public.enquiries e where e.client_id = p_client
        and regexp_replace(e.phone, '\D', '', 'g') = regexp_replace(n.phone, '\D', '', 'g')
        and abs(extract(epoch from (e.received_at - n.received_at))) < 600)
    returning id
  ) select count(*) into n_ins from ins;
  return jsonb_build_object('inserted', n_ins, 'updated', n_upd);
end $$;
revoke all on function public.merge_enquiries(uuid, jsonb) from public;
grant execute on function public.merge_enquiries(uuid, jsonb) to authenticated;

-- ───────────────────────────── region history (aggregates only) ────────────────
-- A partner who replaced someone in a region can see the region's monthly numbers from before
-- they joined: leads, calls, answered, enquiries and estimated value. Never callers, recordings,
-- summaries, tags or job values. Admin may pass any client id.
create or replace function public.region_history(p_client uuid default null)
returns table (ym text, leads bigint, calls bigint, answered bigint, enquiries bigint, est_value numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_client uuid;
begin
  v_client := case when public.is_admin() and p_client is not null then p_client else public.my_client_id() end;
  if v_client is null then return; end if;
  return query
  with recursive chain as (
    select c.id, c.predecessor_id, 1 as depth from public.clients c where c.id = v_client
    union all
    select c.id, c.predecessor_id, chain.depth + 1 from public.clients c join chain on c.id = chain.predecessor_id where chain.depth < 6
  ),
  preds as (select id from chain where id <> v_client),
  x as (
    select cl.client_id, cl.ym, 'call'::text as kind, cl.outcome, cl.client_status, cl.estimated_value from public.calls cl
    union all
    select e.client_id, e.ym, 'enquiry'::text, 'answered'::text, e.client_status, e.estimated_value from public.enquiries e
  )
  select x.ym,
         count(*) filter (where x.client_status <> 'spam')                       as leads,
         count(*) filter (where x.kind = 'call')                                  as calls,
         count(*) filter (where x.kind = 'call' and x.outcome = 'answered')       as answered,
         count(*) filter (where x.kind = 'enquiry')                               as enquiries,
         coalesce(sum(coalesce(x.estimated_value, c.avg_job_value)) filter (where x.client_status not in ('spam','not_lead')), 0) as est_value
  from x join preds p on p.id = x.client_id join public.clients c on c.id = x.client_id
  where x.ym is not null
  group by x.ym order by x.ym;
end $$;
revoke all on function public.region_history(uuid) from public;
grant execute on function public.region_history(uuid) to authenticated;

-- ───────────────────────────── billing + slots (October 2026) ──────────────
-- When each partner is due, what's been paid, month extensions, and which region + trade slots
-- are open. (Existing installs: run add-billing.sql, which is this same section.)

-- billing_start: the day Month 1 was invoiced (blank = their start date). Each month is invoiced on
-- its first day. setup_fee is added to Month 1; extra_fee (e.g. "Website" $50) to every month. All ex GST.
alter table public.clients add column if not exists billing_start date;
alter table public.clients add column if not exists setup_fee   numeric not null default 0;
alter table public.clients add column if not exists extra_fee   numeric not null default 0;
alter table public.clients add column if not exists extra_label text    not null default '';

-- a payment received for one billing month (Month 1, Month 2, …)
create table if not exists public.payments (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  month_no   int  not null check (month_no >= 1),
  amount     numeric not null default 0,       -- what landed, GST included
  paid_on    date not null default current_date,
  note       text not null default '',
  created_at timestamptz not null default now(),
  unique (client_id, month_no)
);

-- extra days added to a billing month (lead target missed): that month runs longer and every
-- later invoice moves back by the same number of days
create table if not exists public.extensions (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  month_no   int  not null check (month_no >= 1),
  days       int  not null check (days between 1 and 120),
  reason     text not null default '',
  created_at timestamptz not null default now()
);

-- the region + trade lines LeadHive sells. Lines that have had a partner show up by themselves;
-- a row here adds a new line (active) or hides one you no longer sell (active = false).
create table if not exists public.slots (
  id         uuid primary key default gen_random_uuid(),
  region     text not null,
  trade      text not null,                    -- Plumber, Electrician, Handyman, Builder, Roofer, …
  country    text not null default 'NZ' check (country in ('NZ','AU')),
  active     boolean not null default true,
  note       text not null default '',
  created_at timestamptz not null default now(),
  unique (region, trade, country)
);

alter table public.payments   enable row level security;
alter table public.extensions enable row level security;
alter table public.slots      enable row level security;
drop policy if exists "payments admin" on public.payments;
create policy "payments admin" on public.payments for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "extensions admin" on public.extensions;
create policy "extensions admin" on public.extensions for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- a partner sees their own extensions, so their "next invoice" date is right
drop policy if exists "extensions read own" on public.extensions;
create policy "extensions read own" on public.extensions for select to authenticated using (client_id = public.my_client_id());
drop policy if exists "slots admin" on public.slots;
create policy "slots admin" on public.slots for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- leads per partner per local day, for counting leads inside each billing month
create or replace view public.v_lead_days with (security_invoker = true) as
  select x.client_id, x.day, count(*) filter (where x.client_status <> 'spam') as leads
  from (
    select c.client_id, (c.called_at at time zone cl.timezone)::date as day, c.client_status
      from public.calls c join public.clients cl on cl.id = c.client_id
    union all
    select e.client_id, (e.received_at at time zone cl.timezone)::date as day, e.client_status
      from public.enquiries e join public.clients cl on cl.id = e.client_id
  ) x
  group by x.client_id, x.day;
grant select on public.v_lead_days to authenticated;

-- ───────────────────────────── storage ─────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', false), ('reports', 'reports', false)
on conflict (id) do nothing;

drop policy if exists "portal admin files" on storage.objects;
create policy "portal admin files" on storage.objects for all to authenticated
  using (bucket_id in ('recordings','reports') and public.is_admin())
  with check (bucket_id in ('recordings','reports') and public.is_admin());

-- partners can read files under their own client id folder:  <client_id>/<anything>
drop policy if exists "portal partner read own files" on storage.objects;
create policy "portal partner read own files" on storage.objects for select to authenticated
  using (bucket_id in ('recordings','reports') and (storage.foldername(name))[1] = public.my_client_id()::text);

-- ───────────────────────────── done ────────────────────────────────────────
-- Next: Authentication → Providers → Email → turn OFF "Confirm email".
--       Authentication → URL configuration → add your portal URL to Redirect URLs.
--       Then open the portal, tap "First time here? Set up your login" and sign up as
--       hello@leadhivenz.com — that account becomes the admin automatically.
