-- ============================================================
-- The Tipsy Tui — Bookings schema
-- Run this once in Supabase: SQL Editor → New query → paste → Run
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- profiles (one row per login: Joe, Kieran) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- Auto-create a profile when a user is added in Supabase Auth.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- staff (you two + casual bartenders) ----------
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  role text not null default 'bartender' check (role in ('owner', 'bartender')),
  hourly_rate numeric(8,2) not null default 30,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- bookings ----------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),

  status text not null default 'confirmed'
    check (status in ('enquiry', 'quoted', 'confirmed', 'completed', 'cancelled')),

  -- who
  client_name text not null,
  contact_name text,
  email text,
  phone text,

  -- what / when / where
  event_name text,
  event_type text,                 -- wedding, birthday, corporate, reunion, other
  event_date date not null,
  start_time time,
  finish_time time,
  setup_hours numeric(4,2) not null default 1,
  packdown_hours numeric(4,2) not null default 1,
  venue text,
  address text,
  travel_minutes integer not null default 0,   -- one-way from Christchurch
  guest_count integer,

  -- package
  package text not null default 'byo'
    check (package in ('dry_hire', 'byo', 'fully_catered')),
  bartender_count integer,         -- null = auto from guest tiers
  glassware boolean not null default false,
  generator boolean not null default false,
  fairy_lights boolean not null default false,
  cocktails boolean not null default false,
  accommodation boolean not null default false,
  kegs_on_tap text,
  drinks_notes text,
  client_supplies text,

  -- money
  total numeric(10,2),
  deposit_amount numeric(10,2),
  deposit_paid boolean not null default false,
  balance_paid boolean not null default false,
  bond_amount numeric(10,2) not null default 0,
  bond_paid boolean not null default false,
  bond_refunded boolean not null default false,

  notes text,
  source_text text,                -- the contract / email that was pasted in
  review_flags jsonb not null default '[]'::jsonb   -- things the intake couldn't read, cleared from the job page
);

create index if not exists bookings_event_date_idx on public.bookings (event_date);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists bookings_touch on public.bookings;
create trigger bookings_touch before update on public.bookings
  for each row execute procedure public.touch_updated_at();

-- ---------- tasks (the per-job checklist) ----------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  title text not null,
  phase text not null default 'prep',   -- booking, prep, week_of, day_before, day_of, after
  due_date date,
  assigned_to text,                     -- 'Joe', 'Kieran' or blank
  done boolean not null default false,
  done_at timestamptz,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists tasks_booking_idx on public.tasks (booking_id);
create index if not exists tasks_due_idx on public.tasks (due_date) where done = false;

-- ---------- who is working each job ----------
create table if not exists public.booking_staff (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  role text not null default 'bartender',
  confirmed boolean not null default false,
  unique (booking_id, staff_id)
);

-- ---------- Row Level Security ----------
-- Two-person business: anyone who can log in can see and edit everything.
alter table public.profiles      enable row level security;
alter table public.staff         enable row level security;
alter table public.bookings      enable row level security;
alter table public.tasks         enable row level security;
alter table public.booking_staff enable row level security;

do $$
declare t text;
begin
  foreach t in array array['profiles','staff','bookings','tasks','booking_staff'] loop
    execute format('drop policy if exists "team_all" on public.%I', t);
    execute format(
      'create policy "team_all" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Seed the two owners as staff so they can be rostered onto jobs.
insert into public.staff (name, role, hourly_rate)
select * from (values ('Joe', 'owner', 0::numeric), ('Kieran', 'owner', 0::numeric)) as v(name, role, hourly_rate)
where not exists (select 1 from public.staff where role = 'owner');
