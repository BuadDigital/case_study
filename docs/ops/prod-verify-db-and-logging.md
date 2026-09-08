# Production verify: DB ownership + logging (ES / Fluent Bit)

Infra is already coded (`init-prod.sql`, per-service connection strings, Fluent Bit → Elasticsearch in `infra/docker-compose.prod.yml`). These checks run **on the prod host** after deploy — they are not a greenfield setup.

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

## 2. Logging → Elasticsearch (Fluent Bit)

On the prod host (compose project directory):

```bash
bash scripts/ops/verify-prod-logging.sh
```

If Elasticsearch is only on the Docker network:

```bash
docker exec ree-prod-elasticsearch curl -fsS http://127.0.0.1:9200/_cluster/health?pretty
docker exec ree-prod-elasticsearch curl -fsS 'http://127.0.0.1:9200/_cat/indices/fluentbit*?v'
```

**Pass when:**

- `ree-prod-elasticsearch` and `ree-prod-fluent-bit` are Up
- Cluster health is `green` or `yellow`
- At least one `fluentbit-*` index exists with recent documents after app traffic

**Kibana:** present in local `infra/docker-compose.yml` only. Prod verify = ES indices via Fluent Bit; add Kibana or an SSH tunnel if you need a UI.

Config: `infra/fluent-bit/fluent-bit.conf` (`Logstash_Prefix fluentbit` → `fluentbit-*` indices).
