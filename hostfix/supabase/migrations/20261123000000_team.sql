-- =============================================================================
-- HostFix: a cleaner is a person, not a link
-- -----------------------------------------------------------------------------
-- Applied automatically when the site is deployed. You never paste this
-- anywhere. It is safe to run twice.
--
-- DECISIONS.md, 2026-11-18, "A cleaner is a person, not a link".
--
-- 1. A team link: one per person (a user, known by their mobile), for life.
--    It opens /r/<link> and lists every house the person may report on,
--    across every owner who has added that mobile.
-- 2. A team member: one row per owner per person, with the name the owner
--    knows them by and the owner's setting (send a tradie straight away, or
--    ask the owner first). Removing them sets removed_at; the row is kept so
--    old jobs still say who reported them.
-- 3. Property groups: named, owned by one owner, holding some of their
--    properties. A property can be in more than one group.
-- 4. Team access: which properties and which groups a team member may report
--    on. A group gives every property in it, including ones added later.
-- 5. A job remembers which team member reported it.
-- =============================================================================


-- 1. TEAM LINKS (one per person) ----------------------------------------------

create table if not exists public.team_links (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  user_id     uuid not null unique references public.users (id),
  -- The code in the link. Long and random. A device that has proved the
  -- mobile once keeps a cookie signed against it.
  link_token  text not null unique check (char_length(link_token) between 20 and 40)
);


-- 2. TEAM MEMBERS (one per owner per person) ----------------------------------

create table if not exists public.team_members (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  owner_id    uuid not null references public.owners (id),
  link_id     uuid not null references public.team_links (id),
  name        text not null check (char_length(name) between 1 and 80),
  -- straight: a tradie is sent as soon as they report. ask: the owner is texted for a yes first.
  dispatch    text not null default 'straight' check (dispatch in ('straight', 'ask')),
  removed_at  timestamptz
);

create unique index if not exists team_members_owner_link_key on public.team_members (owner_id, link_id);
create index if not exists team_members_link_idx on public.team_members (link_id) where removed_at is null;


-- 3. PROPERTY GROUPS ----------------------------------------------------------

create table if not exists public.property_groups (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  owner_id    uuid not null references public.owners (id),
  name        text not null check (char_length(name) between 1 and 60)
);

create index if not exists property_groups_owner_idx on public.property_groups (owner_id);

create table if not exists public.property_group_members (
  group_id    uuid not null references public.property_groups (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (group_id, property_id)
);

create index if not exists property_group_members_property_idx on public.property_group_members (property_id);


-- 4. TEAM ACCESS --------------------------------------------------------------

create table if not exists public.team_access (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  member_id   uuid not null references public.team_members (id) on delete cascade,
  property_id uuid references public.properties (id) on delete cascade,
  group_id    uuid references public.property_groups (id) on delete cascade,
  constraint team_access_one_thing check ((property_id is null) <> (group_id is null))
);

create unique index if not exists team_access_property_key on public.team_access (member_id, property_id) where property_id is not null;
create unique index if not exists team_access_group_key on public.team_access (member_id, group_id) where group_id is not null;


-- 5. WHICH TEAM MEMBER REPORTED A JOB -----------------------------------------

alter table public.jobs add column if not exists team_member_id uuid references public.team_members (id);
create index if not exists jobs_team_member_idx on public.jobs (team_member_id) where team_member_id is not null;


-- 6. LOCK IT DOWN -------------------------------------------------------------
-- Row Level Security on, and nothing for the public roles, like every table.

do $$
declare
  t text;
  r text;
begin
  foreach t in array array['team_links', 'team_members', 'property_groups', 'property_group_members', 'team_access'] loop
    execute format('alter table public.%I enable row level security', t);
    foreach r in array array['anon', 'authenticated'] loop
      if exists (select 1 from pg_roles where rolname = r) then
        execute format('revoke all on table public.%I from %I', t, r);
      end if;
    end loop;
  end loop;
end
$$;
