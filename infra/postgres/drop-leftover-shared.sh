#!/usr/bin/env sh
# Drop the leftover shared databases. Run only after owner data has been copied
# with infra/postgres/copy-*-data.sh (or when those databases are empty).
#
# Usage from repo root:
#   docker compose -f infra/docker-compose.yml exec -T postgres sh < infra/postgres/drop-leftover-shared.sh
#   docker compose -f infra/docker-compose.prod.yml exec -T postgres sh < infra/postgres/drop-leftover-shared.sh

set -eu

USER_NAME="${POSTGRES_USER:-postgres}"

drop_if_exists() {
  db="$1"
  exists="$(psql -U "$USER_NAME" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '${db}'")"
  if [ "$exists" != "1" ]; then
    echo "No leftover database ${db}."
    return
  fi

  echo "Dropping leftover database ${db}"
  psql -U "$USER_NAME" -d postgres -v ON_ERROR_STOP=1 -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${db}' AND pid <> pg_backend_pid();"
  psql -U "$USER_NAME" -d postgres -v ON_ERROR_STOP=1 -c \
    "DROP DATABASE \"${db}\";"
}

drop_if_exists realestate_eval_dev
drop_if_exists realestate_eval_prod

echo "Leftover shared databases removed."
