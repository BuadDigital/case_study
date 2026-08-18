# Frontend applications — نظام إجادة الداخلي

The **`apps/`** folder holds the **browser applications** for **نظام إجادة الداخلي** (internal Ejada platform): a case-study and real-estate evaluation workspace. The UI is **Arabic, RTL**, and mirrors flows in [`requirements/`](../requirements/) (HTML prototypes and forms).

The repo uses a **microfrontend-ready monorepo**: one **Next.js shell** (`apps/shell`) hosts routing and layout; feature screens live in **`apps/mfe-*` library packages** imported by the shell (single deploy until Module Federation).

**See also:** [Project README](../README.md) (security, full stack, how to run everything) · [Architecture](./ARCHITECTURE_MICROFRONTENDS_AND_MICROSERVICES.md) · [Local infra](./LOCAL_INFRA.md)

---

## What this project is

The platform supports end-to-end work around **property case study** and **valuation**, including:

| Area | Examples in the app |
|------|---------------------|
| **دراسة الحالة** | أوامر العمل (PO), العقارات, الإسناد, الرفع المساحي, إدارة المفاتيح, إدارة التعذرات |
| **التقييم العقاري** | طلبات التقييم, نموذج المعاين |
| **الإدارة والعمليات** | لوحة التحكم, مؤشرات الأداء, إدارة المستخدمين, التقارير المالية |

Different **roles** (مدير الإدارة, مشرف دراسة الحالة, أخصائي, مقيم, معاين, مالي, …) see different menu items and permissions. Screens are implemented; **business data is still mock** on the frontend while product and backend agree on core logic.

---

## What lives under `apps/`

```text
apps/
  shell/              ← host: login, layout, nav, PO sub-routes, party-task host (Next.js 16)
  mfe-evaluator/      ← @evaluator/mfe — مقيم عقاري (property-appraisal queue, advisory, recall)
  mfe-case-study/     ← @case-study/mfe — PO + المعاملات النشطة + party queues (API-ready)
  mfe-dashboard/      ← @dashboard/mfe — لوحة التحكم
  mfe-survey/         ← @survey/mfe — الرفع المساحي (/survey)
  mfe-keys/           ← @keys/mfe — إدارة المفاتيح
  mfe-financial/      ← @financial/mfe — التقارير المالية
  mfe-kpi/            ← @kpi/mfe — مؤشرات الأداء
  mfe-failures/       ← @failures/mfe — إدارة التعذرات (localStorage until API)
  mfe-settings/       ← @settings/mfe — الإعدادات + جميع حقول النظام (API)
  mfe-valuation/      ← @valuation/mfe — طلبات التقييم (/valuation-requests)
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
| `@platform/api-client` | API base URL (placeholder for real services) |
| `@platform/types` | `PageId`, `RoleId`, navigation types, `CASE_STUDY_READY_NAV` |
| `@case-study/mfe` | PO + active transactions, party queues, field-form, government-review |
| `@evaluator/mfe` | مقيم عقاري — upload, advisory panel, recall (localStorage prototype) |
| `@dashboard/mfe` | لوحة التحكم |
| `@survey/mfe` | الرفع المساحي (`/survey`) |
| `@keys/mfe` | إدارة المفاتيح |
| `@financial/mfe` | التقارير المالية |
| `@kpi/mfe` | مؤشرات الأداء |
| `@failures/mfe` | إدارة التعذرات — repository + localStorage prototype |
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
| **`@failures/mfe`** | `/failures`, `/failure-types`, PO property failure form — **localStorage** until backend exists |
| **`@settings/mfe`** | `/users`, `/courts`, `/case-study-info-roles`, `/system-fields-catalog` |
| **`@valuation/mfe`** | `/valuation-requests` |

**Remains in shell only:** login, layout/nav (`AppShell`), PO Next.js pages, evaluator prototype, `PartyActiveTaskViewHost`.

The shell remains the **host**. Separate deploy URLs come in phase F5.

---

## What is not in `apps/`

| Location | Purpose |
|----------|---------|
| `backend/` | ASP.NET API (Identity/JWT today; domain APIs later) |
| `infra/` | Docker Compose — databases, messaging, cache, observability |
| `requirements/` | Reference HTML — not runnable apps |
| `docs/` | Architecture, local infra, demo credentials, this guide |

---

## Platform stack (infra + backend — not inside `apps/`)

The **shell and future MFEs** talk to APIs; the **platform services** below run in Docker for local dev. Config: [`infra/docker-compose.yml`](../infra/docker-compose.yml). URLs: [LOCAL_INFRA.md](./LOCAL_INFRA.md).

```bash
# From repository root
docker compose -f infra/docker-compose.yml up -d
```

### At a glance

| Technology | Role in this project | In local Docker? | Wired in app code yet? |
|------------|----------------------|------------------|-------------------------|
| **PostgreSQL** | System of record (Identity today; per-service DBs later) | Yes (`5432`) | Yes — API uses it |
| **RabbitMQ** | Async events between microservices | Yes (`5672`, UI `15672`) | No — planned Phase B+ |
| **Redis** | Cache, locks, rate limits, hot dashboard reads | Yes (`6379`) | No — planned Phase A–B |
| **Prometheus** | Metrics (latency, errors, queue depth) | Yes (`9090`) | No — scrape targets TBD |
| **Grafana** | Dashboards on Prometheus (+ Jaeger) | Yes (`3001`) | Provisioned; empty until apps export metrics |
| **Jaeger** | Distributed tracing | Yes (UI `16686`, OTLP `4317`/`4318`) | No — OpenTelemetry not in apps yet |
| **Elasticsearch** | Log and search index store | Yes (`9200`) | No — via Fluent Bit |
| **Kibana** | Explore logs in Elasticsearch | Yes (`5601`) | Index pattern `fluentbit-*` |
| **Fluent Bit** | Log collector (Fluentd family) | Yes (`ree-fluent-bit`) | Sample → ES |
| **Fluentd** | Heavier log router (same family) | Not in compose | Use Fluent Bit locally |
| **Cassandra** | Massive append-only store | **No** | **Deferred** — Postgres for MVP |

### How they fit together

```text
Browser (shell / MFEs)
    → API Gateway / BFF (planned)
        → Microservices (.NET)
            → PostgreSQL (each service)
            → Redis (cache)
            → RabbitMQ (events)

Observability (planned):
    Services → OpenTelemetry → Jaeger + Prometheus
    Services → logs → Fluent Bit → Elasticsearch → Kibana
    Grafana ← Prometheus
```

Details: [ARCHITECTURE_MICROFRONTENDS_AND_MICROSERVICES.md](./ARCHITECTURE_MICROFRONTENDS_AND_MICROSERVICES.md) section 6.1.

---

## Remaining work (frontend)

- [ ] Per-role login (`@ejadah.dev` users) — role from server, not only the sidebar switcher
- [x] Create `mfe-case-study` + `@platform/app-shared` for API-ready flows (PO + primary data + bourse + distribution) — F3 complete (single deploy)
- [x] Platform domain MFEs (`dashboard`, `survey`, `keys`, `financial`, `kpi`) — F4b complete
- [x] Wire `@valuation/mfe` in shell `[page]/page.tsx`
- [x] Remove orphaned shell view copies (`SurveyView`, `KeysView`, `FinancialView`, `KpiView`, `ValuationRequestsView`) — F4c complete
- [ ] Module Federation + CI deploy per app (F5)
- [ ] Replace mock data with `@platform/api-client` calls
- [ ] PO/property detail; case study form (`requirements/case_study_form 2.html`); registration (`requirements/ejada-registration_1.html`) if in scope

Full checklist: [README.md](../README.md) · Architecture: [ARCHITECTURE_MICROFRONTENDS_AND_MICROSERVICES.md](./ARCHITECTURE_MICROFRONTENDS_AND_MICROSERVICES.md)
