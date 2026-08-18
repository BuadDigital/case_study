#!/usr/bin/env sh
# One-time copy of messaging rows (outbox / inbox / notifications / push) from the
# shared database into the dedicated messaging database.
# Schema/migrations must already have been applied to the target
# (DbMigrate update with REAL_ESTATE_EVAL_PG_CONNECTION_STRING_MESSAGING set).
#
# Run after the Valuation copy. Valuation outbox rows stay on the valuation
# database (D5); this script drops any copied valuation.% outbox rows from the
# target so the Case Study dispatcher cannot double-publish them.
#
# Usage from repo root, against the compose Postgres:
#   docker compose -f infra/docker-compose.yml exec -T postgres sh < infra/postgres/copy-messaging-data.sh
#
# Or pass database names:
#   SHARED_DB=realestate_eval_prod TARGET_DB=realestate_eval_prod_messaging \
#     docker compose -f infra/docker-compose.prod.yml exec -T postgres sh < infra/postgres/copy-messaging-data.sh

set -eu

SHARED_DB="${SHARED_DB:-realestate_eval_dev}"
TARGET_DB="${TARGET_DB:-realestate_eval_messaging}"
USER_NAME="${POSTGRES_USER:-postgres}"

echo "Copying messaging data: ${SHARED_DB} -> ${TARGET_DB}"

pg_dump -U "$USER_NAME" -d "$SHARED_DB" \
  --data-only --no-owner --no-privileges \
  --schema=messaging \
  -T 'messaging."__EFMigrationsHistory"' \
  | sed '/SELECT pg_catalog.setval/d' \
  | psql -U "$USER_NAME" -d "$TARGET_DB" -v ON_ERROR_STOP=1

echo "Removing valuation outbox rows from ${TARGET_DB} (owned by the valuation database)"

psql -U "$USER_NAME" -d "$TARGET_DB" -v ON_ERROR_STOP=1 -c \
  "DELETE FROM messaging.\"OutboxMessages\" WHERE \"EventType\" LIKE 'valuation.%'"

echo "Copy complete. After every owner copy, drop leftover databases with infra/postgres/drop-leftover-shared.sh."
