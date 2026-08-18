#!/usr/bin/env sh
# One-time copy of valuation rows from the shared database into the dedicated
# valuation database. Schema/migrations must already have been applied to the target
# (DbMigrate update with REAL_ESTATE_EVAL_PG_CONNECTION_STRING_VALUATION set).
#
# Also copies this producer's outbox rows (EventType LIKE 'valuation.%') and parks
# pending copies on the shared database so the Case Study dispatcher cannot
# double-publish after Valuation starts draining its own table.
#
# Usage from repo root, against the compose Postgres:
#   docker compose -f infra/docker-compose.yml exec -T postgres sh < infra/postgres/copy-valuation-data.sh
#
# Or pass database names:
#   SHARED_DB=realestate_eval_prod TARGET_DB=realestate_eval_prod_valuation \
#     docker compose -f infra/docker-compose.prod.yml exec -T postgres sh < infra/postgres/copy-valuation-data.sh

set -eu

SHARED_DB="${SHARED_DB:-realestate_eval_dev}"
TARGET_DB="${TARGET_DB:-realestate_eval_valuation}"
USER_NAME="${POSTGRES_USER:-postgres}"

echo "Copying valuation data: ${SHARED_DB} -> ${TARGET_DB}"

pg_dump -U "$USER_NAME" -d "$SHARED_DB" \
  --data-only --no-owner --no-privileges \
  --schema=valuation \
  -T 'valuation."__EFMigrationsHistory"' \
  | sed '/SELECT pg_catalog.setval/d' \
  | psql -U "$USER_NAME" -d "$TARGET_DB" -v ON_ERROR_STOP=1

echo "Copying valuation outbox rows (EventType LIKE 'valuation.%')"

psql -U "$USER_NAME" -d "$SHARED_DB" -v ON_ERROR_STOP=1 -c \
  "\\copy (SELECT \"Id\", \"AttemptCount\", \"CreatedAtUtc\", \"DeadLetteredAtUtc\", \"Error\", \"EventType\", \"LockedBy\", \"LockedUntilUtc\", \"PayloadJson\", \"ProcessedAtUtc\" FROM messaging.\"OutboxMessages\" WHERE \"EventType\" LIKE 'valuation.%') TO STDOUT" \
  | psql -U "$USER_NAME" -d "$TARGET_DB" -v ON_ERROR_STOP=1 -c \
  "\\copy messaging.\"OutboxMessages\" (\"Id\", \"AttemptCount\", \"CreatedAtUtc\", \"DeadLetteredAtUtc\", \"Error\", \"EventType\", \"LockedBy\", \"LockedUntilUtc\", \"PayloadJson\", \"ProcessedAtUtc\") FROM STDIN"

echo "Parking pending valuation outbox rows on ${SHARED_DB} so Case Study cannot double-publish"

psql -U "$USER_NAME" -d "$SHARED_DB" -v ON_ERROR_STOP=1 -c \
  "UPDATE messaging.\"OutboxMessages\" SET \"ProcessedAtUtc\" = now() WHERE \"EventType\" LIKE 'valuation.%' AND \"ProcessedAtUtc\" IS NULL"

echo "Copy complete. After every owner copy, drop leftover databases with infra/postgres/drop-leftover-shared.sh."
