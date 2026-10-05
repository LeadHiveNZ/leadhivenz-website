-- ───────────────────────────── billing + slots (October 2026) ──────────────
-- When each partner is due, what's been paid, month extensions, and which region + trade slots
-- are open. Paste into Supabase → SQL Editor → Run. Safe to re-run. Also part of schema.sql.

-- billing_start: the day Month 1 was invoiced (blank = their start date). Each month is invoiced on
-- its first day. setup_fee is added to Month 1; extra_fee (e.g. "Website" $50) to every month. All ex GST.
alter table public.clients add column if not exists billing_start date;
alter table public.clients add column if not exists setup_fee   numeric not null default 0;
alter table public.clients add column if not exists extra_fee   numeric not null default 0;
alter table public.clients add column if not exists extra_label text    not null default '';
-- old flat-price contracts: invoices dated on or before this day are the fee and nothing more (GST included)
alter table public.clients add column if not exists flat_until  date;

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
