-- The working day can start or end on the half hour. Queenstown's ends at
-- 4:30pm (DECISIONS.md: the after-hours rate applies after 4:30pm and on
-- Saturdays), which whole hours could not hold. 16.5 means 4:30pm.

do $$
begin
  if (select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'markets' and column_name = 'hours_end') = 'integer' then
    alter table public.markets
      alter column hours_start type real using hours_start::real,
      alter column hours_end type real using hours_end::real;
  end if;
end $$;

alter table public.markets drop constraint if exists markets_half_hours;
alter table public.markets add constraint markets_half_hours
  check (hours_start * 2 = round(hours_start * 2) and hours_end * 2 = round(hours_end * 2));
