-- =============================================================================
-- 24 November 2026 (DECISIONS.md, 2026-11-24, fourth entry)
--
-- 1. The criminal record check: a person on the team marks that they have seen
--    it, and who and when is kept. A tradie is not approved the first time
--    without it. The record itself is never stored, only the note.
-- 2. The light jobs on menus that already exist (Queenstown went live before
--    this): the light bulbs job says what it covers, and "Light not working,
--    not sure why" goes to an electrician. A new market gets both from
--    seed/menu-queenstown.json instead. Safe to run on an empty database.
-- =============================================================================

alter table public.tradies add column if not exists record_check_seen_at timestamptz;
alter table public.tradies add column if not exists record_check_seen_by text;

-- Anyone approved before this rule had their record seen by Joe by hand.
update public.tradies set record_check_seen_at = approved_at, record_check_seen_by = 'before 24 Nov 2026'
 where approved_at is not null and record_check_seen_at is null;

-- The light bulbs job: what it covers, for owners and handymen.
update public.menu_items
   set description = 'Bulbs you can twist, push or screw out (including GU10 downlight bulbs and tubes), up to 5. Not for a sealed LED downlight with no bulb to take out, or a light that still won''t work with a new bulb: book "Light not working, not sure why" (an electrician) instead.',
       try_first = 'Check the bulb is in firmly and the switch is on. If the whole light is one sealed unit with no bulb to take out, book "Light not working, not sure why".',
       updated_at = now()
 where code = 'HM-03' and name = 'Light bulbs, up to 5';

-- "Light not working, not sure why": an electrician's first hour, the same price as EL-02, next to the light fitting job.
insert into public.menu_items (market, code, trade, name, description, try_first, owner_price_cents, tradie_payout_cents, licence_required, guest_visible, active, sort)
select f.market, 'EL-07', 'electrician', 'Light not working, not sure why',
       'A light that won''t come on and you don''t know why: a sealed LED downlight, a new bulb that didn''t fix it, a flickering light or a dead switch. An electrician finds the fault in the first hour; anything more is quoted.',
       '', 22500, 19000, true, true, true, f.sort + 1
  from public.menu_items f
 where f.code = 'EL-06'
on conflict (market, code) do nothing;
