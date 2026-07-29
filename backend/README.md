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

Migrations live in `RealEstateEval.Infrastructure/Data/Migrations/`.

**Development / `npm run dev:api`:** Case Study applies pending migrations at
startup when `Database:MigrateOnStartup` is true (default in Development via
`appsettings.Development.json`). Demo seed runs only when
`Database:SeedDemoData=true`. Production rejects both settings.

**Production / deploy:** schema changes are applied by the one-shot
`migrate` Compose service (`backend/tools/DbMigrate`), before app containers
start. The deploy workflow runs `docker compose … run --rm migrate`.

```bash
# Create a migration
dotnet ef migrations add <Name> \
  --project backend/RealEstateEval.Infrastructure \
  --startup-project backend/services/case-study/RealEstateEval.CaseStudy.Api

# Apply (local tool or migrate container)
dotnet run --project backend/tools/DbMigrate
# or: docker compose -f infra/docker-compose.yml --profile migrate run --rm migrate

# List applied / pending
dotnet run --project backend/tools/DbMigrate -- list

# Rollback to a named migration (or 0 for empty schema)
dotnet run --project backend/tools/DbMigrate -- rollback <MigrationName>
# Prod example:
# docker compose -f infra/docker-compose.prod.yml run --rm migrate rollback <MigrationName>
```

Rollback keeps the database at the target migration (EF migrates *down* to that
point). Take a Postgres dump before production rollbacks. Re-deploy the app
image that matches the rolled-back schema.

## Docker (full API stack)

```bash
docker compose -f infra/docker-compose.yml up -d postgres rabbitmq redis identity case-study operations reporting financial valuation failures platform attachments gateway
```

Gateway: `http://localhost:5160`

## Production secrets

Production Compose intentionally has no fallback credentials. It refuses to
render or start until these variables are explicitly provided:

| Variable | Requirement |
|----------|-------------|
| `POSTGRES_PASSWORD` | Strong, unique database password |
| `RABBITMQ_USER` | Dedicated service account; cannot be `dev` |
| `RABBITMQ_PASSWORD` | At least 16 characters; cannot be `dev` |
| `JWT_SIGNING_KEY` | At least 64 characters; cannot contain `CHANGE_ME` or `DEV_ONLY` |
| `GRAFANA_ADMIN_PASSWORD` | Grafana admin password (UI is internal-only) |
| `IMAGE_OWNER` | GHCR organization or username |
| `TAG` | Immutable image tag; the deployment workflow uses a commit SHA |

On the production host:

```bash
cp infra/production.env.example infra/.env
# Fill every empty value, then validate without starting containers:
docker compose --env-file infra/.env -f infra/docker-compose.prod.yml config --quiet
# Migrate schema, then start (migrate is also a depends_on of app services):
docker compose --env-file infra/.env -f infra/docker-compose.prod.yml run --rm migrate
docker compose --env-file infra/.env -f infra/docker-compose.prod.yml up -d
```

`infra/.env` is ignored by Git and must never be committed. Store and rotate
the same values through the deployment host's secret-management mechanism.
Outside Development, every API also rejects missing, short, or placeholder JWT
keys at startup. RabbitMQ-enabled services reject development credentials.

JWT signing keys live only in `appsettings.Development.json` (and Compose env
for local Docker). Base `appsettings.json` files carry Issuer/Audience only —
Production must supply `JWT_SIGNING_KEY` / `Jwt:SigningKey` explicitly.

Username-picker login (`/api/auth/dev-login-users`, `/api/auth/login-username`)
requires **both** `ASPNETCORE_ENVIRONMENT=Development` **and**
`Auth:EnableDevLogin=true`. Otherwise those endpoints return 404. Prefer
`POST /api/auth/login` accepts email (preferred by the UI) or username plus password.
Local seed accounts use the password set on each `HrStaffSeed` / `ProcProviderSeed`
record (`user1234`). Demo seeding is rejected in Production and the normal production
password policy remains unchanged.

### Session tokens

Login returns a short-lived access token plus an opaque refresh token:

| Setting | Default | Meaning |
| --- | --- | --- |
| `Jwt:AccessTokenMinutes` | 15 | Access-token lifetime; capabilities are baked in, so keep it short |
| `Jwt:RefreshTokenHours` | 12 | Absolute session length; rotation does not extend it |

- `POST /api/auth/refresh` swaps a refresh token for a new pair and re-reads roles,
  capabilities, and account status, so permission changes and deactivations take
  effect within the access-token lifetime instead of lasting a whole session.
- `POST /api/auth/logout` revokes the whole session family behind a refresh token.
- Only SHA-256 hashes are stored (`identity.RefreshTokens`). Each refresh rotates the
  token; replaying a rotated token more than 60 seconds later revokes the family,
  while replays inside that window are treated as a benign multi-tab race.
- Access tokens themselves are not individually revocable. Anything that must cut
  access immediately should call `IAuthSessionService.RevokeAllForUserAsync` and rely
  on the short access-token window.

## HTTP security (shared pipeline)

`UseRealEstateEvalServicePipeline` (all nine services) and
`UseRealEstateEvalGatewayPipeline` apply the same order: global exception handler →
security headers → compression → correlation id → HTTPS redirection (outside
Development) → CORS → rate limiter → authentication/authorization. Authentication stays
in the services; the gateway deliberately does not authenticate.

### Rate limiting (`RateLimiting`)

Each process registers one global partitioned limiter keyed on the caller's address, so
every service is throttled by the shared pipeline without per-controller attributes.
Authentication endpoints draw on a much smaller budget than the rest of the API.

| Key | Development | Other environments | Meaning |
| --- | --- | --- | --- |
| `RateLimiting:Enabled` | `true` | `true` | `false` leaves the middleware out entirely |
| `RateLimiting:Global:PermitLimit` | `10000` | `600` | Requests per window, per caller |
| `RateLimiting:Global:WindowSeconds` | `60` | `60` | Fixed window length (1–3600) |
| `RateLimiting:Global:QueueLimit` | `0` | `0` | Queued requests; `0` rejects immediately |
| `RateLimiting:Auth:PermitLimit` | `1000` | `10` | Budget for `AuthPathPrefixes` |
| `RateLimiting:Auth:WindowSeconds` / `QueueLimit` | `60` / `0` | `60` / `0` | As above |
| `RateLimiting:AuthPathPrefixes` | `/api/auth/login`, `/api/auth/login-username`, `/api/auth/refresh`, `/api/auth/dev-login-users` | same | Strict-budget paths |
| `RateLimiting:ExemptPathPrefixes` | `/health`, `/ready` | same | Never throttled, so healthchecks and post-deploy smoke checks cannot trip limits |
| `RateLimiting:ClientAddressHeaderName` | `X-Real-IP` | same | Caller address published by the ingress proxy |
| `RateLimiting:TrustForwardedForHeader` | `true` | same | Fall back to the right-most `X-Forwarded-For` entry |

Rejected requests get `429` with the same Problem Details shape as the global exception
handler (`type`, `title`, `status`, `detail`, `traceId`, `application/problem+json`) plus
`Retry-After`. CORS preflights are charged to the default budget, never the auth budget.

Development budgets are deliberately wide: the Next.js dev proxy and the Playwright
suite all reach the gateway from one loopback address and therefore share a partition.

**Caller attribution.** Proxy hop counts differ per deployment, so nothing counts
`X-Forwarded-For` entries. nginx sets `X-Real-IP`, and the gateway overwrites it on every
proxied request with the caller it resolved; services trust that header first and fall
back to `X-Forwarded-For`, then the socket peer. This assumes services and the gateway
are only reachable through the ingress chain — production Compose publishes ports for
nginx only.

### Security headers (`SecurityHeaders`)

| Key | Default | Notes |
| --- | --- | --- |
| `SecurityHeaders:Enabled` | `true` | |
| `SecurityHeaders:ContentSecurityPolicy` | `default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` | API responses are JSON and embed nothing |
| `SecurityHeaders:DocumentationContentSecurityPolicy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` | Swagger UI |
| `SecurityHeaders:DocumentationPathPrefixes` | `/swagger` | Paths that get the documentation policy |
| `SecurityHeaders:FrameOptions` | `DENY` | Empty string omits the header |
| `SecurityHeaders:ReferrerPolicy` | `no-referrer` | |
| `SecurityHeaders:PermissionsPolicy` | device features disabled | |
| `SecurityHeaders:Hsts:Enabled` | `true` outside Development | Only emitted on HTTPS requests |
| `SecurityHeaders:Hsts:MaxAgeSeconds` | `31536000` | |
| `SecurityHeaders:Hsts:IncludeSubDomains` / `Preload` | `true` / `false` | `Preload` requires `IncludeSubDomains` |
| `SecurityHeaders:TrustForwardedProtoHeader` | `true` | Lets HSTS work behind a TLS-terminating proxy |

`X-Content-Type-Options: nosniff` is always sent. Headers are applied on response start,
so they survive the exception handler's `Response.Clear()`.

Swagger UI keeps working because its own policy is scoped to `/swagger`: Swashbuckle
serves every script and stylesheet as a same-origin file (so `script-src 'self'` is
enough) while its React components set inline `style` attributes (so `style-src` needs
`'unsafe-inline'`). Enabling Swagger's OAuth2 redirect page would additionally need
inline script allowed there. `SwaggerUiContentSecurityPolicyTests` fails if a
Swashbuckle upgrade introduces an inline script or a cross-origin asset.

HSTS and HTTPS redirection are honest about the current topology: TLS terminates at
nginx, which speaks plain HTTP on `:80`, so no `Strict-Transport-Security` is emitted
and `UseHttpsRedirection` stays inert until an HTTPS port exists. Once nginx serves TLS
and forwards `X-Forwarded-Proto: https`, HSTS starts flowing with no code change.

### CORS (`Cors`)

| Key | Default | Meaning |
| --- | --- | --- |
| `Cors:AllowedOrigins` | empty | Explicit `scheme://host[:port]` origins; `*` is rejected |
| `Cors:AllowCredentials` | `false` | Never combined with a wildcard |
| `Cors:RequireAllowedOrigins` | `false` | When `true`, a non-Development process refuses to start with an empty list |

Development additionally allows any host on ports `3000`/`3001` so teammates can browse
the dev shell over the LAN. Outside Development the list is the only source of truth; an
empty list denies every cross-origin browser request and logs a `Critical` line at
startup. That is the correct default for the production topology, where the browser talks
to nginx and `/api/` is proxied to the gateway from the same origin, so no CORS
negotiation happens at all.

### Gateway readiness (`Gateway:Readiness`)

`GET /health` on the gateway stays pure liveness. `GET /ready` probes each required YARP
cluster's first destination and returns `503` with a per-cluster breakdown unless all of
them answer their liveness endpoint.

| Key | Default | Meaning |
| --- | --- | --- |
| `Gateway:Readiness:Enabled` | `true` | `false` makes `/ready` report gateway liveness only |
| `Gateway:Readiness:TimeoutSeconds` | `2` | Per-upstream probe timeout (1–30) |
| `Gateway:Readiness:CacheSeconds` | `5` | Result reuse, so frequent polling does not fan out (0–300) |
| `Gateway:Readiness:UpstreamHealthPath` | `/health` | Probed path on each upstream |
| `Gateway:Readiness:RequiredClusters` | empty | Empty means every configured cluster |

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

Reporting's upstream `HttpClient` uses a bounded resilience pipeline. Configure it under
`ReportingHttpResilience` with `TotalTimeoutSeconds`, `AttemptTimeoutSeconds`,
`RetryCount`, `RetryDelayMilliseconds`, `CircuitBreakerFailureRatio`,
`CircuitBreakerMinimumThroughput`, `CircuitBreakerSamplingSeconds`, and
`CircuitBreakerBreakSeconds`. Retries apply only to transient failures from safe HTTP
methods; reporting currently issues GET requests. Invalid timeout or circuit-breaker
settings fail fast during startup.

## CI

GitHub Actions: `.github/workflows/deploy.yml` builds and tests
`backend/RealEstateEval.slnx` before publishing images and deploying them.

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
| `messaging`   | Outbox messages, consumer inbox          |


Constants: `RealEstateEval.Infrastructure/Data/DatabaseSchemas.cs`. EF maps each entity via `ToTable(name, schema)`.

### Optimistic concurrency

Mutable workflow/state rows use PostgreSQL's system `xmin` column as an EF Core
row-version token. Updates and tracked deletes therefore include the version loaded by the
request; if another request changed the same row first, EF throws
`DbUpdateConcurrencyException` instead of overwriting it.

The global exception middleware returns HTTP `409 Conflict` with Problem Details for these
races. Clients should reload the record, reapply the user's intended change, and retry.
Maintenance/reset `ExecuteDelete` operations deliberately bypass row-level concurrency.

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

### Delivery guarantees

Writers stage events into `messaging.OutboxMessages` in the same transaction as the domain
change. The dispatcher (case-study only) then delivers them **at least once**:

- **Claiming.** Each batch takes a two-minute lease using `FOR UPDATE SKIP LOCKED`, so
  multiple replicas claim disjoint rows instead of publishing the same event twice. A
  dispatcher that dies mid-batch has its rows reclaimed once the lease lapses.
- **Broker down or disabled.** Rows stay pending. With `RabbitMQ:Enabled=false` the
  dispatcher does not run at all, so events are never silently dropped, and an unreachable
  broker refunds the attempt so an outage cannot dead-letter healthy events.
- **Poison messages.** After 10 failed attempts a row gets `DeadLetteredAtUtc` and stops
  being retried. Clear that column to requeue it.

Consumers deduplicate through `messaging.ProcessedIntegrationEvents`, keyed by consumer name
plus envelope id: a claim is taken before handling and released if handling fails, so a
redelivery is either skipped or retried but never applied twice. Each work queue has a
`<queue>.dead-letter` companion, and a message is requeued at most once before being
dead-lettered.

Because RabbitMQ queue arguments are immutable, queues created before dead-lettering existed
keep working but log a warning at startup; delete the queue once to pick up the new topology.

All services export **traces and metrics** via OTLP (default `http://localhost:4317`).
In Compose, that endpoint is the **OpenTelemetry Collector**, which forwards
traces to Jaeger and exposes Prometheus metrics on `:8889` (scraped by Prometheus).
Services do **not** expose a Prometheus `/metrics` HTTP endpoint.

| Endpoint                  | Purpose                                |
|---------------------------|----------------------------------------|
| `GET /health`             | Liveness                               |
| `GET /ready`              | DB connectivity (domain services); upstream cluster probe (gateway) |
| `X-Correlation-Id` header | Returned on every response             |

Override: `OpenTelemetry:OtlpEndpoint` or env `OTEL_EXPORTER_OTLP_ENDPOINT`.
Local UIs: Jaeger [http://localhost:16686](http://localhost:16686), Prometheus
[http://localhost:9090](http://localhost:9090), Grafana
[http://localhost:3001](http://localhost:3001) (provisioned dashboard
**Real Estate Eval — Service Overview**). Fluent Bit tails Docker json-file
logs into Elasticsearch (`fluentbit-*` in Kibana).

Requires `docker compose … rabbitmq` for integration events; both **valuation** + **case-study** must be running.