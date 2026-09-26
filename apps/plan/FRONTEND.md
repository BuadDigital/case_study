# Frontend applications — نظام إجادة الداخلي

The **`apps/`** folder holds the **browser applications** for **نظام إجادة الداخلي** (internal Ejada platform): a case-study and real-estate evaluation workspace. The UI is **Arabic, RTL**, and mirrors flows in [`requirements/`](../requirements/) (HTML prototypes and forms).

The repo uses a **microfrontend-ready monorepo**: one **Next.js shell** (`apps/shell`) hosts routing and layout; feature screens live in **`apps/mfe-*` library packages** imported by the shell (single deploy until Module Federation).

**See also:** [Project README](../README.md) (security, full stack, how to run everything) · [Architecture](../../docs/ARCHITECTURE.md) · [MFE + services roadmap](../../docs/MICROFRONTENDS_AND_MICROSERVICES.md)

---

## What this project is

The platform supports end-to-end work around **property case study** and **valuation**, including:

| Area | Examples in the app |
|------|---------------------|
| **دراسة الحالة** | أوامر العمل (PO), العقارات, الإسناد, الرفع المساحي, إدارة المفاتيح, إدارة التعذرات |
| **التقييم العقاري** | طلبات التقييم, نموذج المعاين |
| **الإدارة والعمليات** | لوحة التحكم, مؤشرات الأداء, إدارة المستخدمين, التقارير المالية |

Different **roles** (مدير الإدارة, مشرف دراسة الحالة, أخصائي, مقيم, معاين, مالي, …) see different menu items and permissions. Screens talk to the YARP gateway and owner APIs; **business data is persisted in PostgreSQL**, not mock arrays.

---

## What lives under `apps/`

```text
apps/
  shell/              ← host: login, layout, nav, PO sub-routes, party-task host (Next.js 16)
  mfe-evaluator/            ← @evaluator/mfe — مقيم عقاري
  mfe-case-study/           ← @case-study/mfe — PO + المعاملات النشطة + party queues
  mfe-engineering-office/   ← @engineering-office/mfe — الرفع المساحي (جهة)
  mfe-dashboard/            ← @dashboard/mfe — لوحة التحكم
  mfe-survey/               ← @survey/mfe — الرفع المساحي (/survey admin)
  mfe-keys/                 ← @keys/mfe — إدارة المفاتيح
  mfe-financial/            ← @financial/mfe — التقارير المالية
  mfe-kpi/                  ← @kpi/mfe — مؤشرات الأداء
  mfe-failures/             ← @failures/mfe — إدارة التعذرات (Failures API)
  mfe-settings/             ← @settings/mfe — الإعدادات + جميع حقول النظام
  mfe-valuation/            ← @valuation/mfe — طلبات التقييم (/valuation-requests)
```

**Platform domain split (F4b):** [MFE_PLATFORM_DOMAINS.md](./MFE_PLATFORM_DOMAINS.md)

### `shell` (host)

The **shell** is the application users open in the browser:

- **Login** and session (`/login`)
- **Layout**: sidebar, top bar, breadcrumbs, branding (`AppShell`)
- **Dynamic `[page]` router** — imports views from `@*/mfe` packages (see table below)
- **PO sub-routes** under `/po/*` (property create/edit, case-study workspace, failure form)
- **Party-task host** (`PartyActiveTaskViewHost`) — wires `@evaluator/mfe` extensions into `@case-study/mfe` party queues
- **Evaluator adapters** — `case-study/[taskId]` advisory panel + PO recall menu import `@evaluator/mfe`
- **Layout only** under `shell/src/components/views/` — `AppShell`, `AppBreadcrumb`, `NavIcon` (platform views live in `@*/mfe`)

Shared UI and auth live in **`packages/`** at the repo root (not inside `apps/`):

| Package | Role |
|---------|------|
| `@platform/app-shared` | PrototypeContext, registration flows, shared nav/constants |
| `@platform/ui-kit` | Styles (`prototype.css`), badges, shared look-and-feel |
| `@platform/auth-client` | Session storage, auth gate |
| `@platform/api-client` | Typed REST client against the gateway |
| `@platform/types` | `PageId`, `RoleId`, navigation types, `CASE_STUDY_READY_NAV` |
| `@case-study/mfe` | PO + active transactions, party queues, field-form, government-review |
| `@evaluator/mfe` | مقيم عقاري — upload, advisory panel, recall |
| `@engineering-office/mfe` | جهة الرفع المساحي — survey work panel |
| `@dashboard/mfe` | لوحة التحكم |
| `@survey/mfe` | الرفع المساحي (`/survey`) |
| `@keys/mfe` | إدارة المفاتيح |
| `@financial/mfe` | التقارير المالية |
| `@kpi/mfe` | مؤشرات الأداء |
| `@failures/mfe` | إدارة التعذرات — Failures API |
| `@settings/mfe` | users, courts, info-roles, system-fields-catalog |
| `@valuation/mfe` | `/valuation-requests` |

Run the shell from the **repository root**:

```bash
npm install
npm run dev
```

→ http://localhost:3000

---

## Microfrontend plan

**Done:** **F0** — monorepo structure, one deploy.  
**Done:** **F3** — logical MFE packages; shell hosts routes and layout (single deploy).  
**Done:** **F4b** — platform domain packages wired in `[page]/page.tsx` (dashboard, survey, keys, financial, KPI).  
**Done:** **F4c** — dashboard PO/property queries use `@platform/app-shared/prototype/work-orders-read` + `api-client` (zero `@case-study/mfe` imports in `@dashboard/mfe`).  
**Done:** **F4d** — shell `prototype-queries` imports shared loaders from `app-shared`; `usePropertyListItemsQuery` re-exported from `@dashboard/mfe`; settings `workOrdersApiConfig` from `app-shared`.  
**Deferred:** **F5** Module Federation until independent deploy is needed.

| Package | Routes / features |
|---------|-------------------|
| **`@dashboard/mfe`** | `/dashboard` |
| **`@survey/mfe`** | `/survey` — office-level survey admin (**not** `/active-survey` party queue) |
| **`@keys/mfe`** | `/keys` |
| **`@financial/mfe`** | `/financial` |
| **`@kpi/mfe`** | `/kpi` |
| **`@case-study/mfe`** | `/po/*`, `/active-primary-data`, `/bourse-inquiry`, `/active-distribution`, `/active-case-study`, `/field-form`, party queues |
| **`@engineering-office/mfe`** | جهة الرفع المساحي work panel (hosted from party-task / active-survey) |
| **`@failures/mfe`** | `/failures`, `/failure-types`, PO property failure form — Failures API |
| **`@settings/mfe`** | `/users`, `/courts`, `/case-study-info-roles`, `/system-fields-catalog` |
| **`@valuation/mfe`** | `/valuation-requests` |
| **`@evaluator/mfe`** | مقيم عقاري — property-appraisal queue, advisory, recall |

**Remains in shell only:** login, layout/nav (`AppShell`), Next.js route hosts, `PartyActiveTaskViewHost` (wires evaluator + engineering-office extensions into case-study queues).

The shell remains the **host**. Separate deploy URLs come in phase F5.

---

## What is not in `apps/`

| Location | Purpose |
|----------|---------|
| `backend/` | Nine ASP.NET APIs + YARP gateway (`docs/ARCHITECTURE.md`) |
| `infra/` | Docker Compose — nine Postgres databases, messaging, cache, PDF rendering |
| `requirements/` | Reference HTML — not runnable apps |
| `docs/` | Architecture, local infra, demo credentials, ADRs |

---

## Platform stack (infra + backend — not inside `apps/`)

The **shell and MFE packages** talk to the YARP gateway; the **platform services** below run in Docker for local dev. Config: [`infra/docker-compose.yml`](../../infra/docker-compose.yml). Database names: [`docs/DATABASE_OVERVIEW.md`](../../docs/DATABASE_OVERVIEW.md).

```bash
# From repository root
npm run dev:infra        # postgres, rabbitmq, redis, gotenberg
```

### At a glance

| Technology | Role in this project | In local Docker? | Wired in app code yet? |
|------------|----------------------|------------------|-------------------------|
| **PostgreSQL 17** | System of record — nine owner databases on `127.0.0.1:5433` | Yes (`ree-postgres`) | Yes — every domain API |
| **RabbitMQ** | Integration events from the transactional outbox (ADR 0004) | Yes (`5672`, UI `15672`) | Yes — outbox dispatcher + consumers |
| **Redis** | Cache | Yes (`6379`) | Yes |
| **Gotenberg** | HTML → PDF for valuation report links | Yes (`3010`) | Yes — valuation service |
| **Prometheus / Grafana / Elasticsearch / Kibana / Fluent Bit** | Metrics and log stack | **Removed (2026-09)** to save RAM | Services still export OTLP, nothing receives it |
| **Cassandra** | Massive append-only store | **No** | **Deferred** — Postgres for MVP |

### How they fit together

```text
Browser (shell / MFE packages, one Next.js deploy)
    → YARP gateway :5160
        → Nine .NET APIs
            → PostgreSQL (one database per owner + messaging)
            → Local blob store (Attachments)
            → SQL outbox → RabbitMQ → consumers with a SQL inbox (ADR 0004)
            → Redis (cache), Gotenberg (report PDFs)

Logs: Docker json-file (`docker compose logs`); no metrics or log store runs.
```

Details: [MFE + services roadmap](../../docs/MICROFRONTENDS_AND_MICROSERVICES.md) section 6.1.

---

## Remaining work (frontend)

- [x] Per-role login (`@ejadah.dev` users) — role from `GET /api/permissions` (`prototypeRole`), not a sidebar switcher
- [x] Retire leftover `*-storage.ts` facades — `tasks.ts`, `courts-catalog.ts`, `infath-deposit.ts`; baseline freeze is empty
- [x] Component-size ratchet — seven screens split under 700 lines (`PropertyDetailInspectionTab`, `CaseStudyWorkspaceView`, `EvaluatorValuationReportOutputTab`, `EvaluatorWindow`, `AdjustmentsMatrixCells`, `ValuationWorkShell`, `login/page.tsx`)
- [x] Create `mfe-case-study` + `@platform/app-shared` for API-ready flows (PO + primary data + bourse + distribution) — F3 complete (single deploy)
- [x] Platform domain MFEs (`dashboard`, `survey`, `keys`, `financial`, `kpi`) — F4b complete
- [x] Wire `@valuation/mfe` in shell `[page]/page.tsx`
- [x] Remove orphaned shell view copies (`SurveyView`, `KeysView`, `FinancialView`, `KpiView`, `ValuationRequestsView`) — F4c complete
- [ ] Module Federation + CI deploy per app (F5) — deferred until independent release is needed
- [x] Replace mock data with `@platform/api-client` calls (owner APIs via the gateway)
- [x] PO/property detail and case-study flows on `@case-study/mfe`

Full checklist: [README.md](../README.md) · Architecture: [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md)
