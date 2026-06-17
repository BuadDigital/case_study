# Local infrastructure (Docker Compose)

Run the **platform stack** from the architecture doc: PostgreSQL, RabbitMQ, Redis, Jaeger, Prometheus, Grafana, Elasticsearch, Kibana, and Fluent Bit.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows) or Docker Engine
- At least **6 GB RAM** free for Elasticsearch + Kibana (reduce ES heap in `infra/docker-compose.yml` if needed)

## Start / stop

From the **repository root**:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Stop and keep data:

```bash
docker compose -f infra/docker-compose.yml down
```

Stop and **delete volumes** (fresh databases):

```bash
docker compose -f infra/docker-compose.yml down -v
```

Check status:

```bash
docker compose -f infra/docker-compose.yml ps
```

## Service URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| **PostgreSQL** | `localhost:5432` | user `postgres`, password `Admin`, db `realestate_eval_dev` |
| **RabbitMQ AMQP** | `localhost:5672` | user `dev`, password `dev` |
| **RabbitMQ UI** | http://localhost:15672 | `dev` / `dev` |
| **Redis** | `localhost:6379` | (no auth in dev) |
| **Jaeger UI** | http://localhost:16686 | — |
| **Jaeger OTLP** | `http://localhost:4318` (HTTP), `localhost:4317` (gRPC) | — |
| **Prometheus** | http://localhost:9090 | — |
| **Grafana** | http://localhost:3001 | `admin` / `admin` |
| **Elasticsearch** | http://localhost:9200 | security disabled in dev |
| **Kibana** | http://localhost:5601 | — |

## Connect the backend services

Docker Postgres credentials match `infra/docker-compose.yml` (`postgres` / `Admin`, db `realestate_eval_dev`).

Override in each service via `REAL_ESTATE_EVAL_PG_CONNECTION_STRING`, or edit:

- `backend/services/identity/RealEstateEval.Identity.Api/appsettings.Development.json`
- `backend/services/case-study/RealEstateEval.CaseStudy.Api/appsettings.Development.json`

After `docker compose up -d`:

```bash
npm run dev:api
```

Gateway: http://localhost:5160. See [backend/README.md](../README.md) for individual service commands.

Then start the web app:

```bash
npm run dev
```

## Wire observability (next steps in code)

### Traces → Jaeger

In each ASP.NET service (when you add OpenTelemetry):

- Exporter OTLP endpoint: `http://localhost:4318`
- Propagate header `traceparent` from the Next.js BFF/gateway

### Metrics → Prometheus

- Expose `/metrics` on each API
- Add targets under `infra/prometheus/prometheus.yml`
- View in Grafana (datasources are pre-provisioned)

### Logs → Elasticsearch / Kibana

- Use **Serilog** (or built-in JSON console) in .NET
- Fluent Bit (`ree-fluent-bit`) ships sample logs to index pattern `fluentbit-*`
- In Kibana: **Stack Management → Index patterns** → `fluentbit-*` → Discover

When APIs run in Docker, mount container log paths into Fluent Bit (see comments in `docker-compose.yml`).

### Cache → Redis

Connection string pattern for future services:

```text
localhost:6379
```

### Events → RabbitMQ

Connection string pattern:

```text
amqp://dev:dev@localhost:5672/
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Port `5432` already in use | Stop local PostgreSQL service or change the host port in `docker-compose.yml` |
| Elasticsearch exits (OOM) | Lower `ES_JAVA_OPTS` to `-Xms256m -Xmx256m` or increase Docker memory |
| Kibana not ready | Wait ~60s after first `up`; check `docker compose logs kibana` |
| Grafana empty | Prometheus has no app targets yet — only self-scrape is configured |

## Related docs

- [ARCHITECTURE_MICROFRONTENDS_AND_MICROSERVICES.md](./ARCHITECTURE_MICROFRONTENDS_AND_MICROSERVICES.md) — section 6.1 platform stack roles
- Phase A checklist — gateway + Case Study API (same architecture doc section 7)
