-- =============================================================================
-- 27 November 2026 (DECISIONS.md, 2026-11-27, second entry): pre-launch mode.
--
-- Owners can make their account and add every property before a market opens.
-- No card is taken and no job can be booked until the market's stage is "live".
--
--   markets.pre_launch   true: while the stage is "waitlist", owners can sign up
--                        and add properties. It means nothing at any other stage.
--
-- Queenstown and Wānaka are switched on here, the same as config/markets.ts
-- (tests/unit/pre-launch.test.ts checks the two agree). Every other market
-- starts with it off: tick the box on Admin > Markets.
-- =============================================================================

alter table public.markets add column if not exists pre_launch boolean not null default false;

update public.markets set pre_launch = true where slug in ('queenstown', 'wanaka');
