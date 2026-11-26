-- =============================================================================
-- 26 November 2026 (DECISIONS.md, 2026-11-26, "Service areas"): no travel
-- charge. Each market is split into areas; each tradie ticks the areas they
-- cover; a job is only offered to tradies who cover its property's area.
--
--   markets.areas      the market's areas: [{ key, name, suburbs }]
--   properties.area    the key of the property's area, or null (offered to everyone)
--   tradies.areas      the keys of the areas the tradie covers
--
-- A database that already has Queenstown or Wānaka gets the same areas as
-- config/markets.ts (tests/unit/areas.test.ts checks they agree). Existing
-- properties get their area from their suburb (ignoring case, macrons and
-- apostrophes); a suburb that matches none stays null. Existing tradies cover
-- every area of their market until they change it.
-- =============================================================================

alter table public.markets add column if not exists areas jsonb not null default '[]'::jsonb;
alter table public.properties add column if not exists area text check (area is null or char_length(area) between 1 and 60);
alter table public.tradies add column if not exists areas text[] not null default '{}'::text[];

update public.markets set areas = $queenstown$[
  {"key": "queenstown-central", "name": "Queenstown central", "suburbs": ["Queenstown", "Queenstown Central", "Fernhill", "Sunshine Bay", "Queenstown Hill"]},
  {"key": "frankton", "name": "Frankton", "suburbs": ["Frankton", "Quail Rise", "Remarkables Park"]},
  {"key": "kelvin-heights", "name": "Kelvin Heights", "suburbs": ["Kelvin Heights", "Kelvin Peninsula"]},
  {"key": "jacks-point", "name": "Jack's Point & Hanley's Farm", "suburbs": ["Jack's Point", "Jacks Point", "Hanley's Farm", "Hanleys Farm"]},
  {"key": "lake-hayes", "name": "Lake Hayes & Shotover Country", "suburbs": ["Lake Hayes", "Lake Hayes Estate", "Shotover Country", "Lower Shotover"]},
  {"key": "arthurs-point", "name": "Arthurs Point", "suburbs": ["Arthurs Point", "Arthur's Point"]},
  {"key": "arrowtown", "name": "Arrowtown", "suburbs": ["Arrowtown"]},
  {"key": "gibbston", "name": "Gibbston", "suburbs": ["Gibbston", "Gibbston Valley"]},
  {"key": "glenorchy", "name": "Glenorchy & Kinloch", "suburbs": ["Glenorchy", "Kinloch"]}
]$queenstown$::jsonb
 where slug = 'queenstown' and areas = '[]'::jsonb;

update public.markets set areas = $wanaka$[
  {"key": "wanaka-town", "name": "Wānaka town", "suburbs": ["Wānaka", "Wānaka town"]},
  {"key": "albert-town", "name": "Albert Town", "suburbs": ["Albert Town"]},
  {"key": "hawea", "name": "Lake Hāwea & Hāwea Flat", "suburbs": ["Lake Hāwea", "Hāwea", "Hāwea Flat"]},
  {"key": "luggate", "name": "Luggate", "suburbs": ["Luggate"]},
  {"key": "cardrona", "name": "Cardrona", "suburbs": ["Cardrona", "Cardrona Valley"]}
]$wanaka$::jsonb
 where slug = 'wanaka' and areas = '[]'::jsonb;

-- The same folding as foldPlace in src/lib/markets/areas.ts, for the backfill only.
update public.properties p
   set area = (
     select a ->> 'key'
       from public.markets m
       cross join lateral jsonb_array_elements(m.areas) a
      where m.slug = p.market
        and exists (
          select 1 from jsonb_array_elements_text(a -> 'suburbs') s
           where btrim(regexp_replace(translate(lower(s), 'āēīōūĀĒĪŌŪ''’‘`', 'aeiouaeiou'), '\s+', ' ', 'g'))
               = btrim(regexp_replace(translate(lower(p.suburb), 'āēīōūĀĒĪŌŪ''’‘`', 'aeiouaeiou'), '\s+', ' ', 'g')))
      limit 1)
 where p.area is null;

update public.tradies t
   set areas = coalesce((
     select array_agg(a ->> 'key')
       from public.markets m
       cross join lateral jsonb_array_elements(m.areas) a
      where m.slug = t.market), '{}'::text[])
 where t.areas = '{}'::text[];
