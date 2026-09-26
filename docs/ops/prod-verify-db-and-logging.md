# Production verify: DB ownership + logging

These checks run **on the prod host** after deploy — they are not a greenfield setup.

## 1. Separate DB ownership

From the machine that can reach `ree-prod-postgres`:

```bash
docker exec -i ree-prod-postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < scripts/ops/verify-prod-db-ownership.sql
```

**Pass when:**

- Exactly the nine `realestate_eval_prod_*` databases exist
- `Missing expected databases` and `Unexpected realestate_eval databases` are empty
- Owner schemas (`case_study`, `identity`, `valuation`, …) resolve on each DB

Sources of truth: `infra/postgres/init-prod.sql`, `infra/docker-compose.prod.yml` (`REAL_ESTATE_EVAL_PG_CONNECTION_STRING_*`), `docs/DATABASE_OVERVIEW.md`.

## 2. Logging

There is no log store in production: Elasticsearch, Kibana and Fluent Bit were removed (2026-09) to save RAM. Every container logs to Docker's `json-file` driver, rotated at 10 MB × 3 files (`x-logging` in `infra/docker-compose.prod.yml`).

```bash
cd /app
docker compose -f docker-compose.prod.yml logs --tail=200 case-study valuation
docker inspect -f '{{.Name}} {{.HostConfig.LogConfig.Config}}' $(docker ps -q)
```

**Pass when:**

- Recent requests show up in `docker compose logs` for the service that handled them
- Every container reports `map[max-file:3 max-size:10m]`
