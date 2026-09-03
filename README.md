# Ejada Internal — Real Estate Evaluation and Case Study Platform

**نظام إجادة الداخلي** is an internal platform for property case study, valuation workflows, and operations. The interface is Arabic (RTL).

Current stack: Next.js 16, React 19, TypeScript 5, ASP.NET Core 10, PostgreSQL, Docker Compose. The architecture targets microfrontends and domain microservices behind an API gateway. Core case-study and valuation flows are API-backed; specialist valuation extras sync to `SpecialistReportExtrasJson` (IndexedDB offline cache).

---

## Table of contents

- [About the project](#about-the-project)
- [Capabilities](#capabilities)
- [Security](#security)
- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Platform and observability](#platform-and-observability)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [API endpoints](#api-endpoints)
- [Interface](#interface)
- [Screens and modules](#screens-and-modules)
- [Repository contents](#repository-contents)
- [Running and maintaining the project](#running-and-maintaining-the-project)
- [Delivery sequence](#delivery-sequence)
- [Remaining work](#remaining-work)
- [Documentation](#documentation)

---

## About the project

Ejada Internal supports purchase orders, properties, assignment, survey offices, keys, impediments (تعذرات), valuation requests, field inspection, financial reporting, and KPIs. The user interface follows the HTML references in `requirements/`.

The application comprises:

- a Next.js 16 shell (microfrontend-ready monorepo) for the web UI
- ASP.NET Core 10 gateway and domain services with JWT and ASP.NET Identity
- PostgreSQL as the system of record
- Docker Compose for local platform services (RabbitMQ, Redis, Jaeger, Prometheus, Grafana, Elasticsearch, Kibana, Fluent Bit)

Infrastructure runs locally. Observability and some domain events (RabbitMQ) are not fully connected in application code.

### Prototype roles

| Role | Arabic label (examples) |
|------|-------------------------|
| General Manager | مدير الإدارة العام |
| Section Supervisor | مشرف قسم دراسة الحالة |
| Operations Coordinator | منسق العمليات |
| Case Specialist | أخصائي دراسة الحالة |
| Report Preparer | معد التقرير |
| Court Delegate | مندوب المحكمة |
| Valuation Coordinator | منسق التقييم |
| Real Estate Appraiser | مقيم عقاري |
| Field Inspector | معاين ميداني |
| Financial Officer | موظف الشؤون المالية |

---

## Capabilities

### Management and supervision

- Executive dashboard with KPIs, workload, and team overview
- Role-based navigation: sidebar pages from `GET /api/permissions` for the signed-in user
- Financial reports and performance indicators
- View-only mode for the general manager on selected screens (for example users and purchase orders)

### Case study department

- Purchase orders: list, status, and progress
- Properties: registry and workflow stages (survey / valuation / study)
- Assignment and distribution across specialists
- Survey (الرفع المساحي): engineering offices and jobs
- Keys management (إدارة المفاتيح)
- Impediments (إدارة التعذرات): review, pending, and approval

### Valuation department

- Valuation requests: intake from case study and status tracking
- Field inspector form: on-site data and photographs (interface prototype)
- Coordination with case study (planned via RabbitMQ events)

### Platform and administration

- User management (إدارة المستخدمين): staff list and add-user form (name, role, email, contract type: موظف داخلي / متعاون / مزود خدمة). New accounts are created without a password. An administrator issues a single-use activation ticket; the holder sets a password at `/activate` (see `backend/README.md`, staff account activation)
- Sign-in with JWT in `sessionStorage`; Identity API on the backend
- Planned per-role accounts at `@ejadah.dev` (see `docs/DEMO_ROLE_CREDENTIALS.txt`)

---

## Security

Security spans the browser application, the API, and planned platform services. Authentication and route protection are in place. Server-side authorization for every domain endpoint, and production hardening, remain in progress.

### Authentication and session (implemented)

| Feature | Location | Description |
|---------|----------|-------------|
| Email and password sign-in | `POST /api/auth/login` | ASP.NET Identity against PostgreSQL |
| JWT access tokens | `JwtTokenService` | HMAC-SHA256; issuer, audience, lifetime, and signing key validation |
| Token expiry | JWT (8 hours in development) | `expiresAtUtc` returned to the client; validated on each API call |
| Protected API route | `GET /api/auth/me` | Requires `[Authorize]` (Bearer JWT) |
| Client session store | `@platform/auth-client` | Token and profile in `sessionStorage` (cleared when the tab closes) |
| Application auth gate | `PrototypeAppGate` (`apps/shell`) | Unauthenticated users are redirected to `/login` |
| Sign-out | `AppShell` | Clears the session and navigates to `/login` |
| HTTPS redirection | API `Program.cs` | `UseHttpsRedirection()` |
| Password policy (Identity) | `Program.cs` | Minimum 8 characters, upper, lower, digit, non-alphanumeric |
| Unique email | Identity | `RequireUniqueEmail = true` |

Sign-in flow:

```text
Browser → POST /api/auth/login (email, password)
       ← JWT + user + expiresAtUtc
       → sessionStorage["auth"]
       → application routes under PrototypeAppGate
Subsequent API calls → Authorization: Bearer <token>
```

### Authorization and access control (partial)

| Feature | Status | Description |
|---------|--------|-------------|
| Role-based navigation | Implemented | Sidebar from `GET /api/permissions` (`pages` and `capabilities`) |
| View-only mode (general manager) | Implemented (UI) | Read-only on purchase orders, users, keys, survey, failures, and valuation |
| Workflow permissions | Implemented (UI) | For example specialist versus supervisor paths in `FailuresView` |
| JWT role claims | In progress (backend) | Token may include `ClaimTypes.Role`; the frontend uses the permissions API |
| Server-side authorization | Planned | Domain endpoints will use `[Authorize(Roles = "...")]` |
| Per-route API policies | Planned | Gateway and service policies when services are split |

Navigation and capabilities come from the permissions API for the signed-in user. To act as another role, sign out and sign in with a different account.

### Application and transport security

| Feature | Status | Notes |
|---------|--------|-------|
| CORS | Implemented (development) | API allows `http://localhost:3000` only (default policy) |
| Secrets in configuration | Development only | Database password in `appsettings.Development.json`; JWT key in `appsettings.json`. Override in production. |
| Environment override for the database | Implemented | `REAL_ESTATE_EVAL_PG_CONNECTION_STRING` |
| User secrets / Key Vault | Planned | Use .NET user secrets or a cloud vault for production keys |
| Add-user credentials | Implemented | Create-user APIs return no secret; accounts start without a password and are claimed with a single-use 24-hour activation ticket |
| Attachment uploads | Implemented | Content identified by magic bytes; declared MIME type and extension must agree; allow-list is JPEG, PNG, GIF, WebP, and PDF |
| No passwords in JWT | Implemented | Claims and metadata only |
| EF Core migrations | Implemented | Schema applied on startup; seeded administrator user |

### Planned platform controls

| Feature | Technology | Purpose |
|---------|------------|---------|
| Rate limiting | Redis / gateway | Throttle sign-in and sensitive APIs |
| Token refresh and revoke | Identity and Redis blocklist | Short-lived access token; refresh or revoke on sign-out |
| Centralized audit log | Elasticsearch or PostgreSQL | Changes to purchase order, property, and failure status |
| Secrets management | Kubernetes Secrets or Azure Key Vault | No keys in source control |
| TLS | Ingress / reverse proxy | HTTPS for the shell and API in production |
| Security headers | Shell / gateway | CSP, HSTS, X-Frame-Options |
| Mutual TLS / service authentication | Between microservices | After services split behind the gateway |
| Cassandra | Optional later | High-volume audit only if PostgreSQL is insufficient |

### JWT configuration (backend)

Configure in each service `appsettings.json` (gateway, identity, case-study). Use user secrets or environment variables in production:

```json
"Jwt": {
  "Issuer": "RealEstateEval",
  "Audience": "RealEstateEval",
  "SigningKey": "<64+ character secret — never commit a production key>"
}
```

Optional frontend environment:

```env
NEXT_PUBLIC_API_URL=http://localhost:5160
```

### Production checklist

- [ ] Replace the development JWT signing key and rotate it regularly
- [ ] Store connection strings and the JWT key in user secrets or a vault, not in git
- [ ] Enforce HTTPS only; use secure cookies if the token moves off `sessionStorage`
- [ ] Seed operational users with `@ejadah.dev`; permissions from Identity and `UserProfile.PermissionLevel`
- [ ] Enforce roles on every API endpoint (`[Authorize]` and policies)
- [x] Do not store staff passwords in `localStorage`; use Identity `UserManager` only
- [ ] Add refresh tokens or a short TTL and re-authentication for sensitive actions
- [ ] Enable audit logging for administration and workflow approvals
- [ ] Restrict CORS to the production shell origin
- [ ] Security review of case study and valuation forms (PII, document uploads)

Report vulnerabilities to the project owner internally. Do not open public issues that include exploit details.

---

## Technology stack

| Area | Technology |
| :--- | :--- |
| Web application (host) | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4 |
| Monorepo | npm workspaces — `apps/shell`, `packages/*` |
| Shared packages | `@platform/ui-kit`, `@platform/auth-client`, `@platform/api-client`, `@platform/types` |
| Backend | ASP.NET Core 10, Entity Framework Core, ASP.NET Identity |
| Authentication | JWT Bearer, session storage (frontend), planned role claims |
| Database | PostgreSQL 17 |
| Message broker | RabbitMQ 3.13 (local; planned for domain events) |
| Cache | Redis 7 (planned) |
| Metrics | Prometheus and Grafana |
| Tracing | Jaeger and OpenTelemetry (planned) |
| Logs | Fluent Bit to Elasticsearch to Kibana |
| Wide-column store | Cassandra — deferred (MVP uses PostgreSQL) |
| Local infrastructure | Docker Compose (`infra/docker-compose.yml`) |
| Reference UI | HTML prototypes in `requirements/` |

---

## Architecture

The platform uses microfrontends on the client and a gateway with domain microservices on the server. See [backend/README.md](backend/README.md).

### Current structure (logical microfrontends, single deployment)

```text
property_study/
├── apps/
│   ├── shell/                 # Next.js host — login, layout, navigation, PO routes, evaluator
│   ├── mfe-case-study/        # @case-study/mfe — purchase orders and active transactions
│   ├── mfe-dashboard/         # @dashboard/mfe — dashboard
│   ├── mfe-survey/            # @survey/mfe — survey
│   ├── mfe-keys/              # @keys/mfe — keys
│   ├── mfe-financial/         # @financial/mfe — financial reports
│   ├── mfe-kpi/               # @kpi/mfe — performance indicators
│   ├── mfe-failures/          # @failures/mfe — impediments
│   ├── mfe-settings/          # @settings/mfe — users, courts, information roles, system fields
│   └── mfe-valuation/         # @valuation/mfe — valuation requests
├── packages/
│   ├── app-shared/            # prototype context, registration, navigation constants
│   ├── ui-kit/                # shared React chrome, tokens, badges
│   ├── auth-client/           # sessionStorage helpers
│   ├── api-client/            # HTTP clients
│   └── types/                 # PageId, RoleId, navigation types
├── backend/
│   ├── gateway/               # YARP API gateway (:5160)
│   ├── services/              # Identity, Case Study, and related services
│   └── RealEstateEval.{Domain,Application,Infrastructure}/
├── infra/                     # Docker Compose, Prometheus, Fluent Bit
├── docs/                      # architecture, local infrastructure, demo credentials
└── requirements/              # HTML prototypes (reference only)
```

### Microfrontend packages

| Package | Routes / scope |
|---------|----------------|
| shell | Login, layout, navigation, PO sub-routes, evaluator, party-task host |
| @dashboard/mfe | `/dashboard` |
| @survey/mfe | `/survey` |
| @keys/mfe | `/keys` |
| @financial/mfe | `/financial` |
| @kpi/mfe | `/kpi` |
| @case-study/mfe | `/po/*`, active transactions, bourse, distribution, field form, party queues |
| @failures/mfe | `/failures`, `/failure-types`, property failure form |
| @settings/mfe | `/users`, `/courts`, `/case-study-info-roles`, `/system-fields-catalog` |
| @valuation/mfe | `/valuation-requests` |

### Backend (current and planned)

```text
Browser → API Gateway (YARP) :5160
            → Identity Service        → PostgreSQL (shared development database)
            → Case Study Service      → PostgreSQL and RabbitMQ events
            → Valuation / Operations / Financial (planned)
            ↔ Redis (cache, planned)
```

### Observability (target)

```text
Services → OpenTelemetry → Jaeger (traces)
         → /metrics      → Prometheus → Grafana
         → JSON logs     → Fluent Bit → Elasticsearch → Kibana
```

Details: [docs/ARCHITECTURE_MICROFRONTENDS_AND_MICROSERVICES.md](docs/ARCHITECTURE_MICROFRONTENDS_AND_MICROSERVICES.md)

---

## Platform and observability

| Technology | Role | Local URL | Application wiring |
|------------|------|-----------|--------------------|
| PostgreSQL | OLTP / Identity | `localhost:5432` | Connected (API) |
| RabbitMQ | Asynchronous domain events | `5672`, UI `15672` (`dev` / `dev`) | Planned |
| Redis | Cache, locks, rate limits | `6379` | Planned |
| Prometheus | Metrics | http://localhost:9090 | Configuration only |
| Grafana | Dashboards | http://localhost:3001 (`admin` / `admin`) | Planned |
| Jaeger | Distributed tracing | http://localhost:16686, OTLP `4318` | Planned |
| Elasticsearch | Log and search index | http://localhost:9200 | Planned (via Fluent Bit) |
| Kibana | Log exploration | http://localhost:5601 (`fluentbit-*`) | Planned |
| Fluent Bit | Log collector | container `ree-fluent-bit` | Sample pipeline |
| Fluentd | Alternative log router | Not in Compose | Use Fluent Bit locally |
| Cassandra | Append-only store | Not in Compose | Deferred for MVP |

```bash
docker compose -f infra/docker-compose.yml up -d
```

Full guide: [docs/LOCAL_INFRA.md](docs/LOCAL_INFRA.md)

---

## Getting started

### Prerequisites

- Node.js 20 or later, and npm
- .NET SDK 10 (for the API)
- Docker Desktop (approximately 6 GB RAM free for Elasticsearch and Kibana)

### 1. Infrastructure (Docker)

From the repository root:

```bash
docker compose -f infra/docker-compose.yml up -d
docker compose -f infra/docker-compose.yml ps
```

### 2. Backend

From the repository root (starts the gateway, identity, and case-study services):

```bash
npm run dev:api
# Gateway: http://localhost:5160
```

See [backend/README.md](backend/README.md) for individual services (`dev:gateway`, `dev:identity`, `dev:case-study`).

Default seeded user after migrate and seed: `admin@local.dev` / `Admin123!`

### 3. Frontend

From the repository root:

```bash
npm install   # run again after git pull when package.json or package-lock.json changed
npm run dev
```

Open http://localhost:3000. Application routes include `/dashboard`, `/properties`, and `/users`.

```bash
npm run build   # production build
npm run lint    # ESLint
```

---

## Configuration

### Backend connection strings

Docker PostgreSQL (`infra/docker-compose.yml`): user `postgres`, password `Admin`, database `realestate_eval_dev`.

Override per service with `REAL_ESTATE_EVAL_PG_CONNECTION_STRING`, or edit `appsettings.Development.json` under `backend/services/identity/` and `backend/services/case-study/`.

### Frontend environment (optional)

```env
NEXT_PUBLIC_API_URL=http://localhost:5160
```

Used by `@platform/api-client` for sign-in (`/api/auth/login`).

### Planned demonstration users

See [docs/DEMO_ROLE_CREDENTIALS.txt](docs/DEMO_ROLE_CREDENTIALS.txt). These `@ejadah.dev` accounts are not yet seeded in the API.

### Connection strings (future services)

```text
PostgreSQL:  Host=localhost;Port=5432;Database=realestate_eval_dev;Username=postgres;Password=Admin
Redis:       localhost:6379
RabbitMQ:    amqp://dev:dev@localhost:5672/
Jaeger OTLP: http://localhost:4318
```

---

## API endpoints

Base URL (development): `http://localhost:5160`

### Authentication

| Method | Endpoint | Description | Authorization |
| :----- | :------- | :---------- | :------------ |
| `POST` | `/api/auth/login` | Email and password; returns JWT | Public |
| `POST` | `/api/auth/activate` | Redeem an activation ticket and set the first password | Public |
| `POST` | `/api/users/{id}/activation-ticket` | Mint a single-use activation ticket | `CanManageUsers` |

Response: `token`, `expiresAtUtc`, `user` (`id`, `email`, `displayName`).

### Domain APIs

| Area | Prefix | Status |
|------|--------|--------|
| Auth | `/api/auth` | Sign-in and `/me` |
| Users | `/api/users` | List, organization overview, HR/procurement/CRM registration |
| Work orders | `/api/work-orders` | Purchase orders and properties CRUD, prior deed, pending bourse |
| Courts | `/api/courts` | Catalog GET/PUT |

Workflow tasks, case-study form drafts, and some failure flows may still use browser `localStorage` until they are persisted. See `docs/progress.md`.

Future service split: [docs/ARCHITECTURE_MICROFRONTENDS_AND_MICROSERVICES.md](docs/ARCHITECTURE_MICROFRONTENDS_AND_MICROSERVICES.md).

---

## Interface

- Arabic RTL layout with IBM Plex Sans Arabic
- Design tokens in `globals.css` (navy primary, teal accent, status colours)
- Prototype components derived from `requirements/system_prototype_4.html` (`prototype.css`)
- Role-aware sidebar with grouped navigation (دراسة الحالة, التقييم العقاري, and related groups)
- Status badges for workflow stages, purchase-order and valuation-request status, and contract types
- Responsive tables, cards, KPI grids, and add-user dialogues
- Independent login page so layout remains stable after sign-out

---

## Screens and modules

| Module | Route | Description |
|--------|-------|-------------|
| Dashboard | `/dashboard` | KPIs, team, summaries |
| Purchase orders | `/po` | Purchase-order list and progress |
| Properties | `/properties` | Redirects to `/po` |
| Assignment | `/assignment` | Legacy redirect to `/dashboard` |
| Survey | `/survey` | Engineering offices |
| Keys | `/keys` | إدارة المفاتيح |
| Impediments | `/failures` | إدارة التعذرات |
| Valuation requests | `/valuation-requests` | Requests from case study |
| Field form | `/field-form` | Inspector form |
| System fields catalog | `/system-fields-catalog` | حقول النظام |
| Financial | `/financial` | Financial reports |
| KPI | `/kpi` | Performance indicators |
| Users | `/users` | إدارة المستخدمين |
| Login | `/login` | Authentication |
| Welcome | `/welcome` | Redirects to `/dashboard` (`next.config`) |

---

## Repository contents

| Area | Included | Notes |
|------|----------|-------|
| Principal user interface screens | Yes | Navigation and roles in `packages/app-shared`; some screens still use mock data |
| Sign-in and JWT | Yes | Requires the API and PostgreSQL |
| Security (Identity, JWT, auth gate, password policy) | Yes | See [Security](#security) |
| Role switcher (demonstration) | Yes | Sidebar control; not equivalent to server-side authorization |
| Add user | Yes | API (`POST /api/users/hr|proc|crm`) and registration wizards |
| Monorepo (F0) | Yes | `apps/shell` and `packages/*` |
| Logical microfrontends (F3 and F4b) | Yes | Case study, failures, settings, and platform domains; single deployment |
| Module Federation (F5) | No | Independent deploy URLs are not wired |
| Domain APIs (purchase orders, properties, courts, users) | Yes | Gateway and Identity / Case Study services — see `backend/README.md` |
| Per-role `@ejadah.dev` sign-in | No | Draft in `docs/DEMO_ROLE_CREDENTIALS.txt` |
| Docker platform stack | Yes | PostgreSQL, RabbitMQ, Redis, Jaeger, Prometheus, Grafana, Elasticsearch, Kibana, Fluent Bit |
| Application wiring to Redis, RabbitMQ, and Jaeger | No | Infrastructure runs; application code is not fully connected |
| Cassandra | No | Deferred; not in Docker Compose |
| Case study form UI | Yes | `CaseStudyForm` and `/case-study/[taskId]` |
| Registration flow UI | Yes | `RegisterUserFlow` and HR/procurement/CRM flows to the API |
| Purchase-order and property detail pages | Yes | `/po/{poNumber}/property/*` |
| Module Federation | No | Single Next.js deployment |

### Reference files (`requirements/`)

| File | Purpose |
|------|---------|
| `system_prototype_4.html` | Application shell, navigation, module screens |
| `case_study_form 2.html` | Case study form layout |
| `ejada-registration_1.html` | Registration and onboarding reference |

Open these in a browser to compare with the application at http://localhost:3000.

---

## Running and maintaining the project

### Daily development

Use three terminals (the API may be omitted only if the interface is used with mocks):

**Terminal 1 — infrastructure (once per session)**

```bash
docker compose -f infra/docker-compose.yml up -d
```

**Terminal 2 — backend (required for sign-in)**

```bash
npm run dev:api
```

**Terminal 3 — frontend**

```bash
npm install          # first time only
npm run dev
```

| Service | URL |
|---------|-----|
| Web application | http://localhost:3000 |
| API | http://localhost:5160 |
| RabbitMQ UI | http://localhost:15672 (`dev` / `dev`) |
| Grafana | http://localhost:3001 (`admin` / `admin`) |
| Jaeger | http://localhost:16686 |
| Kibana | http://localhost:5601 |

Without the API, screens can still use mock data, but `/login` requires the API for JWT. For interface-only work, use a session after one successful sign-in, or temporarily bypass `PrototypeAppGate` during design review.

**Stop local services:**

```bash
docker compose -f infra/docker-compose.yml down
# Interrupt the dotnet and npm processes (Ctrl+C)
```

### Where to change code

| Intent | Location |
|--------|----------|
| Labels, navigation, mock tables | `packages/app-shared/src/prototype/constants.ts` |
| Case-study, failures, or settings screens | `apps/mfe-case-study/`, `apps/mfe-failures/`, `apps/mfe-settings/` |
| Dashboard, survey, keys, financial, or KPI | `apps/mfe-dashboard/`, `apps/mfe-survey/`, `apps/mfe-keys/`, `apps/mfe-financial/`, `apps/mfe-kpi/` |
| System fields catalog or valuation requests | `apps/mfe-settings/`, `apps/mfe-valuation/` |
| Shell-only screens | `apps/shell/src/components/views/AppShell.tsx`, `NavIcon.tsx`, `AppBreadcrumb.tsx` |
| URL to screen mapping | `apps/shell/src/app/(app)/[page]/page.tsx` |
| Login page | `apps/shell/src/app/login/page.tsx` |
| Sidebar, layout, sign-out | `apps/shell/src/components/views/AppShell.tsx` |
| Role switcher | `packages/app-shared/src/contexts/PrototypeContext.tsx` |
| Shared styles and badges | `packages/ui-kit/` |
| Auth session helpers | `packages/auth-client/` |
| API base URL | `packages/api-client/` and `NEXT_PUBLIC_API_URL` |
| User registration and staff list | `@settings/mfe` and `@platform/app-shared/registration/` |
| Backend sign-in and users | `backend/services/identity/`, `backend/gateway/` — see `backend/README.md` |
| Docker and observability | `infra/docker-compose.yml`, `docs/LOCAL_INFRA.md` |

**Add a menu page:**

1. Add `PageId` in `packages/types/src/navigation.ts`
2. Add the navigation item and mock data in `constants.ts`
3. Create `YourView.tsx` in the matching `apps/mfe-*/src/views/` package (or add a new `@*/mfe` workspace)
4. Export from the MFE `index.ts` and register in `[page]/page.tsx` (`VIEWS` map)
5. Add the page to each role `pages` array in `ROLES`

### Working with prototypes

1. Open `requirements/system_prototype_4.html` in Chrome or Edge.
2. Compare with http://localhost:3000 (same role via the sidebar switcher).
3. For new forms, start from `case_study_form 2.html` or `ejada-registration_1.html`, then port layout into React and `prototype.css`.
4. Do not copy prototype JavaScript business logic. Keep mock data in `constants.ts` until APIs exist.

To reset the session, sign out from the top bar, or clear the auth token in developer tools (`sessionStorage` key used by `@platform/auth-client`).

### Troubleshooting

| Problem | Action |
|---------|--------|
| Port 3000 in use | Stop other `npm run dev` processes, or change the port in `apps/shell` |
| Port 5432 in use | Stop local PostgreSQL, or change the Compose port |
| Sign-in fails | Start Docker and `npm run dev:api`; use `admin@local.dev` / `Admin123!` |
| Elasticsearch out of memory | Lower `ES_JAVA_OPTS` in `infra/docker-compose.yml`, or allocate more RAM to Docker |
| TypeScript path `@/` errors | Restart the TypeScript server; open the repository root; see `tsconfig.json` references |
| Added users disappeared | Stored in `localStorage` for that browser profile only |
| Grafana empty | Expected until applications export `/metrics` to Prometheus |

More: [docs/LOCAL_INFRA.md](docs/LOCAL_INFRA.md)

---

## Delivery sequence

Recommended order while product rules are still under discussion:

```text
Phase 0 (complete)  Monorepo, screens, mock data, Docker infrastructure
       ↓
Phase 1 (complete)  Logical MFEs (case-study, evaluator, …), shell composition,
                    JWT + permissions API, work-order / workflow APIs live
       ↓
Phase 2 (in progress) Finish remaining local→API domain persistence;
                      harden authorization on every endpoint
       ↓
Phase 3             Extract remaining backend domain services (valuation ops already started)
       ↓
Phase 4             RabbitMQ and Redis wired in application code
       ↓
Phase 5             OpenTelemetry, Prometheus, and Kibana in application code
       ↓
Phase 6             Module Federation and separate deployments per microfrontend
```

| Goal | Owner | Action |
|------|-------|--------|
| Interface parity | Frontend | Match `requirements/*.html`; track gaps in issues |
| Roles and permissions | Product and backend | Finalize the role matrix; JWT claims on all domain routes |
| Case study rules | Product | Keep field contracts aligned with live APIs |
| Microservices | Architecture | Follow [the architecture document](docs/ARCHITECTURE_MICROFRONTENDS_AND_MICROSERVICES.md), phases A–E |
| Observability | Operations | Confirm OTLP → Jaeger/Prometheus in each environment |
| MFE boundaries | Frontend | Keep case-study ↔ evaluator via shell bridges only (no package cycles) |

---

## Remaining work

### Complete

- Principal user interface screens (Arabic RTL) across shell + logical MFEs
- Monorepo F0–F4 style: `apps/shell` composes `@case-study/mfe`, `@evaluator/mfe`, and other domain packages
- Gateway, Identity, Case Study, and Valuation services; PostgreSQL; Docker platform stack
- JWT sign-in, permissions-driven navigation, staff add-user + activation flow
- Work-order / PO intake, workflow tasks, and party submissions on live APIs (not mock-only)
- Evaluator valuation-report pipeline with unit coverage; case-study ↔ evaluator **runtime bridge** (no circular package dependency)
- Specialist valuation extras persisted on `WorkOrderProperty.SpecialistReportExtrasJson` (IndexedDB as offline cache)
- Audit append bound to JWT actor + upstream-only dispatch routes (`X-REE-Upstream`)
- Numbered-document allocate/list gated by `ManageWorkOrders`
- Rate limiting + CORS helpers; RabbitMQ outbox/consumers; Redis caching; OpenTelemetry OTLP export (infra already in Compose)
- Release scripts: MFE typecheck, unit tests, Playwright smoke/journeys

### In progress or planned

**Frontend**

- [ ] Module Federation (F5) and independent MFE deploys
- [ ] Continue relocating `lib/prototype/*` into `lib/domain` / `lib/storage`
- [ ] Move remaining evaluator→case-study type/runtime/UI imports onto shared packages / bridges
- [ ] HttpOnly/BFF session (replace localStorage JWT) if required by security review
- [ ] Registration flow if in scope for first production release

**Backend**

- [ ] Finish extracting Operations and Financial services behind the gateway (dispatch already internal-header gated)
- [ ] Promote specialist extras fields to first-class columns when product freezes the schema
- [ ] Fluent Bit / Serilog → Elasticsearch → Kibana (JSON console logging today)

**Platform / ops**

- [ ] Production cutover: fill `infra/production.env.example`, TLS, GH secrets (see `docs/DEPLOYMENT_HETZNER.md`)
- [ ] Cassandra only if a high-volume audit requirement appears

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/DATABASE_OVERVIEW.html](docs/DATABASE_OVERVIEW.html) | Current PostgreSQL schema (HTML) |
| [docs/DATABASE_OVERVIEW.md](docs/DATABASE_OVERVIEW.md) | Same content in Markdown |
| [docs/FRONTEND.md](docs/FRONTEND.md) | Frontend applications, shell, microfrontend plan |
| [apps/README.md](apps/README.md) | Pointer to `docs/FRONTEND.md` |
| [backend/README.md](backend/README.md) | Gateway, services, `dev:api`, routes |
| [docs/ARCHITECTURE_MICROFRONTENDS_AND_MICROSERVICES.md](docs/ARCHITECTURE_MICROFRONTENDS_AND_MICROSERVICES.md) | Architecture and phases |
| [docs/LOCAL_INFRA.md](docs/LOCAL_INFRA.md) | Docker services, URLs, troubleshooting |
| [docs/DEMO_ROLE_CREDENTIALS.txt](docs/DEMO_ROLE_CREDENTIALS.txt) | Draft `@ejadah.dev` demonstration accounts |
| [docs/DEPLOYMENT_HETZNER.md](docs/DEPLOYMENT_HETZNER.md) | Production deployment: host preparation, TLS, secrets, CI/CD |
| [infra/HTTPS.md](infra/HTTPS.md) | TLS termination and certificate renewal |

Ejada Internal is intended for internal real-estate evaluation and case study operations.
