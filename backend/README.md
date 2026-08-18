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

### Route versioning

The public API uses a compatibility-first URL convention:

- Unversioned `/api/...` routes are the canonical current contract and mean **v1**.
- Controllers declare only the canonical template. `CanonicalV1AliasConvention` (wired
  in `AddRealEstateEvalApiHost`) registers a `/v1` compatibility alias for every
  unversioned `api/...` MVC route — for example `/api/financial/summary` and
  `/api/financial/v1/summary`, or `/api/valuation-requests/{id}/...` and
  `/api/valuation-requests/v1/{id}/...`.
- The gateway forwards both forms to the same service, and clients may migrate to the
  canonical form independently. Existing frontend callers are not forced to change.
- Do **not** add Asp.Versioning for v1, and do not put a `/v1` segment on new controller
  `[Route]` / `[Http*]` attributes. A breaking v2 must use an explicit `/v2` route (or
  adopt `Asp.Versioning` across the affected service) while leaving the unversioned v1
  contract and `/v1` aliases operational for the documented compatibility window.

There is no header or query-string version negotiation.

### Contract type names

JSON property names are the public contract. C# (and mirrored TypeScript) type names are
not. New types in `RealEstateEval.Application.Contracts` use:

| Kind | Suffix | Example |
|------|--------|---------|
| Read / response model | `Dto` | `WorkOrderDto`, `LoginResponseDto` |
| Command body | `Request` | `CreateWorkOrderRequest` |
| GET query object | `Query` | `ComparablePropertyListQuery` |
| Nested write fragment | `Input` | `PhotoMetadataInput` |
| Internal actor (not HTTP) | `Actor` | `CaseStudyFormActor` |

Do not introduce a bare `Response` or `Result` suffix for HTTP payloads — use `ResponseDto`.
Do not rename JSON properties to finish a C# rename; that would be a v2.

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

Rolling back the newest migration and re-applying it is covered by
`RealEstateEval.Api.ContainerTests`. Rolling all the way back to `0` currently fails:
reverting far enough re-creates the `IX_PartyFeePricingTables_OneActive` unique index while
rows inserted by earlier migrations still violate it. Recreate the database instead of
rolling back to an empty schema until that is fixed.

## Docker (full API stack)

```bash
docker compose -f infra/docker-compose.yml up -d postgres rabbitmq redis identity case-study operations reporting financial valuation failures platform attachments gateway
```

Gateway: `http://localhost:5160`

## Tests

```bash
dotnet test backend/RealEstateEval.slnx
```

| Project | Covers | Needs |
| --- | --- | --- |
| `RealEstateEval.Application.Tests` | Domain rules, mappers, and services over the in-memory provider | — |
| `RealEstateEval.Architecture.Tests` | Project-reference and layering rules | — |
| `RealEstateEval.Api.IntegrationTests` | Real service pipelines: authentication, capability policies, rate limiting, security headers, correlation ids, readiness options | — |
| `RealEstateEval.Api.ContainerTests` | Throwaway Postgres, RabbitMQ, and Redis containers: migrations, demo seeding, `/ready`, outbox delivery and dead-lettering, Redis-backed cache | Docker |

Container tests skip themselves when no Docker daemon is reachable, so the suite
stays green on a workstation without Docker. Force the decision either way with
`REAL_ESTATE_EVAL_CONTAINER_TESTS=1` or `=0`.

The integration tests never reach a database: they assert what the pipeline decides
before a handler touches storage. Anything that needs real SQL belongs in the container
project. Factories pass configuration as host settings rather than environment variables,
because a mutated process environment leaks into every other test in the run.

### Coverage

```bash
dotnet test backend/RealEstateEval.slnx \
  --settings backend/coverlet.runsettings --collect:"XPlat Code Coverage"
```

Generated EF migrations are excluded — they are larger than the entire hand-written
codebase and drown the percentage. `Threshold` in the runsettings is a regression floor
below today's numbers, not a target; raise it as coverage grows. Enable container tests
when collecting coverage, otherwise the skipped project reports 0% and trips the floor.
CI runs this on every push and pull request, prints a per-report table in the job
summary, and uploads the Cobertura reports as the `backend-coverage` artifact.

## Demo-user reseed tool

`backend/scripts/reseed-ahmed-tool` (`ReseedAhmed`) restores demo HR and procurement
accounts — password and profile fields — without wiping anything else. It must run from the
repository root, because it reads the Identity service's `appsettings*.json` for the
connection string; the wrappers handle that:

```bash
node backend/scripts/reseed-ahmed.mjs      # the ahmed demo login
node backend/scripts/reseed-all-users.mjs  # every demo account
```

The project is part of `RealEstateEval.slnx`, so it builds with the solution and stops
drifting out of sync with the entities it seeds.

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

### Staff account activation

`POST /api/users` creates the account **without a password** and never returns a
credential. The response is `{ user, userName, activationRequired: true }`; until the
account is activated, `PasswordHash` is null and every password login attempt fails.

Handing over the account is a separate, explicitly authorized step:

1. `POST /api/users/{id}/activation-ticket` (`CanManageUsers`) mints a single-use
   activation ticket — an Identity password-reset token, `Cache-Control: no-store`,
   valid for 24 hours (`DataProtectionTokenProviderOptions.TokenLifespan`). Issuing is
   logged. The ticket is not a password: it cannot be used to sign in.
2. The administrator delivers the ticket out of band, and the holder redeems it at
   `POST /api/auth/activate` (anonymous, auth rate-limit budget) with the username and
   their chosen password. Redeeming rotates the security stamp, so a ticket works once.

Activation answers with one opaque message for unknown users, forged tickets, and
expired tickets alike, so the endpoint cannot be used to enumerate accounts. Only
password-policy failures are reported specifically — the caller already proved
possession of the ticket, so that detail leaks nothing.

The shell serves the redemption form at `/activate` (a public route in `apps/shell`).
Re-issuing a ticket for an existing user is available from the users list in settings;
it does not invalidate the current password.

## HTTP security (shared pipeline)

`UseRealEstateEvalServicePipeline` (all nine services) and
`UseRealEstateEvalGatewayPipeline` apply the same order: global exception handler →
security headers → compression → correlation id → HTTPS redirection (outside
Development) → CORS → rate limiter → authentication/authorization. Authentication stays
in the services; the gateway deliberately does not authenticate.

### Error responses

Failures answer with RFC 7807 `application/problem+json` (`type`, `title`, `status`,
`detail`, `traceId`) — from model binding, from the rate limiter, from the global
exception handler, and from hand-written controller failures via
`ApiProblemExtensions` (`BadRequestProblem`, `NotFoundProblem`, `ConflictProblem`,
`UnauthorizedProblem`, `ForbiddenProblem`, `GoneProblem`, `FieldErrorsProblem`). Those
helpers also copy the message into `error` and `message` extension members (and field
maps into `errors`), which serialize as top-level properties, so front-end callers
written against the older `{ error }` / `{ message }` / `{ errors }` shapes keep working.

`detail` is always a message written for the caller. Exception text stays in the log:
handled failures log the exception and answer with a fixed sentence, and the global
handler only echoes `ex.Message` in Development. Hand-written controller failures go
through the helpers; do not return anonymous `{ error }` / `{ message }` bodies.

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
| `RateLimiting:AuthPathPrefixes` | `/api/auth/login`, `/api/auth/login-username`, `/api/auth/refresh`, `/api/auth/dev-login-users`, `/api/auth/activate` | same | Strict-budget paths |
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

TLS terminates at nginx, which serves `:443` from the host certificate and redirects
`:80` with a `308`. The application containers never see the private key. Because the
proxy forwards `X-Forwarded-Proto: https` and `ASPNETCORE_FORWARDEDHEADERS_ENABLED` is
on, `UseHttpsRedirection` and the HSTS gate both treat proxied requests as HTTPS.
nginx owns the `Strict-Transport-Security` header on public responses and strips the
copy coming back from the gateway, so a browser never receives it twice. The middleware
still emits it for a service reached directly on the private network.

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

### Service readiness (`Readiness`)

Domain services answer `/ready` from their database: reachable, and migrated. A probe
failure is logged with the exception (a pending-migration verdict at `Error`, an
unreachable database at `Warning`) instead of being reduced to a bare `503`, and the body
names the reason so an orchestrator's logs are enough to tell the two apart.

| Key | Development | Other environments | Meaning |
| --- | --- | --- | --- |
| `Readiness:CheckMigrations` | `false` | `true` | Report not-ready while migrations are pending |
| `Readiness:CheckRabbit` | `false` | `false` | Soft TCP to RabbitMQ; body `rabbit`; never flips HTTP 503 |
| `Readiness:CheckRedis` | `false` | `false` | Soft TCP to Redis; body `redis`; never flips HTTP 503 |
| `Readiness:CacheSeconds` | `5` | `5` | Result reuse, so frequent probes do not query per request (0–300) |

```json
{ "status": "not_ready", "service": "financial", "database": "migrations_pending", "pendingMigrations": 3 }
```

`database` is `ready`, `unreachable`, or `migrations_pending`. Soft `rabbit` / `redis` values are
`reachable`, `unreachable`, `disabled`, `not_configured`, or omitted (`null`) when the check is
off. Case Study and Platform Development turn both probes on; Financial and Operations
Development turn Redis on. The migration check is off in Development because each dedicated
owner database is migrated by DbMigrate or the first host that owns that stream, so
`npm run dev:api` would otherwise wait on a condition that never applies to a deployment
— the deploy workflow runs the `migrate` job before app containers start.

Reporting holds no schema of its own, so it maps `MapStatelessReady`: it is ready once it is
listening, and its upstreams are covered by the gateway's readiness probe.

## Remaining toward full microservices

- Phase 3 residual readers still open owner contexts over a second connection
- Contract tests + load tests on gateway
- Decommission remaining frontend prototype storage/constants

## Architecture guardrails

`RealEstateEval.Architecture.Tests` enforces the decomposition gates in
[`docs/architecture-split-plan.md`](../docs/architecture-split-plan.md). It reads two files:
`docs/architecture/table-ownership.json` (one write owner per table) and
`docs/architecture/boundary-baseline.json` (the coupling that exists today). Baseline entries
are a ceiling: removing cross-schema access always passes, adding it fails until the baseline
is updated in the same change.

The tests cover project-reference direction, references to the shared
`Application`/`Infrastructure`/`Domain` assemblies, per-API and per-file schema reach, how many
processes register each persistence service, cross-schema foreign keys and navigations, model
versus migration-snapshot drift, and the single migration stream.

```bash
dotnet test backend/RealEstateEval.Architecture.Tests

# After an approved boundary change, regenerate and review the diff:
REE_ARCH_BASELINE=update dotnet test backend/RealEstateEval.Architecture.Tests
```

## Per-service connection strings

Each service requires `ConnectionStrings:{ServiceName}` or `REAL_ESTATE_EVAL_PG_CONNECTION_STRING_{SERVICENAME}`. There is no leftover shared default.

| Service    | Key                                                       |
| ---------- | --------------------------------------------------------- |
| Identity   | `ConnectionStrings:Identity`                              |
| Case Study | `ConnectionStrings:CaseStudy`                             |
| Operations | `ConnectionStrings:Operations`                            |
| Attachments | `ConnectionStrings:Attachments` / `REAL_ESTATE_EVAL_PG_CONNECTION_STRING_ATTACHMENTS` |
| …          | See `ServiceDatabaseNames` in `RealEstateEval.Shared.Web` |

**Phase 4:** dedicated databases for every extracted owner (`realestate_eval_attachments`, `_identity`, `_platform`, `_valuation`, `_failures`, `_operations`, `_financial`, `_case_study`, `_messaging`; prod names are `realestate_eval_prod_*`). Residual readers still open those owner contexts over a second connection string. There is no leftover shared database. Copy existing rows once with the scripts in `infra/postgres/copy-*-data.sh` after `DbMigrate` has created the schema, then drop leftover databases with `infra/postgres/drop-leftover-shared.sh`. Valuation keeps its own outbox on the valuation database.

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
`backend/RealEstateEval.slnx` before publishing images and deploying them. The test job
collects coverage (see [Coverage](#coverage)) and runs the container tests against real
Postgres, RabbitMQ, and Redis on the runner's Docker daemon.

## Frontend permissions

Shell loads `GET /api/permissions` after login. Sidebar `pages` and `hasCapability()` / `isSuperAdmin()` use API `capabilities` — no client-side role switcher.

## Schema-per-service (PostgreSQL)

Dedicated owner databases (`realestate_eval_attachments`, `realestate_eval_identity`, `realestate_eval_platform`, `realestate_eval_valuation`, `realestate_eval_failures`, `realestate_eval_operations`, `realestate_eval_financial`, `realestate_eval_case_study`, `realestate_eval_messaging`) keep **domain schemas** as the logical slice:


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

`docker compose … redis` (port `6379`). Registered via `AddRedisCaching` in
`AddHostSharedInfrastructure` / residual `AddPersistence`.


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

### Upload validation

`POST /api/attachments` identifies content from its leading bytes
(`FileSignatureInspector`) and ignores the client's claims about it. The allow-list is
JPEG, PNG, GIF, WebP and PDF; anything not positively recognised — SVG, HTML, archives,
executables — is rejected. On top of the signature check the gate requires:

- the declared MIME type to agree with the detected format (`application/octet-stream`
  is accepted as "unspecified", which is what browsers send for drag-and-drop);
- the file-name extension to agree with the detected format, which is what stops
  `deed.png.exe` and PDF/image polyglots;
- the scope's format and size budget, judged on the **verified** type, not the declared
  one (`AttachmentUploadRules`: 8 MB images, 20 MB PDFs, PDF-only scopes).

What gets persisted is the canonical MIME type and a sanitized file name (directory
components stripped for both separator styles, control and reserved characters removed).
Downloads re-derive the content type from the stored bytes, so rows written before this
gate existed cannot serve a client-chosen MIME type either.

Rejections are `400 application/problem+json` describing the rule that fired.

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
| `GET /ready`              | Database reachable and migrated (domain services); upstream cluster probe (gateway) |
| `X-Correlation-Id` header | Returned on every response             |

Override: `OpenTelemetry:OtlpEndpoint` or env `OTEL_EXPORTER_OTLP_ENDPOINT`.
Local UIs: Jaeger [http://localhost:16686](http://localhost:16686), Prometheus
[http://localhost:9090](http://localhost:9090), Grafana
[http://localhost:3001](http://localhost:3001) (provisioned dashboard
**Real Estate Eval — Service Overview**). Fluent Bit tails Docker json-file
logs into Elasticsearch (`fluentbit-*` in Kibana).

### Correlation ids and log format

A caller may supply `X-Correlation-Id`; the value is echoed back, written into every log
line for the request (with the emitting `Service` name), and tagged on the current span.
Because it is echoed and logged, it is only trusted when it looks like an id — up to 128
characters of letters, digits, `-`, `_`, `.`, or `:`. Anything else (control characters,
whitespace, quotes, or a repeated header) is replaced with a fresh id and logged as
ignored, which keeps header injection and log forging out of the pipeline. A GUID, a W3C
`traceparent`, and a caller's own request id all pass unchanged.

The gateway overwrites `X-Correlation-Id` on every proxied request with the id it just
issued or accepted, so a forged inbound header cannot leak to owner APIs. Outbound
`HttpClient` calls from those APIs (owner HTTP lookups) add the same header when it is
missing, using the request's `TraceIdentifier`.

Outside Development, logs are one JSON object per line (`AddJsonConsole`, not Serilog),
including the `CorrelationId` and `Service` scopes and the current trace and span ids, so
shipped logs can be filtered and joined to traces. Development keeps the readable console
writer. Override with `Observability:JsonConsoleLogging`.

Requires `docker compose … rabbitmq` for integration events; both **valuation** + **case-study** must be running.