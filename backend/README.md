# Backend — microservices

The platform runs as an **API gateway** plus **domain services** (shared Postgres stepping stone).

## Layout

```text

backend/

├── gateway/RealEstateEval.Gateway/              # YARP — public :5160

├── services/

│   ├── identity/RealEstateEval.Identity.Api/        # Auth + Users (:5161)

│   ├── case-study/RealEstateEval.CaseStudy.Api/     # PO, workflow, forms, system (:5162)

│   ├── operations/RealEstateEval.Operations.Api/    # Survey offices, property keys (:5163)

│   ├── reporting/RealEstateEval.Reporting.Api/      # Dashboard BFF (:5164)

│   ├── financial/RealEstateEval.Financial.Api/      # Financial summary (:5165)

│   ├── valuation/RealEstateEval.Valuation.Api/      # VR list, evaluator recalls (:5166)

│   ├── failures/RealEstateEval.Failures.Api/        # Failures + failure-types catalog (:5167)

│   ├── platform/RealEstateEval.Platform.Api/        # Field dict, courts, custom screens, info-roles (:5168)

│   └── attachments/RealEstateEval.Attachments.Api/  # File blobs (:5169)

├── shared/RealEstateEval.Shared.{Contracts,Web}/

├── RealEstateEval.{Domain,Application,Infrastructure}/

```

## Gateway routes

| Path | Service |

|------|---------|

| `/api/auth/*`, `/api/users/*`, `/api/permissions` | Identity |

| `/api/survey-offices/*`, `/api/property-keys/*` | Operations |

| `/api/valuation-requests/*`, `/api/evaluator-recalls/*` | Valuation |

| `/api/reporting/*` | Reporting |

| `/api/financial/*` | Financial |

| `/api/failures/*`, `/api/failure-types-catalog/*` | Failures |

| `/api/field-dictionary/*`, `/api/courts/*`, `/api/custom-assigned-screens/*`, `/api/case-study-info-roles/*` | Platform |

| `/api/attachments/*` | Attachments |

| `/api/*` (catch-all) | Case Study |

## Local development

```bash

docker compose -f infra/docker-compose.yml up -d postgres rabbitmq redis

npm run dev:api    # all 9 services + gateway

npm run dev        # Next.js shell

```

Individual services: `dev:identity`, `dev:case-study`, `dev:operations`, `dev:reporting`, `dev:financial`, `dev:valuation`, `dev:failures`, `dev:platform`, `dev:attachments`, `dev:gateway`.

## EF migrations

Migrations live in `RealEstateEval.Infrastructure/Data/Migrations/`. Applied automatically when **Case Study** starts (dev or Docker).

```bash

dotnet ef migrations add <Name> \

  --project backend/RealEstateEval.Infrastructure \

  --startup-project backend/services/case-study/RealEstateEval.CaseStudy.Api

```

## Docker (full API stack)

```bash

docker compose -f infra/docker-compose.yml up -d postgres rabbitmq redis identity case-study operations reporting financial valuation failures platform attachments gateway

```

Gateway: `http://localhost:5160`

## Remaining toward full microservices

- Separate physical databases per service in production (per-service connection strings are wired; dev still shares one DB)
- Contract tests + load tests on gateway
- Decommission remaining frontend prototype storage/constants

## Per-service connection strings

Each service resolves `ConnectionStrings:{ServiceName}` first, then `REAL_ESTATE_EVAL_PG_CONNECTION_STRING_{SERVICENAME}`, then the shared default.


| Service    | Key                                                       |
| ---------- | --------------------------------------------------------- |
| Identity   | `ConnectionStrings:Identity`                              |
| Case Study | `ConnectionStrings:CaseStudy`                             |
| Operations | `ConnectionStrings:Operations`                            |
| …          | See `ServiceDatabaseNames` in `RealEstateEval.Shared.Web` |


In dev, all keys may point at `realestate_eval_dev`. In prod, point each at its own database.

## OpenAPI (Swagger)

Available in **Development** and **Docker** at `http://localhost:{port}/swagger` per service (e.g. Identity `:5161/swagger`, Reporting `:5164/swagger`).

## Reporting BFF

Reporting no longer reads Postgres directly. It calls upstream HTTP APIs (forwards the user JWT):


| Data                            | Upstream                                          |
| ------------------------------- | ------------------------------------------------- |
| Valuation requests              | `GET /api/valuation-requests`                     |
| Workflow tasks, property counts | `GET /api/workflow-tasks`, `GET /api/work-orders` |
| Failure count                   | `GET /api/failures`                               |


Config: `UpstreamServices:GatewayBaseUrl` (local dev), or per-service URLs in Docker (`CaseStudyBaseUrl`, `ValuationBaseUrl`, `FailuresBaseUrl`).

## CI

GitHub Actions: `.github/workflows/backend-ci.yml` — `dotnet build` on `backend/RealEstateEval.slnx`.

## Frontend permissions

Shell loads `GET /api/permissions` after login. Sidebar `pages` and `hasCapability()` / `isSuperAdmin()` use API `capabilities` — no client-side role switcher.

## Schema-per-service (PostgreSQL)

One database (`realestate_eval_dev`) with **domain schemas** as a stepping stone to DB-per-service:


| Schema        | Tables                                   |
| ------------- | ---------------------------------------- |
| `identity`    | Users, roles, profiles                   |
| `case_study`  | Work orders, workflow, forms, PO drafts  |
| `platform`    | Field dictionary, courts, custom screens |
| `failures`    | Property failures, failure-types catalog |
| `operations`  | Survey offices, property keys            |
| `valuation`   | Valuation requests, evaluator recalls    |
| `attachments` | File attachment metadata                 |
| `financial`   | Financial report config                  |
| `messaging`   | Outbox messages                          |


Constants: `RealEstateEval.Infrastructure/Data/DatabaseSchemas.cs`. EF maps each entity via `ToTable(name, schema)`.

## Redis caching

`docker compose … redis` (port `6379`). Registered via `AddRedisCaching` in `AddPersistence`.


| Key                            | Endpoint                          | TTL                          |
| ------------------------------ | --------------------------------- | ---------------------------- |
| `reporting:dashboard:v1`       | `GET /api/reporting/v1/dashboard` | 60s                          |
| `financial:summary:v1`         | `GET /api/financial/v1/summary`   | 60s (invalidated on PUT)     |
| `operations:survey-offices:v1` | `GET /api/survey-offices`         | 120s (invalidated on writes) |
| `platform:courts:v1`           | `GET /api/courts`                 | 5m (invalidated on PUT)      |


Config: `Redis:Enabled`, `Redis:ConnectionString` (Docker: `Redis__ConnectionString=redis:6379`). Set `Redis:Enabled` to `false` to bypass cache (in-memory fallback for `IDistributedCache` only when disabled).

## Permissions API


| Endpoint                                   | Description                                 |
| ------------------------------------------ | ------------------------------------------- |
| `GET /api/permissions`                     | Pages + capabilities for the signed-in user |
| `GET /api/auth/me?includePermissions=true` | Profile + permissions                       |


Roles come from Identity (`CDO`, `HrAdmin`, …) and optional `UserProfile.PermissionLevel` (prototype role id).

## Blob storage (attachments)

Files are stored under `data/blobs/` at repo root (local provider). DB keeps metadata + `StorageKey` only.

## Integration events (outbox + RabbitMQ)


| Event                           | Trigger                                           |
| ------------------------------- | ------------------------------------------------- |
| `valuation.request.created.v1`  | `POST /api/valuation-requests`                    |
| `valuation.report.submitted.v1` | `POST /api/valuation-requests/{id}/submit-report` |


Case Study consumer completes `property-appraisal` tasks on report submitted; logs on request created.

All services export **traces and metrics** via OTLP (default `http://localhost:4317` → Jaeger in docker compose).


| Endpoint                  | Purpose                                |
| ------------------------- | -------------------------------------- |
| `GET /health`             | Liveness                               |
| `GET /ready`              | DB connectivity (domain services only) |
| `X-Correlation-Id` header | Returned on every response             |


Override: `OpenTelemetry:OtlpEndpoint` or env `OTEL_EXPORTER_OTLP_ENDPOINT`. Jaeger UI: [http://localhost:16686](http://localhost:16686)

Requires `docker compose … rabbitmq` for integration events; both **valuation** + **case-study** must be running.