# Ejada Internal — Real Estate Evaluation and Case Study Platform

**نظام إجادة الداخلي** is an internal platform for property case study, valuation, field work and operations. The interface is Arabic (RTL).

The architecture is logical microfrontends (one Next.js deploy) and nine domain microservices behind a YARP gateway, with one PostgreSQL database per owning service. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Table of contents

- [About the project](#about-the-project)
- [Capabilities](#capabilities)
- [Security](#security)
- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [API routes](#api-routes)
- [Screens](#screens)
- [Production](#production)
- [Running and maintaining the project](#running-and-maintaining-the-project)
- [Remaining work](#remaining-work)
- [Documentation](#documentation)

---

## About the project

Ejada Internal runs the full transaction cycle: work orders (PO) and properties, distribution to parties, case study, field inspection, engineering survey, keys, impediments (تعذرات), valuation and the valuation report, party fees and billing, and KPIs.

The application comprises:

- a Next.js 16 shell that composes the domain microfrontend packages, installable as a PWA with an offline mode for field roles
- an ASP.NET Core 10 gateway and nine domain services with JWT and ASP.NET Identity
- PostgreSQL 17 (one database per owning service), RabbitMQ (outbox and consumers), Redis (caching), Gotenberg (report PDFs)
- Docker Compose for local infrastructure and for production on a single Hetzner Cloud server

Product rules: the governing spec for the valuation package is [`docs/ejadah-cursor-package-v2/review-decisions-log-v2.md`](docs/ejadah-cursor-package-v2/review-decisions-log-v2.md).

### Roles

| Role id                 | Arabic department / title   |
| ----------------------- | --------------------------- |
| `cdo`                   | المسؤول (مسؤول النظام)       |
| `general-manager`       | مدير إدارة التقييم العقاري   |
| `section-supervisor`    | مشرف قسم دراسة الحالة       |
| `case-specialist`       | أخصائي دراسة حالة           |
| `real-estate-appraiser` | مقيم عقاري                  |
| `field-inspector`       | معاين ميداني                |
| `government-reviewer`   | مراجع حكومي                 |
| `engineering-office`    | مكتب هندسي — رفع مساحي      |
| `financial-officer`     | موظف مالي — المالية والعقود |

Pages per role are defined in `packages/app-shared/src/app-data/constants.ts` (`ROLES`); the signed-in user's pages and capabilities come from `GET /api/permissions`.

---

## Capabilities

### Case study department

- Work orders (PO) and properties: intake, bourse stage, property edit, documents checklist, favorites, map
- Active transactions: primary data, distribution to parties, case study, system upload, bourse inquiry, party fees
- Keys and key envelopes (محفظة المفاتيح), impediments (إدارة التعذرات), suspended transactions, name review, client registry
- Operational tasks with reminders

### Field and survey

- Field inspector workspace: on-site data, feature photos with GPS/EXIF, deed boundaries, submit and accept/return by the specialist
- Offline mode for field roles: encrypted IndexedDB drafts and outbox, service-worker page cache, replay on reconnect (`@platform/offline-client`)
- Engineering office survey tasks and survey report upload

### Valuation department

- Valuation requests and the evaluator workspace (comparable sales method, comparables bank, difference factors, reconciliation)
- Valuation report preview and print, plus signed PDF links rendered by Gotenberg (`/api/valuation-reports/{no}.pdf?k=…`)
- Missing report fields are marked red; clicking notifies the person who supplied the field

### Finance and administration

- Party fees, pricing (التسعيرة) and financial reports
- Users (staff are **Active** on creation and sign in by Saudi mobile), courts, failure types, field dictionary, screen catalog, organization settings, audit log
- Web Push notifications (VAPID)

---

## Security

### Authentication and session

| Feature                | Location                                        | Description                                                                                               |
| ---------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Saudi mobile sign-in   | `POST /api/auth/login`                          | Passwordless by phone (gated by `Auth:EnableDevLogin`); the OTP screen is interim until Saudi SMS OTP     |
| JWT access tokens      | `JwtTokenService`                               | HMAC-SHA256; issuer, audience, lifetime and signing key validated; optional `Jwt:PreviousSigningKey`      |
| Refresh tokens         | `AuthSessionService`, `/api/auth/refresh`       | 15-minute access token, rotating refresh tokens; a disabled account gets `account-disabled` and is wiped  |
| Client session store   | `@platform/auth-client`                         | Session in `localStorage` (shared across tabs, `sessionStorage` fallback) plus the `ree-auth` gate cookie |
| Application auth gate  | `PrototypeAppGate`, `apps/shell/src/proxy.ts`   | Unauthenticated users are redirected to `/login`; offline field sessions stay usable while the refresh token is valid |
| Sign-out               | `AppShell`                                      | Clears the session and offline data, then navigates to `/login`                                           |

Sign-in flow (interim until Saudi SMS OTP):

```text
Browser → /login (Saudi mobile + OTP screen)
       → POST /api/auth/login ({ username: "5XXXXXXXX" })
       ← access JWT + refresh token + user + expiresAtUtc
       → localStorage session + ree-auth cookie
Subsequent API calls → Authorization: Bearer <token>
```

### Authorization

| Feature                    | Status      | Description                                                                                              |
| -------------------------- | ----------- | -------------------------------------------------------------------------------------------------------- |
| Role-based navigation      | Implemented | Sidebar and page access from `GET /api/permissions` (`pages` and `capabilities`)                         |
| Capability policies        | Implemented | `[Authorize(Policy = CapabilityPolicyNames.…)]` on domain endpoints (work orders, financial, valuation, workspace reads, party work) |
| Upstream-only dispatch     | Implemented | Service-to-service routes require `X-REE-Upstream`; gateway and nginx strip it from browser requests     |
| Audit log                  | Implemented | Workflow approvals, failure decisions and admin/catalog changes; `/api/audit-log`                        |

### Application and transport

| Feature            | Status      | Notes                                                                                                        |
| ------------------ | ----------- | ------------------------------------------------------------------------------------------------------------ |
| TLS                | Implemented | nginx terminates HTTPS, redirects HTTP→HTTPS and sends HSTS (`infra/nginx.conf`, [`infra/HTTPS.md`](infra/HTTPS.md)) |
| CORS               | Implemented | Deny-by-default outside Development (same-origin via nginx); `Cors__AllowedOrigins` only if the origin differs |
| Rate limiting      | Implemented | `RateLimitingExtensions` in `RealEstateEval.Shared.Web`                                                      |
| Attachment uploads | Implemented | Content identified by magic bytes; declared MIME and extension must agree; allow-list JPEG, PNG, GIF, WebP, PDF |
| Report PDF links   | Implemented | HMAC-signed, expiring keys; bad or expired keys answer 404; Gotenberg blocks every http(s) and non-`/tmp` file fetch |
| Offline data       | Implemented | Always encrypted in IndexedDB (AES-GCM; software fallback when `crypto.subtle` is missing)                  |
| Secrets            | Host `.env` | Production secrets live in `/app/.env` on the server and GitHub Actions secrets — never in the repo         |
| Migrations         | Implemented | Production apps never migrate on startup; the `migrate` one-shot (`backend/tools/DbMigrate`) runs on deploy |

### JWT configuration

Configure in each service `appsettings.json` for development; production uses `JWT_SIGNING_KEY` from the host `.env`:

```json
"Jwt": {
  "Issuer": "RealEstateEval",
  "Audience": "RealEstateEval",
  "SigningKey": "<64+ character secret — never commit a production key>",
  "PreviousSigningKey": "<optional — old key during rotation window only>"
}
```

Rotation runbook: [`docs/ops/jwt-signing-key-rotation.md`](docs/ops/jwt-signing-key-rotation.md).

### Production checklist

**Done**

- [x] Unique `JWT_SIGNING_KEY` (≥64 chars) in host `/app/.env`; the deploy rejects placeholders and short keys
- [x] Postgres / RabbitMQ / JWT secrets in host env and GitHub Actions secrets, never committed
- [x] Real TLS certificates (`TLS_CERTIFICATE_PATH` / `TLS_PRIVATE_KEY_PATH`); HTTP→HTTPS and HSTS via nginx
- [x] Phone-number login on (`Auth__EnableDevLogin=true`); no staff passwords or activation tickets
- [x] Production migrate runs with `Database__SeedDemoData=false`: deploys do not re-seed the demo `@ejadah.dev` users. Run `docker compose -f docker-compose.prod.yml run --rm migrate seed` on the server to seed once on purpose
- [x] Short-lived access JWT plus rotating refresh tokens
- [x] Capability policies, upstream-only dispatch, audit append on workflow decisions
- [x] JWT signing-key rotation documented and scripted (`scripts/ops/rotate-jwt-signing-key.sh`)

**Open**

- [ ] Security pass on case-study and valuation forms (PII fields, attachment scopes) before loading real deeds and parties
- [ ] Real Saudi SMS OTP (issue → verify → JWT); the current OTP screen is the hook

**Deferred**

- [ ] HttpOnly cookie / BFF session instead of the `localStorage` token (only if a security review requires it)
- [ ] Step-up re-authentication for sensitive admin and approval actions
- [ ] Cloud vault instead of the host `.env`

Report vulnerabilities to the project owner internally. Do not open public issues that include exploit details.

---

## Technology stack

| Area               | Technology                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| Web application    | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, TanStack Query; PWA service worker (`apps/shell/public/sw.js`) |
| Monorepo           | npm workspaces — `apps/shell`, `apps/mfe-*`, `packages/*`                                           |
| Shared packages    | `@platform/app-shared`, `@platform/ui-kit`, `@platform/auth-client`, `@platform/api-client`, `@platform/offline-client`, `@platform/types` |
| Backend            | ASP.NET Core 10, Entity Framework Core, ASP.NET Identity, YARP gateway                              |
| Database           | PostgreSQL 17 — nine databases (identity, case_study, operations, financial, valuation, failures, platform, attachments, messaging) |
| Messaging          | RabbitMQ 3.13 — transactional outbox and consumers                                                  |
| Cache              | Redis 7                                                                                             |
| PDF rendering      | Gotenberg 8 (Chromium)                                                                              |
| Maps               | Google Maps JavaScript API and Static Maps (print)                                                  |
| Tracing / metrics  | OpenTelemetry OTLP export (default `localhost:4317`); no collector runs in either compose file, so nothing receives it unless `OpenTelemetry:OtlpEndpoint` / `OTEL_EXPORTER_OTLP_ENDPOINT` points at one |
| Logs               | Docker json-file driver (`docker compose logs`); production rotates at 10 MB × 3 per container |
| Tests              | xUnit (`npm run test:api`), Vitest (`npm run test:unit`), Playwright (`npm run test:e2e`)           |
| Hosting            | Docker Compose on Hetzner Cloud, images on GHCR, deploy via GitHub Actions                          |

---

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (live tree) and [`backend/README.md`](backend/README.md) (services, routes, migrations).

```text
property_study/
├── apps/
│   ├── shell/                      # Next.js host — login, layout, navigation, PWA, offline sync
│   ├── mfe-case-study/             # @case-study/mfe
│   ├── mfe-evaluator/              # @evaluator/mfe
│   ├── mfe-engineering-office/     # @engineering-office/mfe
│   ├── mfe-dashboard/              # @dashboard/mfe
│   ├── mfe-survey/                 # @survey/mfe
│   ├── mfe-keys/                   # @keys/mfe
│   ├── mfe-financial/              # @financial/mfe
│   ├── mfe-failures/               # @failures/mfe
│   ├── mfe-settings/               # @settings/mfe
│   ├── mfe-valuation/              # @valuation/mfe
│   └── plan/                       # frontend plan documents
├── packages/                       # app-shared, ui-kit, auth-client, api-client, offline-client, types
├── backend/
│   ├── gateway/                    # YARP (:5160)
│   ├── services/                   # nine API hosts
│   ├── contexts/                   # per-context Domain / Application / Infrastructure
│   ├── shared/                     # Contracts, Web, RemoteClients
│   ├── RealEstateEval.{Application,Infrastructure}/  # shared remainder
│   └── tools/{DbMigrate,DevSeed}/
├── infra/                          # docker-compose.yml (local), docker-compose.prod.yml, nginx.conf
├── e2e/                            # Playwright tests and probe drivers
├── scripts/                        # repo checks and ops scripts
└── docs/
```

```text
Browser → nginx (TLS, prod) → Next.js shell
                             → Gateway (YARP) :5160
                                 → identity      :5161
                                 → case-study    :5162
                                 → operations    :5163
                                 → reporting     :5164  (HTTP read model, no database)
                                 → financial     :5165
                                 → valuation     :5166 → Gotenberg (PDF)
                                 → failures      :5167
                                 → platform      :5168
                                 → attachments   :5169
Services ↔ PostgreSQL (one database each), RabbitMQ (outbox/events), Redis (cache)
```

Ports are the local development ports. Microfrontends are compiled into the shell as packages; there is no Module Federation. Case-study ↔ evaluator talk through shell bridges only (no package cycles).

---

## Getting started

### Prerequisites

- Node.js 20 or later, and npm
- .NET SDK 10
- Docker Desktop

### 1. Infrastructure

```bash
npm run dev:infra        # postgres, rabbitmq, redis, gotenberg from infra/docker-compose.yml
```

| Service    | Local address                                                     |
| ---------- | ----------------------------------------------------------------- |
| PostgreSQL | `127.0.0.1:5433` (user `postgres`, password `Admin`)              |
| RabbitMQ   | `5672`, management UI [http://localhost:15672](http://localhost:15672) |
| Redis      | `6379`                                                            |
| Gotenberg  | [http://localhost:3010](http://localhost:3010)                    |

### 2. Backend

```bash
npm run dev:api          # gateway + nine services with dotnet watch (hot reload)
npm run dev:api:run      # same, with dotnet run (no watch)
npm run dev:api:stop     # stop them all
```

Both start commands apply pending EF migrations first (`backend/tools/DbMigrate`). Gateway health: [http://127.0.0.1:5160/health](http://127.0.0.1:5160/health); each service also answers `/ready`. Single services: `npm run dev:identity`, `dev:case-study`, `dev:valuation`, and so on.

On Windows, use `127.0.0.1` rather than `localhost` in backend URLs: .NET tries IPv6 first and each new connection can stall about 2 seconds.

### 3. Frontend

```bash
npm install              # again after package.json or package-lock.json changes
npm run dev              # http://localhost:3000
```

### Demo sign-in

The seeder (`backend/tools/DevSeed/DataSeeder.cs`) creates demo users. Sign in with the 9-digit mobile; in development the OTP screen accepts any 6 digits.

| User          | Role                  | Mobile      |
| ------------- | --------------------- | ----------- |
| sliman        | cdo (sees everything) | `500000001` |
| osama         | case specialist       | `500000004` |
| feras         | government reviewer   | `500000005` |
| abdullah      | appraiser             | `500000007` |
| ahmed         | field inspector       | `500000008` |
| eman          | financial officer     | `500000010` |
| jeddah_survey | engineering office    | `500000011` |

The full list is in `DemoMobileByLogin` in the seeder and in `e2e/fixtures/auth.ts`.

---

## Configuration

### Database connection strings

Each service reads its own database from `appsettings.Development.json` or from an environment variable. `DbMigrate` reads environment variables only:

```text
REAL_ESTATE_EVAL_PG_CONNECTION_STRING_{IDENTITY|CASESTUDY|OPERATIONS|FINANCIAL|VALUATION|FAILURES|PLATFORM|ATTACHMENTS|MESSAGING}
Host=127.0.0.1;Port=5433;Database=realestate_eval_<db>;Username=postgres;Password=Admin
```

Note `CASESTUDY` has no underscore inside the service name.

```bash
dotnet run --project backend/tools/DbMigrate -- update   # apply migrations
dotnet run --project backend/tools/DbMigrate -- seed     # idempotent demo seed
```

### Frontend environment (optional)

```env
NEXT_PUBLIC_API_URL=http://localhost:5160
```

---

## API routes

Base URL (development): `http://localhost:5160`. The gateway routes by prefix:

| Service     | Prefixes                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| identity    | `/api/auth/*`, `/api/users`, `/api/permissions`                                                                           |
| operations  | `/api/survey-offices`, `/api/property-keys`, `/api/key-envelopes`, `/api/operations-tasks`                                |
| valuation   | `/api/valuation-requests`, `/api/valuation-reports/*`, `/api/comparable-properties`, `/api/property-comparable-links`, `/api/evaluator-recalls` |
| reporting   | `/api/reporting/*`                                                                                                        |
| financial   | `/api/financial/*`                                                                                                        |
| failures    | `/api/failures`, `/api/failure-types-catalog`                                                                             |
| platform    | `/api/field-dictionary`, `/api/courts`, `/api/regions`, `/api/case-study-info-roles`, `/api/organization-settings`, `/api/valuation-lists`, `/api/difference-factor-catalog`, `/api/attachment-print-dictionary`, `/api/field-sync-status`, `/api/audit-log`, `/api/notifications`, `/api/push/*` |
| attachments | `/api/attachments`                                                                                                        |
| case-study  | everything else under `/api/*` (work orders, workflow tasks, case-study forms, party task submissions, clients, …)        |

Authentication endpoints:

| Method | Endpoint            | Description                                                         | Authorization |
| ------ | ------------------- | ------------------------------------------------------------------- | ------------- |
| `POST` | `/api/auth/login`   | Passwordless Saudi mobile (or username); gated by `Auth:EnableDevLogin` | Public        |
| `POST` | `/api/auth/refresh` | Rotate the refresh token and mint a new access JWT                  | Public        |
| `POST` | `/api/auth/logout`  | Revoke the refresh family                                           | Public        |
| `GET`  | `/api/auth/me`      | Current user (+ optional permissions)                               | Bearer JWT    |

Route table source: `backend/gateway/RealEstateEval.Gateway/appsettings.json`. Versioning and contract naming rules: [`backend/README.md`](backend/README.md).

---

## Screens

Pages are served by `apps/shell/src/app/(app)/[page]/page.tsx`; ids are `PageId` in `packages/types/src/navigation.ts`. Workspaces with their own routes: `/po/*`, `/case-study/*`, `/property-inspection/*`, `/active-inspection/*`, `/active-survey/*`, `/property-appraisal/*`.

| Group                  | Pages                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| General                | `dashboard` لوحة التحكم, `profile` البروفايل                                                                            |
| Case study             | `po` أوامر العمل, `all-transactions`, `property-map`, `favorites`, `operations-tasks` المهام, `keys` محفظة المفاتيح, `field-sync-board` ظروف معلّقة, `failures` إدارة التعذرات, `suspended-transactions`, `location-pending` مراجعة المسميات, `clients` سجل العملاء |
| Active transactions    | `active-primary-data`, `active-distribution`, `active-case-study`, `system-upload`, `bourse-inquiry`, `party-fees` فوترة الأتعاب |
| Field and survey       | `active-inspection` / `property-inspection` معاينة العقار, `active-survey` الرفع المساحي, `survey` مكاتب الرفع الهندسي   |
| Valuation              | `valuation-requests` طلبات التقييم, `property-appraisal` تقييم العقار, `comparable-properties` بنك المقارنات            |
| Finance                | `financial` المالية والفوترة, `fee-pricing` التسعيرة                                                                    |
| Settings               | `users`, `courts`, `failure-types`, `case-study-info-roles`, `system-fields-catalog`, `system-screen-catalog`, `organization-settings`, `attachment-print-dictionary`, `difference-factor-catalog`, `audit-log` |

Offline, field roles only see the offline forms (`active-inspection`, `operations-tasks`, `keys`).

---

## Production

Full guide: [`docs/DEPLOYMENT_HETZNER.md`](docs/DEPLOYMENT_HETZNER.md). TLS: [`infra/HTTPS.md`](infra/HTTPS.md).

### How a deploy works

`.github/workflows/deploy.yml` builds the images (Next.js shell, gateway, nine services, `db-migrate`), pushes them to `ghcr.io/<owner>/case_study/*` tagged with the commit SHA, then over SSH:

1. copies `infra/docker-compose.prod.yml` and `infra/nginx.conf` to `/app` on the server
2. checks the required secrets and TLS files
3. pulls the images, runs the `migrate` one-shot, then `docker compose up -d`
4. smoke-tests gateway, identity and case-study health/readiness and the public URL
5. on failure, rolls back to the previous tag recorded in `/app/.deploy-tag`

### What runs on the server

16 containers from `infra/docker-compose.prod.yml`: nginx, frontend, gateway, the nine services, postgres, rabbitmq, redis and gotenberg. There is no observability stack in production (Elasticsearch, Prometheus, Grafana and the OTEL collector were removed to save RAM); read logs with `docker compose -f docker-compose.prod.yml logs <service>`.

### Sizing (measured 2026-09-26)

| Resource | Used                                                                 |
| -------- | -------------------------------------------------------------------- |
| RAM      | ~2.7 GB for the whole server (~1.9 GB for all containers)            |
| CPU      | ~1% per container; load average under 1 on 4 cores                  |
| Disk     | ~8–11 GB: ~5 GB images per release kept, ~2 GB OS, <200 MB system journal, ~220 MB data (Postgres 157 MB, attachments 59 MB) |

An 8 GB shared-vCPU server is enough for this load; 16 GB leaves plenty of headroom. The stack does not need dedicated vCPUs.

### Disk hygiene

- Each deploy keeps only the images of the release now running and the one before it (for a fast local rollback); older releases can be pulled again from GHCR.
- Every container's log is rotated at 10 MB × 3 files (`x-logging` in the prod compose), so logs stay under ~30 MB per container.
- The system journal is capped at 200 MB (`/etc/systemd/journald.conf.d/ree-size.conf`).
- Real data lives in the Docker volumes `ree_prod_pgdata`, `ree_prod_attachments_data`, `ree_prod_rabbitmqdata` and `ree_prod_redisdata`. Never prune volumes on the server.

### Server hardening

Only ports 22, 80 and 443 are open (ufw); root signs in with an SSH key only; fail2ban bans repeated SSH failures; security updates install automatically; a 2 GB swap file (`vm.swappiness=10`) absorbs short memory spikes. `infra/setup-hetzner-server.sh` sets all of this up on a fresh server.

---

## Running and maintaining the project

### Daily development

```bash
npm run dev:infra        # once per session
npm run dev:api          # backend
npm run dev              # frontend
```

| Service         | URL                                              |
| --------------- | ------------------------------------------------ |
| Web application | [http://localhost:3000](http://localhost:3000)   |
| API gateway     | [http://localhost:5160](http://localhost:5160)   |
| RabbitMQ UI     | [http://localhost:15672](http://localhost:15672) |

### Checks

```bash
npm run lint
npm run typecheck:mfes
npm run test:unit        # Vitest, including architecture and size ratchets under tests/architecture
npm run test:api         # dotnet test backend/RealEstateEval.slnx
npm run test:e2e         # Playwright; always from the repo root (workers: 1)
npm run test:release     # everything above plus release-verify
```

Running `dotnet build` or `dotnet test` while `dev:api` is running rebuilds the shared projects and can stop the whole local API; check `http://127.0.0.1:5160/health` afterwards.

### Where to change code

| Intent                               | Location                                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| Roles, navigation, page titles       | `packages/app-shared/src/app-data/constants.ts`, `packages/types/src/navigation.ts`     |
| Domain screens                       | `apps/mfe-*/src/views/` (region components + `use<Name>Workflow` hooks + `-state.ts`)   |
| Data access per screen               | `apps/mfe-*/src/lib/app-data/` (`-model` / `-reads` / `-commands`)                      |
| Shell layout, sidebar, sign-out      | `apps/shell/src/components/views/AppShell.tsx`                                          |
| URL to screen mapping                | `apps/shell/src/app/(app)/[page]/page.tsx`                                              |
| Offline mode                         | `packages/offline-client/`, `apps/shell/public/sw.js`, `packages/app-shared/src/offline/` |
| API client                           | `packages/api-client/`                                                                  |
| Backend use cases / persistence      | `backend/contexts/<ctx>/…Application` / `…Infrastructure`                               |
| Local and production infrastructure  | `infra/docker-compose.yml`, `infra/docker-compose.prod.yml`, `infra/nginx.conf`         |

**Add a menu page:**

1. Add the `PageId` in `packages/types/src/navigation.ts`
2. Add the navigation item and titles in `packages/app-shared/src/app-data/constants.ts`
3. Create the view in the matching `apps/mfe-*/src/views/` package
4. Export it from the MFE `index.ts` and register it in the shell page map
5. Add the page to each role's `pages` in `ROLES` and to `PlatformPermissionCatalog` (identity service), which feeds `GET /api/permissions`

### Troubleshooting

| Problem                                   | Action                                                                                  |
| ----------------------------------------- | --------------------------------------------------------------------------------------- |
| Port 3000 or 5160–5169 in use             | `npm run dev:stop` / `npm run dev:api:stop`                                              |
| `42703 column … does not exist`           | A migration is pending: run `DbMigrate -- update` (or restart `dev:api`)                |
| «رابط PDF» answers 503                    | Gotenberg is not running: `npm run dev:infra`                                            |
| Sign-in fails                             | Start Docker and `dev:api`; use a demo mobile from [Demo sign-in](#demo-sign-in)        |
| Arabic text saved as `????`               | Do not pass Arabic through the Windows shell; send JSON from a UTF-8 file (`curl -d @file`) |
| TypeScript path `@/` errors               | Restart the TypeScript server from the repository root                                  |

---

## Remaining work

Tracked in [`docs/remaining-work.md`](docs/remaining-work.md) and [`docs/progress.md`](docs/progress.md). Headline items:

- Real Saudi SMS OTP
- PII / attachment-scope security pass before loading real deeds and parties
- Offline document prefetch still lacks رخصة البناء، الكروكي، محضر التجزئة and خطاب التمكين

Deferred, not MVP blockers: Module Federation / independent MFE deploys, HttpOnly/BFF session, Cassandra.

---

## Documentation

| Document                                                                                   | Description                                                   |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)                                               | Current architecture (live tree)                              |
| [docs/MICROFRONTENDS_AND_MICROSERVICES.md](docs/MICROFRONTENDS_AND_MICROSERVICES.md)       | Microfrontend and microservice structure                      |
| [docs/DATABASE_OVERVIEW.md](docs/DATABASE_OVERVIEW.md)                                     | PostgreSQL schema                                             |
| [docs/architecture/](docs/architecture/)                                                   | Table ownership, pagination contract, SOLID scorecard, ratchet baselines |
| [docs/adr/](docs/adr/)                                                                     | Architecture decision records                                 |
| [backend/README.md](backend/README.md)                                                     | Gateway, services, routes, EF migrations, tests               |
| [apps/plan/FRONTEND.md](apps/plan/FRONTEND.md)                                             | Frontend applications and shell                               |
| [docs/USERS_ROLES_AND_TERMS.md](docs/USERS_ROLES_AND_TERMS.md)                             | Users, roles and terms                                        |
| [docs/DEPLOYMENT_HETZNER.md](docs/DEPLOYMENT_HETZNER.md)                                   | Production deployment: server preparation, TLS, secrets, CI/CD |
| [docs/ops/](docs/ops/)                                                                     | JWT key rotation, production DB verification                  |
| [infra/HTTPS.md](infra/HTTPS.md)                                                           | TLS termination and certificate renewal                       |

Ejada Internal is intended for internal real-estate evaluation and case study operations.
