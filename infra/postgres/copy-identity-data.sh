#!/usr/bin/env sh
set -eu

SHARED_DB="${SHARED_DB:-realestate_eval_dev}"
TARGET_DB="${TARGET_DB:-realestate_eval_identity}"
USER_NAME="${POSTGRES_USER:-postgres}"

echo "Copying identity data: ${SHARED_DB} -> ${TARGET_DB}"

pg_dump -U "$USER_NAME" -d "$SHARED_DB" \
  --data-only --no-owner --no-privileges \
  --schema=identity \
  -T 'identity."__EFMigrationsHistory"' \
  | sed '/SELECT pg_catalog.setval/d' \
  | psql -U "$USER_NAME" -d "$TARGET_DB" -v ON_ERROR_STOP=1

echo "Copy complete. After every owner copy, drop leftover databases with infra/postgres/drop-leftover-shared.sh."
