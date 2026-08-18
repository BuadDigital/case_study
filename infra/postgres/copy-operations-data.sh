#!/usr/bin/env sh
# One-time copy of operations rows (operations schema plus D2 task tables in case_study)
# from the shared database into the dedicated operations database.
# Schema/migrations must already have been applied to the target
# (DbMigrate update with REAL_ESTATE_EVAL_PG_CONNECTION_STRING_OPERATIONS set).
#
# Usage from repo root, against the compose Postgres:
#   docker compose -f infra/docker-compose.yml exec -T postgres sh < infra/postgres/copy-operations-data.sh
#
# Or pass database names:
#   SHARED_DB=realestate_eval_prod TARGET_DB=realestate_eval_prod_operations \
#     docker compose -f infra/docker-compose.prod.yml exec -T postgres sh < infra/postgres/copy-operations-data.sh

set -eu

SHARED_DB="${SHARED_DB:-realestate_eval_dev}"
TARGET_DB="${TARGET_DB:-realestate_eval_operations}"
USER_NAME="${POSTGRES_USER:-postgres}"

echo "Copying operations data: ${SHARED_DB} -> ${TARGET_DB}"

pg_dump -U "$USER_NAME" -d "$SHARED_DB" \
  --data-only --no-owner --no-privileges \
  --schema=operations \
  -T 'operations."__EFMigrationsHistory"' \
  | sed '/SELECT pg_catalog.setval/d' \
  | psql -U "$USER_NAME" -d "$TARGET_DB" -v ON_ERROR_STOP=1

pg_dump -U "$USER_NAME" -d "$SHARED_DB" \
  --data-only --no-owner --no-privileges \
  -t 'case_study."OperationsTasks"' \
  -t 'case_study."OperationsTaskSequences"' \
  | sed '/SELECT pg_catalog.setval/d' \
  | psql -U "$USER_NAME" -d "$TARGET_DB" -v ON_ERROR_STOP=1

echo "Copy complete. After every owner copy, drop leftover databases with infra/postgres/drop-leftover-shared.sh."
