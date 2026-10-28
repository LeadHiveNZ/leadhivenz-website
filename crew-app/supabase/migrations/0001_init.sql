-- Crew app, phase 1 schema.
-- Run in the Supabase SQL editor (or `supabase db push`). Safe to run once on a new project.

create extension if not exists "pgcrypto";

-- ---------- enums ----------
create type public.user_role as enum ('admin', 'qualified', 'apprentice');
create type public.job_status as enum ('scheduled', 'on_the_way', 'on_site', 'done');
create type public.photo_kind as enum ('before', 'after', 'issue');
create type public.rate_band as enum ('standard', 'after_hours', 'night_sunday');
create type public.travel_zone as enum ('1', '2', '3', 'beyond');

-- ---------- users ----------
-- One row per login. id matches auth.users.id. Rows are created by the seed script or by Mike;
-- there is no self sign-up.
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  role public.user_role not null default 'apprentice',
  van int,
  can_do_gas boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- jobs ----------
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  calendar_event_id text unique,
  date date not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  van int not null,
  assigned_to uuid[] not null default '{}',
  customer_first_name text not null,
  customer_phone text,
  address text not null,
  suburb text,
  travel_zone public.travel_zone not null default '1',
  job_type text not null,
  description text,
  access_notes text,
  is_gas boolean not null default false,
  quoted_hours numeric(5,2),
  status public.job_status not null default 'scheduled',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_date_van_idx on public.jobs (date, van);
create index jobs_suburb_idx on public.jobs (lower(suburb));
create index jobs_customer_idx on public.jobs (lower(customer_first_name));

create table public.job_photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  kind public.photo_kind not null default 'before',
  storage_path text not null,
  taken_by uuid references public.users (id),
  taken_at timestamptz not null default now()
);
create index job_photos_job_idx on public.job_photos (job_id, taken_at);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  user_id uuid not null references public.users (id),
  minutes int not null check (minutes > 0 and minutes % 15 = 0),
  started_at timestamptz not null default now(),
  rate_band public.rate_band not null,
  created_at timestamptz not null default now()
);
create index time_entries_job_idx on public.time_entries (job_id);

create table public.job_materials (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  description text not null,
  qty numeric(8,2) not null default 1,
  added_by uuid references public.users (id),
  created_at timestamptz not null default now()
);

create table public.job_notes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  user_id uuid not null references public.users (id),
  text text not null,
  created_at timestamptz not null default now()
);

-- Calendar events that could not be turned into a job. Shown on the office board.
create table public.calendar_sync_issues (
  id uuid primary key default gen_random_uuid(),
  calendar_event_id text,
  title text,
  starts_at timestamptz,
  reason text not null,
  raw jsonb,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- helper functions (security definer so RLS policies don't recurse) ----------
create or replace function public.my_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid()
$$;

create or replace function public.my_van()
returns int language sql stable security definer set search_path = public as $$
  select van from public.users where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.users where id = auth.uid()), false)
$$;

create or replace function public.can_see_job(p_job_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.jobs j
    where j.id = p_job_id
      and (public.is_admin() or j.van = public.my_van())
  )
$$;

-- ---------- rules enforced in the database ----------

-- Rule: gas jobs can never be assigned to anyone with can_do_gas = false.
create or replace function public.enforce_gas_assignment()
returns trigger language plpgsql as $$
declare
  bad_name text;
begin
  if new.is_gas and cardinality(new.assigned_to) > 0 then
    select u.name into bad_name
    from public.users u
    where u.id = any (new.assigned_to) and u.can_do_gas = false
    limit 1;
    if bad_name is not null then
      raise exception 'Gas job cannot be assigned to % (not allowed to do gas work)', bad_name
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

create trigger jobs_gas_assignment
  before insert or update of is_gas, assigned_to on public.jobs
  for each row execute function public.enforce_gas_assignment();

-- Same rule from the other side: nobody can be switched to can_do_gas = false while assigned
-- to a gas job.
create or replace function public.enforce_gas_user_change()
returns trigger language plpgsql as $$
begin
  if new.can_do_gas = false and exists (
    select 1 from public.jobs j where j.is_gas and new.id = any (j.assigned_to)
  ) then
    raise exception '% is assigned to gas jobs and cannot have gas work switched off', new.name
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger users_gas_change
  before update of can_do_gas on public.users
  for each row execute function public.enforce_gas_user_change();

-- Crew may only change status / completed_at on a job. Everything else is Mike's.
create or replace function public.restrict_crew_job_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    if row(new.calendar_event_id, new.date, new.start_at, new.end_at, new.van, new.assigned_to,
           new.customer_first_name, new.customer_phone, new.address, new.suburb, new.travel_zone,
           new.job_type, new.description, new.access_notes, new.is_gas, new.quoted_hours)
       is distinct from
       row(old.calendar_event_id, old.date, old.start_at, old.end_at, old.van, old.assigned_to,
           old.customer_first_name, old.customer_phone, old.address, old.suburb, old.travel_zone,
           old.job_type, old.description, old.access_notes, old.is_gas, old.quoted_hours) then
      raise exception 'Crew can only change job status' using errcode = 'insufficient_privilege';
    end if;
  end if;
  new.updated_at := now();
  if new.status = 'done' and old.status is distinct from 'done' and new.completed_at is null then
    new.completed_at := now();
  end if;
  if new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end $$;

create trigger jobs_restrict_crew_update
  before update on public.jobs
  for each row execute function public.restrict_crew_job_update();

-- ---------- row level security ----------
alter table public.users enable row level security;
alter table public.jobs enable row level security;
alter table public.job_photos enable row level security;
alter table public.time_entries enable row level security;
alter table public.job_materials enable row level security;
alter table public.job_notes enable row level security;
alter table public.calendar_sync_issues enable row level security;

-- users: everyone can see the crew list (names only matter for "hours per person");
-- only admin can change it.
create policy users_select on public.users for select to authenticated using (true);
create policy users_admin_write on public.users for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- jobs: admin sees all; crew see their van's jobs.
create policy jobs_select on public.jobs for select to authenticated
  using (public.is_admin() or van = public.my_van());
create policy jobs_admin_insert on public.jobs for insert to authenticated
  with check (public.is_admin());
create policy jobs_update on public.jobs for update to authenticated
  using (public.is_admin() or van = public.my_van())
  with check (public.is_admin() or van = public.my_van());
create policy jobs_admin_delete on public.jobs for delete to authenticated
  using (public.is_admin());

-- child tables: visible / writable when the job is.
create policy job_photos_select on public.job_photos for select to authenticated
  using (public.can_see_job(job_id));
create policy job_photos_insert on public.job_photos for insert to authenticated
  with check (public.can_see_job(job_id));
create policy job_photos_delete on public.job_photos for delete to authenticated
  using (public.is_admin() or taken_by = auth.uid());

create policy time_entries_select on public.time_entries for select to authenticated
  using (public.can_see_job(job_id));
create policy time_entries_insert on public.time_entries for insert to authenticated
  with check (public.can_see_job(job_id));
create policy time_entries_delete on public.time_entries for delete to authenticated
  using (public.is_admin() or user_id = auth.uid());
create policy time_entries_admin_update on public.time_entries for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy job_materials_select on public.job_materials for select to authenticated
  using (public.can_see_job(job_id));
create policy job_materials_insert on public.job_materials for insert to authenticated
  with check (public.can_see_job(job_id));
create policy job_materials_delete on public.job_materials for delete to authenticated
  using (public.is_admin() or added_by = auth.uid());

create policy job_notes_select on public.job_notes for select to authenticated
  using (public.can_see_job(job_id));
create policy job_notes_insert on public.job_notes for insert to authenticated
  with check (public.can_see_job(job_id) and user_id = auth.uid());
create policy job_notes_delete on public.job_notes for delete to authenticated
  using (public.is_admin() or user_id = auth.uid());

create policy sync_issues_admin on public.calendar_sync_issues for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- storage: private bucket for job photos ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-photos', 'job-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Paths look like: <job_id>/<uuid>.jpg
create policy "job photos read" on storage.objects for select to authenticated
  using (bucket_id = 'job-photos' and public.can_see_job((storage.foldername(name))[1]::uuid));
create policy "job photos write" on storage.objects for insert to authenticated
  with check (bucket_id = 'job-photos' and public.can_see_job((storage.foldername(name))[1]::uuid));
create policy "job photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'job-photos' and public.is_admin());

-- ---------- realtime for the office board ----------
alter publication supabase_realtime add table public.jobs;
alter publication supabase_realtime add table public.time_entries;
alter publication supabase_realtime add table public.job_photos;
