# Ejada Internal — Real Estate Evaluation and Case Study Platform

**نظام إجادة الداخلي** is an internal platform for property case study, valuation, field work and operations. The interface is Arabic (RTL).

The architecture is logical microfrontends (one Next.js deploy) and nine domain microservices behind a YARP gateway, with one PostgreSQL database per owning service. Services, routes and migrations are described in [`backend/README.md`](backend/README.md); the frontend in [`apps/plan/FRONTEND.md`](apps/plan/FRONTEND.md).

---

## Table of contents

- [About the project](#about-the-project)
- [The transaction cycle](#the-transaction-cycle)
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
- [Testing a full transaction](#testing-a-full-transaction)
- [Remaining work](#remaining-work)
- [Documentation](#documentation)

---

## About the project

Ejada Internal runs the full transaction cycle for Enfaz (إنفاذ) assignments, from the work order to the Enfaz upload. It covers:

- work orders (PO) and properties
- distribution to parties and case study
- field inspection and engineering survey
- keys and impediments (تعذرات)
- valuation and the valuation report
- deposit and Enfaz handover
- party fees, billing and KPIs

The application comprises:

- a Next.js 16 shell that composes the domain microfrontend packages, installable as a PWA with an offline mode for field roles
- an ASP.NET Core 10 gateway and nine domain services with JWT and ASP.NET Identity
- PostgreSQL 17 (one database per owning service), RabbitMQ (outbox and consumers), Redis (caching), Gotenberg (PDFs)
- Docker Compose for local infrastructure and for production on a single Hetzner Cloud server

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

A case specialist holds one to three **sub-roles**, set on the users screen. All three stages are shared queues, not personal assignments:

| Sub-role       | Arabic                       | Owns                                                                                     |
| -------------- | ---------------------------- | ---------------------------------------------------------------------------------------- |
| `coordination` | التنسيق                      | Intake, bourse stage, distribution, formal receipt from the parties, failures follow-up, keys, courts, cancellation requests |
| `study`        | دراسة العقار                 | Technical acceptance of the inspection and survey, components text, deed-to-nature match, valued documents, sending the study to review |
| `review`       | المراجعة والاعتماد والرفع    | Approving or returning the study, accepting or returning the value, issuing the valuation draft, deposit, «تجهيز المعاملة للرفع» and the Enfaz handover |

Pages per role are defined in `packages/app-shared/src/app-data/constants.ts` (`ROLES`). The signed-in user's pages, capabilities and sub-roles come from `GET /api/permissions`.

Every user starts on **«أعمالي»** (`my-work`): one list of the transactions waiting on them, with the next action on each row. The appraiser has no other entry.

---

## The transaction cycle

```text
Coordination  intake → bourse → distribution → receipt from the parties
Parties       inspector (on site) · engineering office (survey) · appraiser (valuation)
Study         accepts the inspection and survey → components, deed match → sends the study to review
Review        approves the study → accepts the value → issues the valuation draft
Appraiser     approves the draft, or returns it to review with a reason
Review        deposits (code + certificate → final PDF) → «تجهيز المعاملة للرفع» → Enfaz handover
```

Rules that hold across the cycle:

- **Inspector data:** it reaches the appraiser only after the specialist accepts the inspection. A returned inspection is hidden from the appraiser again until it is re-accepted.
- **Basis of value:** the work order owns it, everywhere. The liquidation discount applies only on a liquidation basis.
- **Lock:** one lock for everyone. Data is open until review approves the study; only «إرجاع للدراسة» reopens it. After the appraiser approves the draft, only a transaction reopen opens it.
- **Enfaz handover:** refused until the deed is stamped «جاهز للرفع». Any reopen clears the stamp.
- **Cancellation:** a specialist requests «إلغاء المعاملة» and the supervisor approves, rejects or reactivates. Both the request and the decision go into the property timeline.

---

## Capabilities

### Case study department

- Work orders (PO) and properties: intake with one submit at the end, bourse stage, property edit, documents checklist, favorites, map
- Deed reference numbers: `PR-YY-N` per deed from the first initial-data save; linked deeds share a root number, and comparables are numbered `CMP-YY-N`
- Linked properties: a transaction sits above its deeds, with one study and one report
- Distribution, receipt from the parties, case study and the study report, Enfaz upload assistant
- Keys and key envelopes (محفظة المفاتيح), impediments (إدارة التعذرات) including the final failure and its return, suspended transactions, name review, client registry
- Operational tasks with reminders
- Property timeline with one milestone per step, and a field change log per property

### Field and survey

- Field inspector workspace:
  - on-site data and feature photos with GPS/EXIF
  - deed boundaries and on-site corrections of the property type and usage
  - submit, then accept or return by the specialist; the return names the sections to correct
- Offline mode for field roles: encrypted IndexedDB drafts and outbox, service-worker page cache, replay on reconnect (`@platform/offline-client`)
- Engineering office survey tasks and survey report upload. The fee discount is proposed by the specialist at acceptance and approved by the supervisor.

### Valuation department

- **Approaches:** market (comparison), and cost (contractor method) with its own land table. The income approach is removed.
- **Market value:** rounded by the request's «تقريب القيمة» setting. Requests deposited before the rounding existed keep their unrounded figure (flag `MarketValueUnrounded`).
- **Comparables:**
  - a bank with a map
  - difference factors and per-factor rationales (optional), weights
  - a removed property-linked comparable stays removed
- **Reconciliation:** liquidation discount on a liquidation basis, and valued documents («مستند ذو قيمة») added after the discount, then rounding of the final value.
- **The cost screen** autosaves; a saved approach also saves the plot area seeded from the deed.
- **Report:**
  - the valuation report preview and print
  - a 24-slot photo board chosen by the specialist, with movables printed in their own section
  - missing fields marked red; a click notifies the person who supplied the field
- **Final PDF:** built by Gotenberg at deposit, with the deposit code and the certificate.

### Finance and administration

- Party fees, pricing (التسعيرة), per-deed Enfaz billing marks and financial reports
- Users (staff are **Active** on creation, sign in by Saudi mobile, and specialists carry sub-roles), courts, failure types, field dictionary, organization settings, audit log
- Web Push notifications (VAPID)

---

## Security

### Authentication and session

| Feature                | Location                                        | Description                                                                                               |
| ---------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Saudi mobile sign-in   | `POST /api/auth/login`                          | By phone (gated by `Auth:EnableDevLogin`); SMS login codes through OurSMS are built and switched off (`Sms__OurSms__Enabled=false`) |
| JWT access tokens      | `JwtTokenService`                               | HMAC-SHA256; issuer, audience, lifetime and signing key validated; optional `Jwt:PreviousSigningKey`; carries the `subRole` claims |
| Refresh tokens         | `AuthSessionService`, `/api/auth/refresh`       | 15-minute access token, rotating refresh tokens; a disabled account gets `account-disabled` and is wiped  |
| Client session store   | `@platform/auth-client`                         | Session in `localStorage` (shared across tabs, `sessionStorage` fallback) plus the `ree-auth` gate cookie |
| Application auth gate  | `PrototypeAppGate`, `apps/shell/src/proxy.ts`   | Unauthenticated users are redirected to `/login`; offline field sessions stay usable while the refresh token is valid |
| Sign-out               | `AppShell`                                      | Clears the session and offline data, then navigates to `/login`                                           |

Sign-in flow:

```text
Browser → /login (Saudi mobile + code screen)
       → POST /api/auth/login ({ username: "5XXXXXXXX" })
       ← access JWT + refresh token + user + expiresAtUtc
       → localStorage session + ree-auth cookie
Subsequent API calls → Authorization: Bearer <token>
```

### Authorization

| Feature                    | Status      | Description                                                                                              |
| -------------------------- | ----------- | -------------------------------------------------------------------------------------------------------- |
| Role-based navigation      | Implemented | Sidebar and page access from `GET /api/permissions` (`pages`, `capabilities`, sub-roles)                 |
| Capability policies        | Implemented | `[Authorize(Policy = CapabilityPolicyNames.…)]` on domain endpoints; sub-role rules in `PoRoleMatrixRules` |
| Sibling package reads      | Implemented | The appraiser reads the inspection and the survey of his own transaction only once the specialist accepted them |
| Upstream-only dispatch     | Implemented | Service-to-service routes require `X-REE-Upstream`; gateway and nginx strip it from browser requests     |
| Audit log                  | Implemented | Workflow approvals, failure decisions, property field changes and admin/catalog changes; `/api/audit-log` |

### Application and transport

| Feature            | Status      | Notes                                                                                                        |
| ------------------ | ----------- | ------------------------------------------------------------------------------------------------------------ |
| TLS                | Implemented | nginx terminates HTTPS, redirects HTTP→HTTPS and sends HSTS (`infra/nginx.conf`, [`infra/HTTPS.md`](infra/HTTPS.md)) |
| CORS               | Implemented | Deny-by-default outside Development (same-origin via nginx); `Cors__AllowedOrigins` only if the origin differs |
| Rate limiting      | Implemented | `RateLimitingExtensions` in `RealEstateEval.Shared.Web`                                                      |
| Attachment uploads | Implemented | Content identified by magic bytes; declared MIME and extension must agree; allow-list JPEG, PNG, GIF, WebP, PDF |
| PDF rendering      | Implemented | Gotenberg prints the final valuation report and `POST /api/print-pdf` pages; nothing it renders is stored by the print endpoint |
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

Rotation is scripted in `scripts/ops/rotate-jwt-signing-key.sh`.

### Production checklist

**Done**

- [x] Unique `JWT_SIGNING_KEY` (≥64 chars) in host `/app/.env`; the deploy rejects placeholders and short keys
- [x] Postgres / RabbitMQ / JWT secrets in host env and GitHub Actions secrets, never committed
- [x] Real TLS certificates (`TLS_CERTIFICATE_PATH` / `TLS_PRIVATE_KEY_PATH`); HTTP→HTTPS and HSTS via nginx
- [x] Phone-number login on (`Auth__EnableDevLogin=true`); no staff passwords or activation tickets
- [x] Production migrate runs with `Database__SeedDemoData=false`: deploys do not re-seed the demo `@ejadah.dev` users. Run `docker compose -f docker-compose.prod.yml run --rm migrate seed` on the server to seed once on purpose
- [x] Short-lived access JWT plus rotating refresh tokens
- [x] Capability policies, sub-role rules, upstream-only dispatch, audit append on workflow decisions
- [x] JWT signing-key rotation scripted (`scripts/ops/rotate-jwt-signing-key.sh`)
- [x] SMS login codes built (OurSMS) — switched off until the go-live decision

**Open**

- [ ] Switch SMS login codes on (`Sms__OurSms__Enabled=true` with `OURSMS_API_KEY` / `OURSMS_SENDER`)
- [ ] Security pass on case-study and valuation forms (PII fields, attachment scopes)

**Deferred**

- [ ] HttpOnly cookie / BFF session instead of the `localStorage` token (only if a security review requires it)
- [ ] Step-up re-authentication for sensitive admin and approval actions
- [ ] Cloud vault instead of the host `.env`

Report vulnerabilities to the project owner internally. Do not open public issues that include exploit details.

---

## Technology stack

| Area               | Technology                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| Web application    | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, TanStack Query; PWA service worker (`apps/shell/public/sw.js`); self-hosted Tajawal font |
| Monorepo           | npm workspaces — `apps/shell`, `apps/mfe-*`, `packages/*`                                           |
| Shared packages    | `@platform/app-shared`, `@platform/ui-kit` (the design system, catalogued in `.design-sync/config.json`), `@platform/auth-client`, `@platform/api-client`, `@platform/offline-client`, `@platform/types` |
| Backend            | ASP.NET Core 10, Entity Framework Core, ASP.NET Identity, YARP gateway                              |
| Database           | PostgreSQL 17.11 — nine databases (identity, case_study, operations, financial, valuation, failures, platform, attachments, messaging) |
| Messaging          | RabbitMQ 3.13.7 — transactional outbox and consumers                                                |
| Cache              | Redis 7.4.12                                                                                        |
| PDF rendering      | Gotenberg 8.36 (Chromium)                                                                           |
| Maps               | Google Maps JavaScript API and Static Maps (print)                                                  |
| Tracing / metrics  | OpenTelemetry OTLP export (default `localhost:4317`); no collector runs in either compose file, so nothing receives it unless `OpenTelemetry:OtlpEndpoint` / `OTEL_EXPORTER_OTLP_ENDPOINT` points at one |
| Logs               | Docker json-file driver (`docker compose logs`); production rotates at 10 MB × 3 per container |
| Tests              | xUnit (`npm run test:api`), Vitest (`npm run test:unit`), Playwright (`npm run test:e2e`)           |
| Hosting            | Docker Compose on Hetzner Cloud, images on GHCR, deploy via GitHub Actions                          |

---

## Architecture

See [`backend/README.md`](backend/README.md) (services, routes, migrations), [`apps/plan/FRONTEND.md`](apps/plan/FRONTEND.md) (applications and shell) and [`docs/architecture/`](docs/architecture/) (table ownership and ratchet baselines).

```text
property_study/
├── apps/
│   ├── shell/                      # Next.js host — login, layout, navigation, PWA, offline sync
│   ├── mfe-case-study/             # @case-study/mfe — work orders, study, inspection, «أعمالي»
│   ├── mfe-evaluator/              # @evaluator/mfe — the appraiser's page and the valuation report
│   ├── mfe-engineering-office/     # @engineering-office/mfe
│   ├── mfe-dashboard/              # @dashboard/mfe
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
├── e2e/                            # Playwright tests, probe drivers and A→Z drivers
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

The seeder (`backend/tools/DevSeed/DataSeeder.cs`) creates demo users. Sign in with the 9-digit mobile; in development the code screen accepts any 6 digits.

| User           | Role                                | Mobile      |
| -------------- | ----------------------------------- | ----------- |
| sliman         | cdo (sees everything)               | `500000001` |
| osama          | case specialist — review            | `500000004` |
| omar_hamrani   | case specialist — study             | `500000013` |
| ayman_mahfouz  | case specialist — coordination      | `500000014` |
| mohammed_nafei | case specialist — coordination      | `500000015` |
| feras          | government reviewer                 | `500000005` |
| abdullah       | appraiser                           | `500000007` |
| assaf          | appraiser                           | `500000012` |
| ahmed          | field inspector                     | `500000008` |
| eman           | financial officer                   | `500000010` |
| jeddah_survey  | engineering office                  | `500000011` |

Sub-roles are edited on the users screen, so a local database may differ from this table. The full list is in `DemoMobileByLogin` in the seeder and in `e2e/fixtures/auth.ts`.

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

The Next.js `/api` rewrite proxies to the gateway with a 180-second timeout (`experimental.proxyTimeout` in `apps/shell/next.config.ts`, the same as nginx), because the deposit builds the final PDF before it answers.

---

## API routes

Base URL (development): `http://localhost:5160`. The gateway routes by prefix:

| Service     | Prefixes                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| identity    | `/api/auth/*`, `/api/users`, `/api/permissions`                                                                           |
| operations  | `/api/property-keys`, `/api/key-envelopes`, `/api/operations-tasks`                                                       |
| valuation   | `/api/valuation-requests`, `/api/valuation-report-drafts`, `/api/print-pdf`, `/api/comparable-properties`, `/api/property-comparable-links`, `/api/evaluator-recalls` |
| reporting   | `/api/reporting/*`                                                                                                        |
| financial   | `/api/financial/*`                                                                                                        |
| failures    | `/api/failures`, `/api/failure-types-catalog`                                                                             |
| platform    | `/api/field-dictionary`, `/api/courts`, `/api/admin/courts`, `/api/regions`, `/api/case-study-info-roles`, `/api/organization-settings`, `/api/valuation-lists`, `/api/attachment-print-dictionary`, `/api/field-sync-status`, `/api/audit-log`, `/api/notifications`, `/api/push/*` |
| attachments | `/api/attachments`                                                                                                        |
| case-study  | everything else under `/api/*` (work orders, transactions, workflow tasks, case-study reports, party task submissions, clients, …) |

Authentication endpoints:

| Method | Endpoint            | Description                                                         | Authorization |
| ------ | ------------------- | ------------------------------------------------------------------- | ------------- |
| `POST` | `/api/auth/login`   | Saudi mobile (or username); gated by `Auth:EnableDevLogin`          | Public        |
| `POST` | `/api/auth/refresh` | Rotate the refresh token and mint a new access JWT                  | Public        |
| `POST` | `/api/auth/logout`  | Revoke the refresh family                                           | Public        |
| `GET`  | `/api/auth/me`      | Current user (+ optional permissions)                               | Bearer JWT    |

Route table source: `backend/gateway/RealEstateEval.Gateway/appsettings.json`. Versioning and contract naming rules: [`backend/README.md`](backend/README.md).

---

## Screens

Pages are served by `apps/shell/src/app/(app)/[page]/page.tsx`; ids are `PageId` in `packages/types/src/navigation.ts`. Workspaces with their own routes: `/po/*`, `/case-study/*`, `/active-inspection/*`, `/active-survey/*`, `/property-appraisal/*`.

| Group                  | Pages                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| General                | `my-work` أعمالي (everyone's start page), `dashboard` لوحة التحكم, `favorites` المفضلة, `profile` البروفايل             |
| Case study             | `po` أوامر العمل, `all-transactions`, `property-map`, `operations-tasks` المهام, `keys` محفظة المفاتيح, `field-sync-board` ظروف معلّقة, `failures` إدارة التعذرات, `suspended-transactions`, `location-pending` مراجعة المسميات, `bourse-inquiry`, `clients` سجل العملاء |
| Active transactions    | `active-primary-data`, `active-distribution`, `active-receipt` الاستلام من الأطراف, `active-case-study`, `system-upload`, `party-fees` فوترة الأتعاب |
| Field and survey       | `active-inspection` معاينة العقار, `active-survey` الرفع المساحي                                 |
| Valuation              | `property-appraisal` تقييم العقار (opened from «أعمالي»), `comparable-properties` بنك المقارنات                          |
| Finance                | `financial` المالية والفوترة, `fee-pricing` التسعيرة                                                                    |
| Settings               | `users`, `courts`, `failure-types`, `case-study-info-roles`, `system-fields-catalog`, `organization-settings`, `attachment-print-dictionary`, `audit-log`, `admin-panel` |

The study specialist's **work page** (صفحة العمل) shows the work as numbered sections, four fields to a row. Results open in windows: the report preview and the Enfaz upload assistant. The 24-slot report photo board is a section of its own. The appraiser's page uses the same frame.

Offline, field roles only see the offline forms (`active-inspection`, `operations-tasks`, `keys`).

---

## Production

TLS: [`infra/HTTPS.md`](infra/HTTPS.md). Server setup: `infra/setup-hetzner-server.sh`.

### Branches and releases

Work on `dev`. Every push to `main` deploys to production, so `dev` is merged into `main` only when the release is approved.

### How a deploy works

`.github/workflows/deploy.yml` runs the tests, builds the images (Next.js shell, gateway, nine services, `db-migrate`) and pushes them to `ghcr.io/<owner>/case_study/*` tagged with the commit SHA. Then, over SSH:

1. copies `infra/docker-compose.prod.yml` and `infra/nginx.conf` to `/app` on the server
2. checks the required secrets and TLS files
3. pulls the images, runs the `migrate` one-shot, then `docker compose up -d`
4. smoke-tests gateway, identity and case-study health/readiness and the public URL
5. on failure, rolls back to the previous tag recorded in `/app/.deploy-tag`

Migrations that change how existing data is read carry their own backfill. For example, `MarketValueUnroundedFlag` marks the requests already deposited when it runs, so their deposited values never move.

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

The local databases may hold a copy of production data. Never paste it into external services or shared pages.

### Checks

```bash
npm run lint
npm run lint:hooks
npm run typecheck:mfes
npm run test:unit        # Vitest, including architecture and size ratchets under tests/architecture
npm run test:api         # dotnet test backend/RealEstateEval.slnx
npm run test:e2e         # Playwright; always from the repo root (workers: 1)
npm run test:release     # everything above plus release-verify
```

Duplicated code is kept down (167 duplicated frontend lines after the 2026-10-25 clean-up). Check a change with the same detector:

```bash
npx -y jscpd@4.0.5 apps packages --pattern "**/*.{ts,tsx}" --ignore "**/node_modules/**,**/.next/**,**/__tests__/**,**/*.test.ts,**/*.test.tsx" --min-lines 8 --min-tokens 70
```

Before writing a component, hook, helper, rule or query, look for the existing one first. [`CLAUDE.md`](CLAUDE.md) lists where each kind lives.

Running `dotnet build` or `dotnet test` while `dev:api` is running rebuilds the shared projects and can stop the whole local API. Build and test from a copy of `backend/` instead, or check `http://127.0.0.1:5160/health` afterwards.

On a busy machine, Vitest can fail whole files with load timeouts. Rerun with `npx vitest run --maxWorkers=4` before treating them as failures.

### Where to change code

| Intent                               | Location                                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| Roles, navigation, page titles       | `packages/app-shared/src/app-data/constants.ts`, `packages/types/src/navigation.ts`     |
| Sub-role rules                       | `PoRoleMatrixRules` (backend), `case-specialist-sub-roles.ts` (frontend)                |
| UI components                        | `packages/ui-kit` (catalogue in `.design-sync/config.json`, rules in `.design-sync/conventions.md`) |
| Domain screens                       | `apps/mfe-*/src/views/` (region components + `use<Name>Workflow` hooks + `-state.ts`)   |
| Data access per screen               | `apps/mfe-*/src/lib/app-data/` (`-model` / `-reads` / `-commands`)                      |
| Valuation report fill                | `apps/mfe-evaluator/src/lib/evaluator/valuation-report-fill-model.ts` — fill the template's existing places only; never add rows |
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
| PDF actions answer 503                    | Gotenberg is not running: `npm run dev:infra`                                            |
| Sign-in fails                             | Start Docker and `dev:api`; use a demo mobile from [Demo sign-in](#demo-sign-in)        |
| A specialist action is refused with a sub-role message | That stage belongs to another sub-role; sign in as its owner (see [Roles](#roles)) |
| Arabic text saved as `????`               | Do not pass Arabic through the Windows shell; send JSON from a UTF-8 file (`curl -d @file`) |
| TypeScript path `@/` errors               | Restart the TypeScript server from the repository root                                  |

---

## Testing a full transaction

Session drivers under `e2e/` (dot-prefixed, not CI tests) run real transactions from the work order to the Enfaz handover. They go through the endpoints each screen saves to, as the role that owns each step. They write only `E2E-` work orders, and their output goes to `test-results/` (git-ignored).

| Driver                         | Purpose                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| `e2e/.az30-run.mjs`            | One scenario from `e2e/.az30-scenarios*.mjs` (30 scenarios: property types, returns, failures, cancellation, report version 2, linked deeds). `MSYS_NO_PATHCONV=1 SCN=04 npx -y tsx e2e/.az30-run.mjs`; resume with `STAGE=<stage>` |
| `e2e/.az30-lib.mjs`            | The stages, with real inspection photos. A step refused to the review specialist falls back to the study, then the coordination specialist. Adds the review steps (approve study, accept value, ready for upload) |
| `e2e/.regress-values.mjs`      | Re-reads every recorded valuation, recomputes market, cost, reconciliation, liquidation and rounding independently, reads the printed report, and lists what changed since the recorded baseline |
| `e2e/.finish-transaction.mjs`  | Takes a valued transaction through submit, draft, approval, deposit and handover            |

Run them after any change to valuation or the report. A difference from the baseline must have a reason before it ships.

---

## Remaining work

Headline items:

- **SMS login codes:** switch them on for production
- **PII / attachment-scope security pass**
- **Valuation report decision:** section 17 «القيمة بطريقة المقارنة» prints the market value before rounding, while the weighting table uses the rounded value. Decide which to print.
- **Open rulings from the 2026-11-05 A→Z night,** for example:
  - withdrawing an approval without a new draft
  - handover with an open failure
  - Enfaz fields without a screen
  - server-side checks on inspector photos
- **Offline document prefetch:** still lacks رخصة البناء، الكروكي، محضر التجزئة and خطاب التمكين

Deferred, not MVP blockers: Module Federation / independent MFE deploys, HttpOnly/BFF session, Cassandra.

---

## Documentation

| Document                                                       | Description                                                     |
| -------------------------------------------------------------- | --------------------------------------------------------------- |
| [CLAUDE.md](CLAUDE.md)                                         | Working rules: reuse before you write, where shared code lives, branches |
| [backend/README.md](backend/README.md)                         | Gateway, services, routes, EF migrations, tests                 |
| [apps/plan/FRONTEND.md](apps/plan/FRONTEND.md)                 | Frontend applications and shell                                 |
| [docs/architecture/](docs/architecture/)                       | Table ownership, boundary and frontend-size baselines, document types |
| [docs/PROJECT_OVERVIEW_AR.md](docs/PROJECT_OVERVIEW_AR.md)     | Project overview in Arabic                                      |
| [docs/terms/](docs/terms/)                                     | Terms dictionary                                                |
| [infra/HTTPS.md](infra/HTTPS.md)                               | TLS termination and certificate renewal                         |

Ejada Internal is intended for internal real-estate evaluation and case study operations.
