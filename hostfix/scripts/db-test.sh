#!/usr/bin/env bash
# Applies the database migrations to a THROWAWAY Postgres and runs the checks.
#
#   DATABASE_URL=postgres://postgres@127.0.0.1:5432/hostfix_test scripts/db-test.sh
#
# Never point this at your live Supabase database. The checks roll back their
# own test data, but there is no reason to run them against production.
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to a throwaway Postgres database.}"
cd "$(dirname "$0")/.."
export PGOPTIONS="--client-min-messages=warning"

# A plain Postgres does not have the three roles every Supabase project has.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
SQL

# Apply every migration twice to prove a re-run is harmless.
for round in 1 2; do
  for file in supabase/migrations/*.sql; do
    echo "Applying $file (run $round)"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$file"
  done
done

for file in tests/db/*.checks.sql; do
  echo "Checking $file"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$file"
done
