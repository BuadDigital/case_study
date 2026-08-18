#!/usr/bin/env sh
# One-time copy of failures rows from the shared database into the dedicated
# failures database. Schema/migrations must already have been applied to the target
# (DbMigrate update with REAL_ESTATE_EVAL_PG_CONNECTION_STRING_FAILURES set).
#
# Usage from repo root, against the compose Postgres:
#   docker compose -f infra/docker-compose.yml exec -T postgres sh < infra/postgres/copy-failures-data.sh
#
# Or pass database names:
#   SHARED_DB=realestate_eval_prod TARGET_DB=realestate_eval_prod_failures \
#     docker compose -f infra/docker-compose.prod.yml exec -T postgres sh < infra/postgres/copy-failures-data.sh

set -eu

SHARED_DB="${SHARED_DB:-realestate_eval_dev}"
TARGET_DB="${TARGET_DB:-realestate_eval_failures}"
USER_NAME="${POSTGRES_USER:-postgres}"

echo "Copying failures data: ${SHARED_DB} -> ${TARGET_DB}"

pg_dump -U "$USER_NAME" -d "$SHARED_DB" \
  --data-only --no-owner --no-privileges \
  --schema=failures \
  -T 'failures."__EFMigrationsHistory"' \
  | sed '/SELECT pg_catalog.setval/d' \
  | psql -U "$USER_NAME" -d "$TARGET_DB" -v ON_ERROR_STOP=1

echo "Copy complete. After every owner copy, drop leftover databases with infra/postgres/drop-leftover-shared.sh."
