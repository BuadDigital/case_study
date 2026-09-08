#!/usr/bin/env bash
# Verify Fluent Bit → Elasticsearch logging on the production Docker host.
# Infra is already in docker-compose.prod.yml; this only checks it is live.
#
# Usage (on the prod host, from the deploy directory that has compose files):
#   bash scripts/ops/verify-prod-logging.sh
#
# Optional env:
#   ES_URL   default http://127.0.0.1:9200  (use docker network DNS if curling from a container)
#   COMPOSE  default docker compose -f docker-compose.prod.yml

set -euo pipefail

ES_URL="${ES_URL:-http://127.0.0.1:9200}"
COMPOSE="${COMPOSE:-docker compose -f docker-compose.prod.yml}"

echo "=== Containers (elasticsearch + fluent-bit should be Up) ==="
$COMPOSE ps elasticsearch fluent-bit 2>/dev/null \
  || docker ps --filter name=ree-prod-elasticsearch --filter name=ree-prod-fluent-bit --format 'table {{.Names}}\t{{.Status}}'

echo
echo "=== Elasticsearch health ==="
curl -fsS "${ES_URL}/_cluster/health?pretty"

echo
echo "=== Fluent Bit → ES indices (logstash-style fluentbit-*) ==="
curl -fsS "${ES_URL}/_cat/indices/fluentbit*?v&s=index" || {
  echo "No fluentbit-* indices yet. Generate app traffic, wait ~1–2 minutes, re-run."
  exit 1
}

echo
echo "=== Recent document sample (first hit) ==="
curl -fsS "${ES_URL}/fluentbit-*/_search?size=1&sort=@timestamp:desc&pretty" \
  || curl -fsS "${ES_URL}/fluentbit-*/_search?size=1&pretty"

echo
echo "=== Fluent Bit HTTP health (container port 2020, not published by default) ==="
if docker ps --format '{{.Names}}' | grep -qx 'ree-prod-fluent-bit'; then
  docker exec ree-prod-fluent-bit wget -qO- http://127.0.0.1:2020/api/v1/health 2>/dev/null \
    || docker exec ree-prod-fluent-bit curl -fsS http://127.0.0.1:2020/api/v1/health \
    || echo "(Fluent Bit health endpoint not reachable inside container — check fluent-bit logs)"
else
  echo "Container ree-prod-fluent-bit not found"
fi

echo
echo "=== Note ==="
echo "Prod compose ships ES + Fluent Bit. Kibana is local-only (infra/docker-compose.yml)."
echo "For Kibana-like browsing on prod, tunnel ES or temporarily add Kibana; primary check is fluentbit-* docs in ES."
echo "Done."
