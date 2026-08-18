#!/usr/bin/env sh
# One-time copy of Case Study–owned case_study tables from the shared database into the
# dedicated case-study database. Excludes D1 inspector-fee tables (Financial) and D2
# operations task tables (Operations), which are copied by those owner scripts.
# Schema/migrations must already have been applied to the target
# (DbMigrate update with REAL_ESTATE_EVAL_PG_CONNECTION_STRING_CASESTUDY set).
#
# Usage from repo root, against the compose Postgres:
#   docker compose -f infra/docker-compose.yml exec -T postgres sh < infra/postgres/copy-case-study-data.sh
#
# Or pass database names:
#   SHARED_DB=realestate_eval_prod TARGET_DB=realestate_eval_prod_case_study \
#     docker compose -f infra/docker-compose.prod.yml exec -T postgres sh < infra/postgres/copy-case-study-data.sh

set -eu

SHARED_DB="${SHARED_DB:-realestate_eval_dev}"
TARGET_DB="${TARGET_DB:-realestate_eval_case_study}"
USER_NAME="${POSTGRES_USER:-postgres}"

echo "Copying case-study data: ${SHARED_DB} -> ${TARGET_DB}"

pg_dump -U "$USER_NAME" -d "$SHARED_DB" \
  --data-only --no-owner --no-privileges \
  --schema=case_study \
  -T 'case_study."__EFMigrationsHistory"' \
  -T 'case_study."OperationsTasks"' \
  -T 'case_study."OperationsTaskSequences"' \
  -T 'case_study."InspectorFeeLedgers"' \
  -T 'case_study."InspectorFeeTransitions"' \
  -T 'case_study."DisbursementBatches"' \
  | sed '/SELECT pg_catalog.setval/d' \
  | psql -U "$USER_NAME" -d "$TARGET_DB" -v ON_ERROR_STOP=1

echo "Copy complete. After every owner copy, drop leftover databases with infra/postgres/drop-leftover-shared.sh."
