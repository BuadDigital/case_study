# Project Progress — (نظام إجادة الداخلي)

**Last updated:** 17 June 2026 (full microservices split + permissions API; prototype role switcher removed)

**Repo:** [BuadDigital/case_srudy](https://github.com/BuadDigital/case_srudy) · branch `main` · pushed `266be9b`  
**Audience:** Project manager and developers — single handoff document.

---

## Executive summary


| Layer             | What is real today                                                                                                               | What is prototype-only                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **PostgreSQL**    | Users, profiles (HR/Proc/CRM), work orders, properties, contacts, courts catalog, **workflow tasks**, **case study forms**, **info-role matrix**, **party submissions**, **PropertyFailures**, **field dictionary**, **failure-types catalog**, **PO intake drafts**, **delegation letters**, **evaluator recalls**, **property keys**, **survey offices**, **valuation requests**, **financial report config**, **custom assigned screens**, **file attachments** (metadata + blob path), **outbox messages** — schemas split per domain (`identity`, `case_study`, `platform`, …) | Some MFE screens still read **browser cache** for PDF bytes while attachments API is rolling out |
| **ASP.NET API**   | **YARP gateway** (:5160) → **9 domain services** (Identity :5161 … Attachments :5169); monolith `RealEstateEval.Api` **deleted**; Reporting **BFF** calls upstream via HTTP; **Redis** on hot reads; **RabbitMQ** outbox for `valuation.request.created` | True **physical DB-per-service** (dev still one Postgres DB + shared `ApplicationDbContext`) |
| **Next.js shell** | Host + layout; MFEs via `[page]/page.tsx`; **nav + route access from `GET /api/permissions`** (`PageAccessGate`, `hasCapability()`); username login; dashboard/KPI/financial/survey/keys/valuation wired to APIs | **`po-roles.ts`** and some action buttons still use client `role` checks; **الرفع على إنفاذ** assistant deferred |


**Demo path:** Login → PO list/intake → properties per PO → **البيانات الأولية** → **استعلام بورصة** (حالة الصك: فعال / غير فعال → متعذر) → **توزيع المعاملات** → **دراسة حالة العقارات** → **نموذج الدراسة** → party tasks → **إدارة التعذرات** (supervisor) → **جميع حقول النظام** / **الإعدادات**.

---

## What is remaining (17 Jun 2026)

Work **not done** after commit `266be9b`. Grouped by priority for PM and dev handoff.

### P0 — finish what the microservices commit started

| # | Item | Where / notes |
| - | ---- | ------------- |
| 1 | **Attachments end-to-end** | `/api/attachments` exists; many flows still keep PDF bytes in browser (`assignment-doc-attachments.ts`, party submission `dataUrl`, engineering/appraiser uploads). Wire PO intake, party tasks, and property detail downloads to blob API only. |
| 2 | **Action-level RBAC** | Nav uses `GET /api/permissions`; buttons still use **`po-roles.ts`** + **`isSuperAdmin(role)`** on PO list, failures, settings, survey, keys, valuation, case-study workspace. Migrate to **`hasCapability()`** from `usePrototype()`. |
| 3 | **Failures UI off legacy cache** | `PropertyFailures` API is live; `@failures/mfe` repository port may still read **`evalFailureRecords`** localStorage. Property detail failures tab should be API-only. |
| 4 | **Assignee display names from API** | Task assignee **IDs** come from workflow API; **names** still resolved from **`distribution-party-accounts.ts`** (static demo map). Load display names from `/api/users` or task payload. |

### P1 — users, org, and permissions hardening

| # | Item | Where / notes |
| - | ---- | ------------- |
| 5 | **Users — edit / deactivate / search** | List + create work; **edit**, **deactivate**, and **search/filter** not complete (`UsersView.tsx`, `UsersController`). |
| 6 | **PROC org teams persistence** | `ProcOrgTeamsEditor` UI exists; teams **not saved to API/DB** yet. |
| 7 | **Capability catalog completeness** | `PlatformPermissionCatalog` covers nav pages; extend **`capabilities[]`** for every PO action currently in `po-roles.ts` (create PO, delete property, approve failure, etc.). |
| 8 | **Password login for production** | Dev uses **`login-username`** (no password). Email + password (`POST /api/auth/login`) ready but not the primary UX path. |

### P2 — screens and product gaps

| # | Item | Where / notes |
| - | ---- | ------------- |
| 9 | **Property detail — تقييم العقار tab** | Appraiser submission exists in API; tab on property detail is still a **placeholder**. |
| 10 | **الرفع على إنفاذ assistant** | Tab registered; full assistant UI from `infaz_upload_assistant_screen.html` **deferred** (placeholder only). |
| 11 | **PO list scale** | No **server-side pagination / search** on work orders list for large datasets. |
| 12 | **Case study form validation** | Matrix rules (أصيل/ثانوي/معتمد) enforced in UI; **server-side validation** on submit not complete. |
| 13 | **Dashboard team load card** | Reporting BFF wired; some **team/load rows** may still use mock constants (`TeamCurrentLoadCard.tsx`). |
| 14 | **Courts nav styling** | Courts API-backed; sidebar may still show **placeholder/red** styling until PM signs off. |
| 15 | **system-tools** | Intentionally static catalog — no API planned unless PM requests. |

### P3 — backend and platform (production path)

| # | Item | Where / notes |
| - | ---- | ------------- |
| 17 | **Physical DB-per-service** | Connection string **keys** per service exist; dev still **one Postgres DB** + shared **`ApplicationDbContext`**. Split contexts or databases per deployable. |
| 18 | **Shared Infrastructure coupling** | Domain entities and migrations still centralized in `RealEstateEval.Infrastructure`; long-term each service should own its persistence boundary. |
| 19 | **Observability stack** | Docker compose includes Jaeger, Prometheus, Grafana, ELK; **not fully wired** into all service startup paths for local dev. |
| 20 | **Integration events** | Outbox + `valuation.request.created` scaffolded; expand event catalog and consumers as valuation workflow grows. |
| 21 | **Contract / load tests** | No automated API contract tests or load test suite in CI yet (build-only workflow today). |
| 22 | **Module Federation (F5)** | Logical MFE split done; **independent deploy** via Module Federation still **deferred** (`apps/plan/FRONTEND.md`). |

### P4 — documentation and PM alignment

| # | Item | Where / notes |
| - | ---- | ------------- |
| 23 | **`docs/SYSTEM_BEHAVIOR_PM_REVIEW.md`** | Still describes sidebar role switcher in places — update for permissions API. |
| 24 | **`README.md`** | Some lines still reference removed `DEMO_ROLE_CREDENTIALS.txt` — update cross-links. |
| 25 | **Screen / field control specs** | Arabic specs under `docs/التحكم بالشاشات/` — implementation of screen-field control UI may be partial vs spec. |

### Deferred (agreed — not in current sprint)

| Item | See |
| ---- | --- |
| **أطراف التنفيذ** (court case parties as system users) | §16 — external parties only; extend contacts/enforcement fields later |
| **Court parties admin screen** | Out of scope until PM answers per-PO vs per-property model |

### Rough completion estimate (PM)


| Area | Done | Remaining |
| ---- | ---- | --------- |
| Core case-study transaction path (PO → party tasks) | ~90% | Attachments bytes, assignee names |
| Sidebar nav + route access | ~95% | Capability parity on buttons |
| Platform placeholder pages (survey, keys, financial, KPI, VR) | ~80% | Polish, real business rules |
| Users / org admin | ~60% | Edit, search, PROC teams |
| Production-ready backend | ~50% | DB split, tests, observability, blob adoption |
| Enfath upload assistant | ~5% | Tab placeholder only |

**Removed (17 Jun 2026):** Internal messaging (المراسلة الداخلية) — **out of scope**; no route, `PageId`, or MFE. Technical **outbox/RabbitMQ** for domain events remains (not user chat).

---

## Domain glossary (agreed — do not confuse)

Three separate concepts; **do not merge** in UI labels or data models.


| Concept                          | Who                                                                      | Uses the system?                                  | Where in product                                                                           |
| -------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **أطراف التنفيذ / أطراف القضية** | Parties in the **court enforcement case** (محكوم له/عليه، مالك، وكيل، …) | **No** — external; recorded as **case data** only | PO/property contacts, documents requested *from* them (see deferred §16)                   |
| **منفّذو العمل (إسناد داخلي)**   | Ejadah staff/vendors who **do the work** on a transaction                | **Yes**                                           | توزيع المعاملات → child tasks; e.g. **المحكمة → مراجع حكومي**، **المعاينة → معاين ميداني** |
| **أدوار المستخدمين (صلاحيات)**   | Login accounts — **which screens** each person sees                      | **Yes**                                           | JWT + **`GET /api/permissions`** (`pages`, `capabilities`)                                 |


**Removed (8 Jun 2026):** `/workflow-users` page (mislabelled «أطراف التنفيذ»). Internal assignees now come from `distribution-party-accounts.ts` + seeded users — **not** court parties (see deferred §16).

**Internal execution mapping (confirmed):**


| Work               | Internal role                                                          |
| ------------------ | ---------------------------------------------------------------------- |
| زيارة المحكمة      | مراجع حكومي (`government-reviewer`)                                    |
| المعاينة الميدانية | معاين ميداني (`field-inspector`)                                       |
| التقييم            | مقيم عقاري (`real-estate-appraiser`) — via valuation dept distribution |


---

## Repository layout

```
property_study/
├── apps/
│   ├── shell/               # Next.js 16 host (@platform/shell) — login, layout, party-task host routes
│   ├── mfe-case-study/      # @case-study/mfe — PO, active transactions, property detail, party queues
│   ├── mfe-engineering-office/  # @engineering-office/mfe — الرفع المساحي (map, checklist, submit/reopen)
│   ├── mfe-evaluator/       # @evaluator/mfe — تقييم العقار
│   ├── mfe-dashboard/       # @dashboard/mfe — لوحة التحكم (PO stats API + mock VR rows)
│   ├── mfe-failures/        # @failures/mfe — إدارة التعذرات (API + repository port; localStorage fallback)
│   ├── mfe-settings/        # @settings/mfe — الإعدادات + جميع حقول النظام
│   ├── mfe-survey/          # @survey/mfe — mock survey offices
│   ├── mfe-keys/            # @keys/mfe — mock keys
│   ├── mfe-financial/       # @financial/mfe — mock financial
│   ├── mfe-kpi/             # @kpi/mfe — mock KPI
│   ├── mfe-valuation/       # @valuation/mfe — mock valuation requests list
│   └── plan/                # Frontend planning notes (FRONTEND.md)
├── backend/
│   ├── gateway/             # YARP API gateway (:5160)
│   ├── services/            # Identity, Case Study, Operations, Reporting, Financial, Valuation, Failures, Platform, Attachments
│   ├── shared/              # RealEstateEval.Shared.{Contracts,Web}
│   ├── RealEstateEval.{Domain,Application,Infrastructure}/
│   ├── scripts/dev-api.mjs  # npm run dev:api — all services + gateway
│   └── README.md            # Gateway route table, ports, migrations
├── packages/
│   ├── app-shared/          # PrototypeContext, registration, party-submission-api cache, work-orders-read
│   ├── api-client/          # auth, users, work-orders, courts, workflow-tasks, case-study-forms, party-task-submissions, …
│   ├── auth-client/         # JWT session + AppAuthGate
│   ├── design-system/       # prototype.css, registration.css, StatusBadge
│   └── types/               # PageId, RoleId, user/org DTO types, CASE_STUDY_READY_NAV
├── infra/                   # docker-compose (Postgres + observability stack)
├── docs/                    # This file + DATABASE_OVERVIEW + PM review + credentials
├── requirements/            # HTML prototypes (reference)
└── package.json             # npm workspaces root scripts
```

**Frontend F3 (9 Jun 2026):** API-ready flows live in `@case-study/mfe`; shell hosts routes and layout; `npm run dev` / `npm run build` remain one app. Module Federation (F5) deferred until independent deploy is needed.

### F3 + cleanup — what was done (9 Jun 2026)

**Microfrontend split (logical F3, single deploy)**

- Created **`apps/mfe-case-study`** (`@case-study/mfe`) for API-ready case-study flows: `/po/*`, `/active-primary-data`, `/bourse-inquiry`, `/active-distribution`.
- Created **`packages/app-shared`** (`@platform/app-shared`) for host-shared code: `PrototypeContext`, registration flows, nav/constants, `prototypeKeys`, `field-errors`, `active-transactions` nav helpers.
- Shell routes are thin wrappers; views import from `@case-study/mfe` (no `@shell/` coupling in MFE).
- Moved PO queries, UI widgets (`PoNumber`, `StatValue`, `RowMoreMenu`, …) into `@case-study/mfe`.
- **`@failures/mfe`** — إدارة التعذرات (`/failures`), `FailureReportForm`, repository port + **`failures-api.ts`** (API primary; localStorage fallback during migration).
- **`@settings/mfe`** — users, courts, info-roles, system-tools.
- Added `CASE_STUDY_READY_NAV` to `@platform/types`; `mfe-case-study/src/routes.ts` is the route manifest.
- `apps/plan/FRONTEND.md` marks **F3 complete**; F5 (Module Federation) explicitly deferred.

**Dead-code cleanup**

- Removed **9 stale shell views** that duplicated MFE (`PoListView`, `PoPropertiesPage`, `MyTaskWorkView`, …) — already absent before final pass.
- Removed **42 duplicate files** under `apps/shell/src/components/prototype/` (`po-intake/`, `registration/`, `distribution/`, `active-transactions/`, `primary-data/`) — live copies in MFE or app-shared.
- Removed shell **re-export shims** (`active-transactions.ts`, `registration-data.ts`, `map-registration-to-staff.ts`); imports point at `@platform/app-shared`.
- Removed unused `CopyIconButton` and shell `components/ui/` duplicates; UI comes from `@case-study/mfe/components/ui/*`.

**Backend — info-role matrix API**

- New entity `CaseStudyInfoRolesConfig` + migration `20260609095419_AddCaseStudyInfoRolesConfig`.
- `CaseStudyInfoRolesController` — `GET` / `PUT` `/api/case-study-info-roles`.
- Frontend: `packages/api-client/src/case-study-info-roles.ts`; `apps/mfe-settings/src/lib/prototype/case-study-info-roles-storage.ts` reads/writes API (no `localStorage`).
- `SystemMaintenanceService` clears info-roles on dev reset.

**Still in shell (by design):** case study workspace route, party-task host (`PartyActiveTaskViewHost`), full-page party Next.js routes, layout chrome. Party **logic** lives in `@case-study/mfe`, `@engineering-office/mfe`, `@evaluator/mfe`.

**Known package coupling (acceptable for now):** `app-shared` imports `WorkflowTask` types from MFE (`import type`); `PrototypeAppGate` calls `bootstrapPrototypeAuth` (JWT session only — no persona switching).

### F4 platform MFEs + party submissions (10–14 Jun 2026)

**Platform domain packages (F4b — logical split, single deploy)**

- **`@dashboard/mfe`**, **`@survey/mfe`**, **`@keys/mfe`**, **`@financial/mfe`**, **`@kpi/mfe`**, **`@valuation/mfe`** — each owns its `*View.tsx`; shell `[page]/page.tsx` imports from `@*/mfe` only.
- **`@evaluator/mfe`** — appraiser work panel, advisory panel, submission storage.
- **`@engineering-office/mfe`** — engineering survey queue extensions, work panel, Google Maps, 13-item checklist, submit/reopen.
- **F4c:** Removed legacy orphan `*View.tsx` copies from shell (layout-only: `AppShell`, `AppBreadcrumb`, `NavIcon`). Documented in `FRONTEND.md`.
- **F4d:** Dashboard decoupled from `@case-study/mfe` — reads PO/property stats via `@platform/app-shared/prototype/work-orders-read.ts` + api-client.
- **F5 Module Federation** — still deferred.

**Full-page party work routes (shell)**

| Route | Party |
| ----- | ----- |
| `/active-survey/[taskId]` | المكتب الهندسي |
| `/property-appraisal/[taskId]` | المقيم العقاري |
| `/property-inspection/[taskId]` | المعاين الميداني |
| `/government-review/[taskId]` | المراجع الحكومي |
| `/valuation-coordination/[taskId]` | منسق التقييم |

**Backend — party task submissions API**

- Entity **`PartyTaskSubmissions`** + migration `20260614074003_AddPartyTaskSubmissions`.
- **`PartyTaskSubmissionsController`** — `GET/PUT /api/party-task-submissions/{taskId}`, `POST …/submit`, `POST …/reopen` (reopen: **engineering-survey** + **property-appraisal** only).
- **`PartyTaskSubmissionService`** — validates payload per kind; on submit marks workflow task **completed**.
- Supported kinds: `engineering-survey`, `property-appraisal`, `government-review`, `valuation-coordination`, `field-inspection`.
- Frontend: `packages/api-client/src/party-task-submissions.ts`; shared cache `packages/app-shared/src/prototype/party-submission-api.ts`.

**All five party work flows off localStorage (primary path = API)**

| Kind | MFE / storage module |
| ---- | -------------------- |
| Engineering survey | `@engineering-office/mfe` → `engineering-survey-submission-storage.ts` |
| Property appraisal | `@evaluator/mfe` → `evaluator-submission-storage.ts` |
| Government review | `government-review-work-storage.ts` (delegation letters on **API**; verify no localStorage fallback left) |
| Valuation coordination | `valuation-coordination-work-storage.ts` |
| Field inspection | `field-inspection-submission-storage.ts` (+ local cache fallback) |

**Property detail page (`PoPropertyDetailPage`) — UX**

- **مستندات العقار:** six source sections (PO · bourse · engineering · appraiser · inspection · empty states); download when browser has `dataUrl`.
- **الأطراف** tab: six party cards + **`PartyRoleDetailPanel`** loads each role’s submission via API (`property-detail-party-submissions.ts`).
- **تقرير دراسة الحالة** tab: read-only **`CaseStudyReportDocument`** + party progress rings via `PropertyDetailCaseStudyReport.tsx`.
- **مفاتيح العقار** tab: government reviewer keys/handover fields from party submission.
- **الرفع على إنفاذ** tab: placeholder only (full assistant deferred).
- Removed **نسبة إتمام البيانات** progress bars from report tab (misleading 50% track states).
- Timeline + party status sidebar driven from workflow tasks API; assignee **names** still resolved from `distribution-party-accounts.ts` (IDs from API).

**UI polish (same period)**

- RTL sidebar active indicator on the **right**.
- Breadcrumb dedup in `AppShell.tsx`; engineering situation stats in top bar (removed duplicate row above queue table).
- Google Maps: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `apps/shell/.env.local` (gitignored); default coords Jeddah Al-Balad for empty coordinates.

**Still prototype after F4** (partially addressed 17 Jun — see § What is remaining)

- Failures UI legacy cache path; **PDF bytes** adoption to attachments API.
- Property detail **تقييم العقار** tab — placeholder.
- ~~Platform pages: survey, keys, financial, KPI, valuation-requests~~ → **API wired 17 Jun**; business rules/polish remain.
- ~~Server-driven nav roles~~ → **done 17 Jun** — see § below.

### Microservices + permissions API (17 Jun 2026 — commit `266be9b`)

**Pushed to GitHub:** `main` @ `266be9b`.

#### Backend — monolith removed, 9 services + gateway

- **Deleted** `backend/RealEstateEval.Api/` (single-host monolith).
- **Added** YARP gateway `backend/gateway/RealEstateEval.Gateway/` — public **:5160**.
- **Domain services** (each own `Program.cs`, Dockerfile, Swagger in Dev/Docker):

| Service | Port | Main routes |
| ------- | ---- | ----------- |
| Identity | 5161 | `/api/auth/*`, `/api/users/*`, **`/api/permissions`** |
| Case Study | 5162 | PO, workflow, forms, party submissions, suspended transactions, PO intake drafts, system reset |
| Operations | 5163 | `/api/survey-offices/*`, `/api/property-keys/*` |
| Reporting | 5164 | `/api/reporting/*` — **BFF** (`ReportingUpstreamClient` → valuation/case-study/failures via gateway) |
| Financial | 5165 | `/api/financial/*` |
| Valuation | 5166 | `/api/valuation-requests/*`, `/api/evaluator-recalls/*` |
| Failures | 5167 | `/api/failures/*`, `/api/failure-types-catalog/*` |
| Platform | 5168 | `/api/field-dictionary/*`, `/api/courts/*`, `/api/case-study-info-roles/*`, `/api/custom-assigned-screens/*` |
| Attachments | 5169 | `/api/attachments/*` — blob storage (`LocalFileBlobStorage` dev) |

- **Shared:** `backend/shared/RealEstateEval.Shared.Web` — per-service DB connection keys, OpenAPI, correlation ID, health endpoints.
- **Infra wiring:** `infra/docker-compose.yml` — Postgres + RabbitMQ + Redis + observability stack; `npm run dev:api` starts all services (`backend/scripts/dev-api.mjs`).
- **CI:** `.github/workflows/backend-ci.yml` — `dotnet build` on `RealEstateEval.slnx`.

#### Backend — data & integration (same commit)

- **Schema split** migration `20260617145650_SplitDatabaseSchemas` — PostgreSQL schemas: `identity`, `case_study`, `platform`, `failures`, `operations`, `valuation`, `attachments`, `financial`, `messaging`.
- **New domain tables / APIs** (migrations `20260617095004` … `20260617142259`): custom assigned screens, prototype module configs (field dictionary, failure types, financial report), delegation letters, evaluator recalls, PO intake drafts, outbox messages, attachment blob metadata.
- **Permissions:** `PlatformPermissionCatalog` + `PermissionService` — `GET /api/permissions` returns `pages`, `capabilities`, `prototypeRole` per logged-in user; `GET /api/auth/me?includePermissions=true`.
- **Caching:** Redis via `AddRedisCaching` — reporting dashboard/KPI, financial summary, survey offices, courts.
- **Events:** outbox + `valuation.request.created` handler; RabbitMQ publisher (dev compose).

#### Frontend — server-driven access (replaces prototype role switcher)

**Removed (switcher artifacts):**

- `apps/shell/src/lib/auth-role-map.ts` — email → `evalPrototypeRole` mapping.
- `docs/DEMO_ROLE_CREDENTIALS.txt` — demo switcher password list.
- `packages/app-shared/src/prototype/prototype-users.ts` — login persona quick-pick.
- Sidebar **تبديل الدور** dropdown, `ROLE_OPTIONS`, `STORAGE_ROLE_KEY` / `STORAGE_PERSONA_KEY`, silent persona auto-login.

**Added / changed:**

- `packages/api-client/src/permissions.ts` + `usePermissionsQuery` — loads after login.
- `packages/app-shared/src/contexts/PrototypeContext.tsx` — `rolePages` and `capabilities` from API; `role` from `prototypeRole`; `viewerEmail` from JWT session.
- `apps/shell/src/components/PageAccessGate.tsx` — redirects unauthorized routes to `/dashboard`.
- `packages/app-shared/src/prototype/{permissions-pages,page-access,runtime-access}.ts` — page list + `isSuperAdmin` capability.
- Login: `POST /api/auth/login-username` — username only (no password, no persona list on page).

**Still client-side (next cleanup):** `po-roles.ts`, `isSuperAdmin(role)` on several MFE buttons — not yet fully migrated to `hasCapability()`.

#### Frontend — MFE API wiring (same commit)

- Dashboard/KPI → `GET /api/reporting/*`; financial → `/api/financial/*`; survey offices → `/api/survey-offices/*`; keys → `/api/property-keys/*`; valuation list → `/api/valuation-requests/*`.
- Settings: field dictionary, custom assigned screens, users PATCH paths expanded.
- Case study: PO intake drafts, delegation letters, suspended transactions, assignment attachments — API modules in `packages/api-client` + MFE storage refactors.

### Property detail expansion + PO chrome cleanup (14 Jun 2026 — commit `17a61a8`)

**Pushed to GitHub:** `feature/failures-mfe-and-platform-split` @ `17a61a8`.

#### Property detail tabs (`PoPropertyDetailTabs.tsx`)

| Tab | What changed |
| --- | ------------ |
| **مستندات العقار** | Unified list from **all upload sources** — always shows six sections (empty state per section): البيانات الأولية · استعلام البورصة · المكتب الهندسي · المقيّم العقاري · المعاين الميداني. Aggregation: `property-detail-documents.ts` + `property-detail-documents-query.ts`. Download only when `dataUrl` exists in browser cache. Removed **رفع مستند جديد** and per-row **معاينة** (eye). |
| **تقرير دراسة الحالة** | `PropertyDetailCaseStudyReport` — printable report + party progress rings; workspace aligned via `PropertyDetailHero` + `CaseStudyWorkspaceView` refactor. |
| **مفاتيح العقار** | New tab after **السجل والتدقيق** — `PropertyDetailPropertyKeys.tsx` reads government-review submission (حالة المفاتيح، المحكمة، الزيارة). |
| **الرفع على انفاذ** | Tab **registered only** — `PropertyDetailEnfathUpload.tsx` placeholder empty state. Full **مساعد الرفع** UI from `infaz_upload_assistant_screen.html` was prototyped then **reverted**; mockup kept at repo root, not committed. |

**MFE deps for documents:** `@engineering-office/mfe`, `@evaluator/mfe` linked in `mfe-case-study/package.json` + `tsconfig.json`.

#### Engineering survey PDFs (`@engineering-office/mfe`)

- `engineering-survey-attachments.ts` — cache uploaded PDF bytes as `dataUrl` in submission payload.
- `EngineeringSurveyWorkPanel` — subsequent saves **merge** existing attachments (no wipe on re-upload).
- `saveEngineeringSurveySubmission` / `finalize-engineering-survey-submission` preserve attachment JSON across saves.

#### Case study matrix UI (`CaseStudyForm.tsx`)

- `CaseStudyMatrixTable.tsx`, `case-study-matrix-utils.ts`, `CaseStudyPartyProgressRings.tsx`, `CaseStudyProgressDonut.tsx` — matrix layout for 37 questions with party columns and progress.
- Removed `CaseStudyApprovalSection.tsx` (approval UX folded into form flow).

#### Field inspection (party flow)

- `FieldInspectionWorkBody.tsx` + `field-inspection-*` storage/validation/queue modules — full submit path on party-task API (same pattern as other five flows).

#### Failures backend scaffold

- Domain `PropertyFailure` + migration `20260614121625_AddPropertyFailures`.
- `FailuresController` + `FailureService` — list/create/approve/return/suspend actions.
- Frontend `@failures/mfe` still uses **repository port** with API module (`failures-api.ts`, `failures-cache.ts`) — end-to-end UI migration in progress.

#### PO list / table UX cleanup

| Removed | File |
| ------- | ---- |
| **تصدير** | `PoListTopbarActions.tsx` |
| **تحديث** (page header refresh) | `PoListView.tsx` |
| **عرض التفاصيل** eye icon on PO rows | `PoListView.tsx` (row click + PO number link still open detail) |

#### Properties list row hover

- `prototype.css` — `.po-properties-row` hover is **full-row** background (fixes gap on ⋮ menu column).

#### Not in commit

- `CaseStudyMatrix.jsx` (root scratch reference)
- `infaz_upload_assistant_screen.html` (Enfath upload assistant mockup)

---

## 1. How to run

### Prerequisites

- Node.js + npm (workspaces)
- .NET SDK (API)
- Docker (Postgres; optional full infra stack)

### Daily dev (minimum)

```bash
docker compose -f infra/docker-compose.yml up -d postgres
npm install            # once, at repo root
npm run dev:api        # gateway :5160 + 9 domain services (see backend/README.md)
npm run dev            # Next.js http://localhost:3000 (LAN)
# or: npm run dev:local
npm run dev:stop       # free ports 3000 + 5160
```

**Postgres (Docker):** `localhost:5432`, database `realestate_eval_dev`, user `postgres`, password `Admin` (see `infra/docker-compose.yml` and `appsettings.Development.json`).

**API connection override:** env `REAL_ESTATE_EVAL_PG_CONNECTION_STRING` or `ConnectionStrings:DefaultConnection`.

**Frontend API base:** configured for local API port **5160** (see `packages/api-client` / shell env).

### Full local platform (optional)

`infra/docker-compose.yml` defines: **RabbitMQ**, **Redis**, **Jaeger**, **Prometheus**, **Grafana** (port 3001), **Elasticsearch**, **Kibana**, **Fluent Bit**. **Redis** and **RabbitMQ** are used by the API layer (caching + outbox). See `README.md`, `backend/README.md`, and `backend/plan/LOCAL_INFRA.md`.

---

## 2. Authentication & roles (important for PM)

### Real login (JWT)


| Endpoint                        | Description                                      |
| ------------------------------- | ------------------------------------------------ |
| `POST /api/auth/login`          | Email + password → JWT                           |
| `POST /api/auth/login-username` | Username only → JWT (prototype dev login)        |
| `GET /api/auth/me`              | Current user (`?includePermissions=true` optional) |
| `GET /api/permissions`          | **Nav pages + capabilities + prototypeRole** for current user |


UI: `apps/shell/src/app/login/page.tsx` → stores session via `@platform/auth-client` → `fetchPermissions` → `PrototypeProvider` loads nav.

### How access control works today


| Layer                         | Purpose                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Identity roles (API JWT)**  | `CDO`, `HrAdmin`, `ProcAdmin`, `CrmAdmin`, `HR`, `PROC`, `CRM`, … — control **API authorization** (e.g. user list scope, controller policies) |
| **Permissions API (UI nav)**  | `GET /api/permissions` → `pages[]` (sidebar), `capabilities[]` (`hasCapability()`, `isSuperAdmin`), `prototypeRole` (display label in `ROLES`) |


**No sidebar role switcher.** Nav and route gate come from the server after login. `ROLES` in `constants.ts` remains for **display names** and legacy helpers; **page list** is API-driven via `rolePages` in `PrototypeContext`.

### API seed accounts (PostgreSQL)


| Email                 | Password    | Identity role | Typical permissions role |
| --------------------- | ----------- | ------------- | ------------------------ |
| `admin@local.dev`     | `Admin123!` | Admin         | general-manager          |
| `s.salhy@gmail.com`   | `sliman123` | CDO           | cdo                      |
| `a.alamin@gmail.com`  | `ali123`    | HrAdmin       | hr-admin                 |
| `a.alqadri@gmail.com` | `ahmad123`  | ProcAdmin     | proc-admin               |
| `g.abdo@gmail.com`    | `gamal123`  | CrmAdmin      | crm-admin                |


**Username login:** seeded HR employees use `UserName` (e.g. `salam`, `osama`, `abdullah`) — see `DataSeeder.cs`.

Seeder: `backend/RealEstateEval.Infrastructure/Data/DataSeeder.cs` (runs on Case Study service startup).

---

## 3. Database (PostgreSQL / EF Core)

**Provider:** Npgsql · **Context:** `ApplicationDbContext.cs`

### 3.1 Tables


| Table                | Contents                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------- |
| **Identity**         | `Users`, `Roles`, `UserRoles`, `UserClaims`, `RoleClaims`, `UserLogins`, `UserTokens`       |
| **Users domain**     | `UserProfiles` (+ `HrEmployeeProfiles`, `ProcServiceProviderProfiles`, `CrmClientProfiles`) |
| **Case study**       | `WorkOrders`, `WorkOrderProperties`, `PropertyContacts`, `CourtCatalogEntries`              |
| **Workflow**         | `WorkflowTasks` — phases, distribution JSON, obstruction fields, parent/child links         |
| **Case study forms** | `CaseStudyForms` — specialist + party drafts per task (answers JSON, step, status)          |
| **Info roles**       | `CaseStudyInfoRolesConfigs` — singleton matrix JSON (parties × 37 questions)                |
| **Party submissions**| `PartyTaskSubmissions` — per child workflow task: kind, status, payload JSON, return note   |
| **Failures**         | `PropertyFailures` — تعذر records per PO/property (status workflow, notes, specialist)      |
| **Platform config**  | `FieldDictionaryConfigs`, `FailureTypesCatalogConfigs`, `FinancialReportConfigs`, `CaseStudyInfoRolesConfigs`, `CustomAssignedScreens` (+ user links) |
| **Operations**       | `SurveyOffices`, `PropertyKeyRecords`                                                       |
| **Valuation**        | `ValuationRequests`, `EvaluatorRecallRecords`                                               |
| **Case study extras**| `PoIntakeDrafts`, `InternalDelegationLetterSets`, `FileAttachments` (blob metadata)         |
| **Messaging**        | `OutboxMessages`                                                                            |


### 3.2 Work order schema (current model)

`**WorkOrders`:** `PoNumber` (unique), `AssignmentType`, `PromulgationDate`, `ReceivedFromEnfathAt`, `ReceivedFromEnfathTime`, `AssignmentSpecialist`, `AssignmentSpecialistEmail`, `ExpectedPropertyCount`, `DueDateAt`, `CreatedAtUtc`.

`**WorkOrderProperties`:** `IdentifierType` (deed / real-estate reg / bourse inquiry), deed/task/owner/court/circuit, `DeedDate`, location (`City`, `District`), classification/type, `DeedStatus`, `Area`, boundaries flags (`BoundariesAvailability`, `BoundariesExternalDocName`), `RestrictionsPresent`, attachment **filenames** (`AssignmentDocFileName`, `RealEstateRegFileName`, `DelegationLetterFileName`, `OtherDocumentFileNames` JSON), `BourseDataCompleted`.

`**PropertyContacts`:** `Name`, `Phone`, `Role`, `SortOrder`.

`**CourtCatalogEntries`:** `City`, `Court`, `CircuitsJson` (jsonb).

`**WorkflowTasks`:** `PoNumber`, `PropertyId`, `Kind`, `Phase`, `Status`, `Title`, distribution parties, `ParentTaskId`, `ObstructionReason`, `ObstructionPriorPhase`, assignee fields, timestamps.

`**CaseStudyForms`:** `TaskId`, `IsParty`, form JSON blob (answers, steps, remarks, signatures).

`**PartyTaskSubmissions`:** `WorkflowTaskId` (unique), `Kind`, `Status` (`draft` / `submitted` / `reopened`), `PayloadJson`, `ReturnNote`, `PropertyId`, `PoNumber`, timestamps. Kinds: `engineering-survey`, `property-appraisal`, `government-review`, `valuation-coordination`, `field-inspection`.

### 3.3 Migration history (apply in order)


| Migration                                          | Summary                                                                    |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| `20260514092140_InitialIdentity`                   | ASP.NET Identity                                                           |
| `20260518071658_AddUserProfiles`                   | User profiles + HR/Proc/CRM tables                                         |
| `20260518073656_RenameIdentityTables`              | Table names Users/Roles/…                                                  |
| `20260519111340_AddCaseStudyWorkOrders`            | PO + properties + contacts + courts                                        |
| `20260521060600_AddPropertyContactRole`            | Contact `Role` column                                                      |
| `20260521141637_PoWorkflowRefactor`                | `PromulgationDate`, specialist email, property boundary/restriction fields |
| `20260521143044_AddExpectedPropertyCount`          | Expected property count on PO                                              |
| `20260601193436_DropUnusedPropertyBoundaryFields`  | Removed legacy boundary text columns                                       |
| `20260601193623_DropUnusedAuditFields`             | Removed unused audit columns                                               |
| `20260607072126_AddWorkflowTasksAndCaseStudyForms` | **Workflow tasks + case study forms**                                      |
| `20260608071207_MakeAssignmentSpecialistOptional`  | Optional assignment specialist on PO                                       |
| `20260608095833_SyncPendingModelChanges`           | Model sync                                                                 |
| `20260608105222_RestoreOptionalAssignmentSpecialist` | Restore optional specialist                                            |
| `20260609095419_AddCaseStudyInfoRolesConfig`       | **Info-role matrix** (`CaseStudyInfoRolesConfigs`, JSONB)                  |
| `20260614074003_AddPartyTaskSubmissions`           | **Party work submissions** (`PartyTaskSubmissions`)                          |
| `20260614121625_AddPropertyFailures`             | **Property failures** (`PropertyFailures`)                                   |
| `20260617095004_AddCustomAssignedScreens`        | Custom assigned screens + user assignments                                   |
| `20260617105922_AddPrototypeModuleApis`          | Field dictionary, failure-types catalog configs                                |
| `20260617121518_AddDelegationLettersAndEvaluatorRecalls` | Delegation letters + evaluator recalls                             |
| `20260617122641_AddPoIntakeDrafts`               | PO intake draft persistence                                                  |
| `20260617132416_AddFinancialReportConfig`        | Financial report config                                                      |
| `20260617141707_AddOutboxMessages`               | Outbox for integration events                                                |
| `20260617142259_AddAttachmentBlobStorage`        | File attachment blob metadata                                                |
| `20260617145650_SplitDatabaseSchemas`            | Per-domain PostgreSQL schemas                                                |


### 3.4 Not stored in database (or still browser-primary)

- Some **PDF bytes** still cached in browser while attachments API is adopted (`assignment-doc-attachments`, party submission `dataUrl`)
- Messages module — not implemented
- `system-tools` static catalog — intentional, no DB

**Moved to API since 17 Jun 2026 (no longer localStorage-primary):**

- Failure types catalog, field dictionary, financial report config, survey offices, property keys, valuation requests list, PO intake drafts, delegation letters, evaluator recalls, suspended transactions (API modules in `packages/api-client`)

---

## 4. Backend API reference

**Projects:** `backend/gateway` + **9** `backend/services/*` deployables · **Auth:** JWT Bearer on protected controllers · **Route map:** `backend/README.md`.

Migrations apply on **Case Study** service startup. Controllers are split by service; gateway path prefixes are stable for the frontend (`packages/api-client`).

### 4.0 Permissions — `PermissionsController` (Identity service)


| Method | Route                | Notes                                      |
| ------ | -------------------- | ------------------------------------------ |
| GET    | `/api/permissions`   | `pages`, `capabilities`, `prototypeRole` for current JWT |

### 4.1 Auth — `AuthController` (Identity service)


| Method | Route                    |
| ------ | ------------------------ |
| POST   | `/api/auth/login`        |
| POST   | `/api/auth/login-username` |
| GET    | `/api/auth/me`           |


### 4.2 Users — `UsersController` (policy `CanManageUsers` = authenticated)


| Method | Route                     | Notes                                                        |
| ------ | ------------------------- | ------------------------------------------------------------ |
| GET    | `/api/users`              | Scoped: CDO all; HrAdmin HR; ProcAdmin Proc; CrmAdmin CRM    |
| GET    | `/api/users/organization` | CDO org overview                                             |
| POST   | `/api/users/hr`           | HrAdmin or CDO                                               |
| POST   | `/api/users/proc`         | ProcAdmin or CDO                                             |
| POST   | `/api/users/crm`          | CrmAdmin or CDO                                              |
| DELETE | `/api/users/registered`   | **Development only** — wipe registered users, keep org seeds |


**Services:** `UserRegistrationService`, `RegistrationMapper`, `RegistrationValidator` · Password min **6** chars.

**Org roles:** `Models/OrgRoles.cs`, `DepartmentRoles.cs`.

### 4.3 Work orders — `WorkOrdersController`


| Method | Route                                                        |
| ------ | ------------------------------------------------------------ |
| GET    | `/api/work-orders`                                           |
| GET    | `/api/work-orders/exists?poNumber=`                          |
| GET    | `/api/work-orders/properties/pending-bourse`                 |
| GET    | `/api/work-orders/deeds/prior?deedNumber=&excludePo=`        |
| GET    | `/api/work-orders/{poNumber}`                                |
| POST   | `/api/work-orders`                                           |
| PUT    | `/api/work-orders/{poNumber}`                                |
| DELETE | `/api/work-orders/{poNumber}`                                |
| POST   | `/api/work-orders/{poNumber}/properties`                     |
| PUT    | `/api/work-orders/{poNumber}/properties/{propertyId}/bourse` |
| PUT    | `/api/work-orders/{poNumber}/properties/{propertyId}`        |
| DELETE | `/api/work-orders/{poNumber}/properties/{propertyId}`        |


**Business rules (`WorkOrderValidator`, `BusinessDueDateCalculator`):**

- **Due date:** 4 business days (Sun–Thu); receipt day counts as day 1 if before **17:00** on a business day; else start next business day; default time `10:00`.
- **تنفيذ:** `AssignmentDocFileName` required per property.
- **تسجيل عيني:** `RealEstateRegFileName` required.
- **Bourse inquiry:** إنفاذ step vs bourse step validation split (district/classification only on bourse completion).
- Contacts: ≥1, name + phone (≥10 digits).
- Unique deed per PO; unique `PoNumber`.

**Pending bourse DTO** includes `DeedDate` (تاريخ الصك) for queue display.

### 4.4 Courts — `CourtsController`


| Method | Route         |
| ------ | ------------- |
| GET    | `/api/courts` |
| PUT    | `/api/courts` |


### 4.5 Workflow tasks — `WorkflowTasksController`


| Method | Route                                                          | Notes                                      |
| ------ | -------------------------------------------------------------- | ------------------------------------------ |
| GET    | `/api/workflow-tasks`                                          | List all tasks                             |
| GET    | `/api/workflow-tasks/{id}`                                     | Single task                                |
| POST   | `/api/workflow-tasks/sync`                                     | Rebuild from work orders                   |
| PATCH  | `/api/workflow-tasks/{id}/distribution`                        | Save distribution draft                    |
| POST   | `/api/workflow-tasks/{id}/confirm-distribution`                | Confirm + spawn party child tasks          |
| POST   | `/api/workflow-tasks/{id}/advance-after-enfath`                | After primary data save                    |
| POST   | `/api/workflow-tasks/{id}/advance-after-bourse`                | After bourse completion                    |
| PATCH  | `/api/workflow-tasks/{id}`                                     | General patch (phase, status, obstruction) |
| DELETE | `/api/workflow-tasks/by-po/{poNumber}`                         | Cascade delete for PO                      |
| DELETE | `/api/workflow-tasks/by-po/{poNumber}/properties/{propertyId}` | Delete property tasks                      |


**Service:** `WorkflowTaskService.cs` · **Frontend:** `packages/api-client/src/workflow-tasks.ts`, `tasks-storage.ts`.

### 4.6 Case study forms — `CaseStudyFormsController`


| Method | Route                                  | Notes                 |
| ------ | -------------------------------------- | --------------------- |
| GET    | `/api/case-study-forms/{taskId}`       | Specialist form draft |
| PUT    | `/api/case-study-forms/{taskId}`       | Save specialist draft |
| GET    | `/api/case-study-forms/party/{taskId}` | Party form draft      |
| PUT    | `/api/case-study-forms/party/{taskId}` | Save party draft      |


**Service:** `CaseStudyFormService.cs` · **Frontend:** `packages/api-client/src/case-study-forms.ts`, `case-study-form-storage.ts` (MFE).

### 4.7 Case study info roles — `CaseStudyInfoRolesController`


| Method | Route                          | Notes                                      |
| ------ | ------------------------------ | ------------------------------------------ |
| GET    | `/api/case-study-info-roles`   | Singleton matrix (parties × questions)     |
| PUT    | `/api/case-study-info-roles`   | Save matrix + notes                        |


**Storage:** `CaseStudyInfoRolesConfigs` table (`MatrixJson`, `NotesJson` JSONB).  
**Frontend:** `packages/api-client/src/case-study-info-roles.ts`, `apps/mfe-settings/src/lib/prototype/case-study-info-roles-storage.ts`.

### 4.8 Party task submissions — `PartyTaskSubmissionsController`


| Method | Route                                           | Notes                          |
| ------ | ----------------------------------------------- | ------------------------------ |
| GET    | `/api/party-task-submissions/{taskId}`          | Load submission for child task |
| PUT    | `/api/party-task-submissions/{taskId}`          | Save draft payload             |
| POST   | `/api/party-task-submissions/{taskId}/submit`   | Validate + submit; completes workflow task |
| POST   | `/api/party-task-submissions/{taskId}/reopen`   | Engineering + appraiser only   |


**Service:** `PartyTaskSubmissionService.cs` · **Frontend:** `packages/api-client/src/party-task-submissions.ts`, `packages/app-shared/src/prototype/party-submission-api.ts`, per-MFE storage modules.

---

## 5. Frontend — routes & screens

**App:** `apps/shell` (host) + `apps/mfe-case-study` (`@case-study/mfe`) · **Router:** Next.js App Router · **Styling:** `prototype.css` + `registration.css` + Tailwind (`globals.css`).

**F3 routing:** PO and active-transaction views import from `@case-study/mfe`; platform views from `@*/mfe` in `[page]/page.tsx`; shell keeps layout, login, case-study workspace, full-page party routes, and mock platform pages.

### 5.1 Top-level routes


| URL                                    | Screen                        | Data source                                  |
| -------------------------------------- | ----------------------------- | -------------------------------------------- |
| `/login`                               | Login                         | API JWT                                      |
| `/welcome`                             | Redirect                      | `next.config` → `/dashboard`                 |
| `/dashboard`                           | Dashboard                     | PO + property stats API; team table mock     |
| `/[page]`                              | Dynamic pages                 | See table below                              |
| `/po`                                  | PO list                       | API                                          |
| `/po/intake`                           | PO header intake              | API                                          |
| `/po/{poNumber}/edit`                  | PO header edit                | API                                          |
| `/po/{poNumber}/property`              | Properties under PO           | API (`PoPropertiesPage`)                     |
| `/po/{poNumber}/property/new`          | Add property                  | API                                          |
| `/po/{poNumber}/property/{id}`         | Property detail               | API                                          |
| `/po/{poNumber}/property/{id}/edit`    | Edit property                 | API                                          |
| `/po/{poNumber}/property/{id}/failure` | Report failure                | API + localStorage fallback                  |
| `/my-tasks/{taskId}`                   | Redirect                      | `next.config` → `/active-primary-data?task=` |
| `/case-study/{taskId}`                 | Case study workspace (أخصائي) | PO API + **API tasks** + **API form**        |


**Redirects:** `/properties` → `/po`; `/my-tasks` → `/active-primary-data`; `/assignment` → `/dashboard`.

### 5.2 Dynamic pages (`apps/shell/src/app/(app)/[page]/page.tsx`)


| `PageId`                                                                                                    | Component                | API                         | Nav note                            |
| ----------------------------------------------------------------------------------------------------------- | ------------------------ | --------------------------- | ----------------------------------- |
| `dashboard`                                                                                                 | `DashboardView`          | Partial                     | —                                   |
| `active-primary-data`                                                                                       | `MyTasksView` (**MFE**)  | PO + **workflow tasks** API | المعاملات النشطة                    |
| `bourse-inquiry`                                                                                            | `BourseInquiryView` (**MFE**) | PO + tasks API         | المعاملات النشطة                    |
| `active-distribution`                                                                                       | `ActiveDistributionView` (**MFE**) | PO + tasks API    | المعاملات النشطة                    |
| `active-case-study`                                                                                         | `ActiveCaseStudyView`    | PO + tasks API              | المعاملات النشطة                    |
| `case-study-info-roles`                                                                                     | `CaseStudyInfoRolesView` | **API**                     | جميع حقول النظام                    |
| `property-inspection`, `government-review`, `valuation-coordination`, `property-appraisal`, `active-survey` | `PartyActiveTaskView`    | PO + tasks + form API       | المعاملات النشطة                    |
| `failures`                                                                                                  | `FailuresView`           | **API** (migrating)         | Live page                           |
| `users`                                                                                                     | `UsersView`              | API                         | الإعدادات                           |
| `courts`                                                                                                    | `CourtsView`             | API                         | جميع حقول النظام (placeholder flag) |
| `system-tools`                                                                                              | `SystemToolsView`        | Catalog only                | جميع حقول النظام                    |
| `survey`, `keys`, `valuation-requests`, `field-form`, `financial`, `kpi`                        | Various `*View`          | **Mocks**                   | Red placeholder in nav              |


### 5.3 Sidebar — المعاملات النشطة

Under **أوامر العمل (PO)** (`@platform/app-shared/prototype/active-transactions`):


| Item                                                                              | Route                  | Status                                     |
| --------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------ |
| البيانات الأولية                                                                  | `/active-primary-data` | Done                                       |
| استعلام بورصة                                                                     | `/bourse-inquiry`      | Done (+ حالة الصك / تعذر flow)             |
| توزيع المعاملات                                                                   | `/active-distribution` | Done                                       |
| دراسة حالة العقارات                                                               | `/active-case-study`   | Done (queue; opens `/case-study/{taskId}`) |
| معاينة العقار / المراجعة الحكومية / استلام التقييم / تقييم العقار / الرفع المساحي | Party `PageId`s        | Done (queue + work panel; see section 8.5) |


**Badges:** `use-active-transaction-nav-badges.ts` (primary open, bourse pending, distribution open, case-study open).

### 5.3.1 Sidebar — جميع حقول النظام (footer)

Pinned at bottom of sidebar (`AppShell` → `sb-nav-footer`):


| Item                     | Route                    | Access                                            |
| ------------------------ | ------------------------ | ------------------------------------------------- |
| ادوات النظام             | `/system-tools`          | **All prototype roles**                           |
| علاقة المستخدم بالمعلومة | `/case-study-info-roles` | **All prototype roles**                           |
| المحاكم و الدوائر        | `/courts`                | **All prototype roles** (nav placeholder styling) |


Config: `system-fields-nav.ts` · `prototype-role-access.ts` appends `SYSTEM_FIELDS_PAGE_IDS` to every role.

### 5.3.2 Sidebar — الإعدادات (footer)


| Item             | Route    | Access   |
| ---------------- | -------- | -------- |
| إدارة المستخدمين | `/users` | Per role |


Config: `settings-nav.ts` (system tools, courts, and info-roles **moved** to جميع حقول النظام in commit `4d3edc6`).

**Removed:** standalone **الإسناد والتوزيع** page (`AssignmentView` deleted; `/assignment` → `/dashboard`). Distribution lives under **توزيع المعاملات** (`ActiveDistributionView`).

### 5.4 PO permissions (`po-roles.ts`)


| Action                                               | Prototype role       |
| ---------------------------------------------------- | -------------------- |
| استلام PO جديد                                       | `section-supervisor` |
| Edit/delete PO header, courts admin, delete property | `section-supervisor` |
| Add/edit property                                    | `case-specialist`    |
| PO view-only (no specialist edit path)               | `general-manager`    |
| Eye button on PO list                                | **Removed** (14 Jun 2026) — row click / PO link open detail |


---

## 6. User management (detail)

### Frontend by prototype role


| Role                                    | UI                                                         |
| --------------------------------------- | ---------------------------------------------------------- |
| `cdo`                                   | `UsersOrganizationView` — departments + admins (read-only) |
| `hr-admin` / `proc-admin` / `crm-admin` | Department list + `RegisterUserFlow`                       |
| Others with `users` page                | Staff list (API scoped or full per role)                   |


**Registration:** `HrRegistrationFlow`, `ProcRegistrationFlow`, `CrmRegistrationFlow` via `RegisterUserFlow.tsx`.

**Expandable rows:** sections from API `details[]` (الحساب والصلاحيات · النظام · path-specific).

### Not done

- Edit/deactivate user (except dev DELETE all registered)
- Search/filter/export

---

## 7. PO & properties (detail)

### Intake (`/po/intake`)

- `PoIntakeFlow.tsx` + `hideWizardChrome` — minimal UI (no step chrome / blue note).
- Saves header only: PO number, **تاريخ التعميد** (`PromulgationDate`), assignment type, specialist + email, expected property count.
- On success: navigates via `onCompleteAction`.
- Saves header to API; optional draft via **`/api/po-intake-draft`** (browser `evalPoIntakeDraft` legacy path being retired).

### Property forms

- **مصدر البيانات:** صك ملكية · تسجيل عيني · **البورصة العقارية** (`PoPropertyEnfathForm.tsx`).
- Bourse completion: `PoPropertyBourseForm.tsx` on **استعلام بورصة** tab and specialist bourse step.
- Decree preview: `AssignmentDocAttachment.tsx` + `assignment-doc-attachments.ts` — **migrating** to `/api/attachments` (browser cache fallback remains).

### Properties access

- **Per PO:** `/po/{poNumber}/property` (`PoPropertiesPage.tsx`).

---

## 8. المعاملات النشطة (detail)

### Shared UI — `ActiveTransactionQueueView.tsx`

- Table + rail toggle + sticky side panel (`po-primary-data-layout` in CSS).
- URL: `?task=<taskId>`; row click opens panel.
- Table class: `po-properties-tbl--primary-data` (column widths in `prototype.css`).
- Countdown: `RemainingTimeCell` + `my-task-row.ts`.

### البيانات الأولية — `MyTasksView.tsx`

- Filter: `filterTasksForPrimaryData` (phase `enfath`).
- Columns: رقم العقار · أمر العمل · نوع الإسناد · أخصائي الإسناد · المدة المتبقية.
- Panel: `CaseStudyTaskWork` (`MyTaskWorkView.tsx`, `layout="panel"`), chrome `TaskWorkChrome.tsx`.
- After save: صك/بورصة → next task; تسجيل عيني → `/active-distribution?task=…`.

### استعلام بورصة — `BourseInquiryView.tsx`

- Queue from `GET /api/work-orders/properties/pending-bourse` (includes **تاريخ الصك** column).
- Properties with open failure (except `returned`) are **hidden** from queue.
- **حالة الصك** in `PoPropertyBourseForm` (`showDeedVitalityFlow`):
  - **الصك فعال** → complete bourse fields → `completePropertyBourse` → advance task.
  - **الصك غير فعال** → **متعذر** panel + required **سبب التعذر** → `submitBourseObstruction` → إدارة التعذرات (supervisor review).

### توزيع المعاملات — `ActiveDistributionView.tsx`

- Filter: `filterTasksForDistribution` (phase `distribution`).
- Distribution UI: `DistributionPartiesForm.tsx` + `distribution-parties.ts` (mock party lists).

### Workflow tasks — `tasks-storage.ts` (**PostgreSQL via API**)


| Phase                  | Meaning                                 |
| ---------------------- | --------------------------------------- |
| `enfath`               | البيانات الأولية                        |
| `bourse`               | Awaiting/filling bourse                 |
| `distribution`         | توزيع المعاملات                         |
| `case-study`           | دراسة حالة العقار (after تأكيد التوزيع) |
| `done` / `obstruction` | Terminal                                |


**Task kinds:** `case-study-property` (parent per property) + child kinds after distribution (`field-inspection`, `government-review`, `property-appraisal`, `engineering-survey`, `valuation-coordination`) with `parentTaskId`.

**Persistence:** `WorkflowTasks` table · synced from PO records via `POST /api/workflow-tasks/sync`. Confirming distribution moves linked tasks to `phase: case-study` and creates child party tasks.

**Obstruction:** `escalateTaskForObstruction` sets `phase: obstruction`, `status: blocked`; specialist sees blocked state until supervisor resolves failure.

### Bourse obstruction — `bourse-obstruction.ts` + `@failures/mfe`


| Step                                 | Behaviour                                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| Specialist selects **الصك غير فعال** | Bourse fields hidden; **متعذر** + reason required                                         |
| Submit                               | `reportBourseObstructionToSupervisor` → failure record + `submitFailureForReview`         |
| Property                             | `deedStatus` → **قيد التحقق**                                                             |
| Task                                 | Escalated to supervisor (`obstruction` phase)                                             |
| Supervisor                           | **إدارة التعذرات** — approve (موقوف) or return (فعال, property may re-enter bourse queue) |


**Failures:** `PropertyFailures` + `/api/failures` primary; **remaining:** remove legacy `evalFailureRecords` reads in `@failures/mfe` and property detail.

### Validation note (panel save)

Partial property updates use `propertyToEnfathDto` when bourse not completed — avoids **الحي مطلوب** on primary panel. Full bourse rules on **استعلام بورصة** and `PUT …/bourse`.

### 8.5 دراسة حالة العقارات

**Reference HTML:** `docs/case_study_form 3.html`, `docs/role_definition_form.html`, PDF `requirements/__032785,315703003914,315703003914 دراسة الحالة.pdf`.

#### Queue — `ActiveCaseStudyView.tsx`

- Route: `/active-case-study` (table + row → full workspace; **no side panel**).
- Filter: `filterTasksForCaseStudy` — `kind === case-study-property`, `phase === case-study`.
- Nav label: **دراسة حالة العقارات** (plural).

#### Workspace — `/case-study/[taskId]` · `CaseStudyWorkspaceView.tsx`

- Header: back to queue, subtitle = PO · deed · city · district (no property code badge).
- Tabs: معلومات العقار · الأطراف والحالة · **نموذج الدراسة** · المستندات · السجل الزمني (last three placeholders).
- Breadcrumb: `دراسة الحالة / المعاملات النشطة / دراسة حالة العقارات / {deed}`.

#### نموذج الدراسة — `CaseStudyForm.tsx`


| Area        | Detail                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| Steps       | 5 (بيانات التعميد removed; PO data still seeded)                                                             |
| Questions   | 37 across deed / survey / comp / occ / extra (`case-study-form-data.ts`)                                     |
| Draft       | **API** `CaseStudyForms` table (`case-study-form-storage.ts`)                                                |
| Progress UI | Donut + `2/37` beside step tabs (full-width bottom border on row)                                            |
| Step 5      | Extra questions + **الاعتماد والتوقيع** (system approver ثابت) + **التقرير النهائي** (HTML/PDF from answers) |
| Report      | `case-study-report-model.ts`, `case-study-report-html.ts`, `CaseStudyReportDocument.tsx`                     |
| Assets      | `public/case-study/emad-signature.png`, `ejadah-stamp.png`                                                   |


**Business rules (report):** مزود الخدمة = شركة إجادة المهنية للتقييم · معتمد التقرير = عماد رشيد الرشيد (not PO assignee) · أخصائي الإسناد from PO in meta only.

#### علاقة المستخدم بالمعلومة — `/case-study-info-roles`

**Purpose:** Admin matrix — for each of 37 questions, assign each **party** a role: أصيل · ثانوي · معتمد · لا دور.


| Party (`case-study-info-roles-data.ts`) | Prototype `RoleId`      |
| --------------------------------------- | ----------------------- |
| أخصائي دراسة الحالة                     | `case-specialist`       |
| المعاين العقاري                         | `field-inspector`       |
| المراجع الحكومي                         | `government-reviewer`   |
| المقيم العقاري                          | `real-estate-appraiser` |
| المكتب الهندسي                          | `engineering-office`    |
| مشرف دراسة الحالة                       | `section-supervisor`    |


**Storage:** `CaseStudyInfoRolesConfigs` table + `/api/case-study-info-roles` (`case-study-info-roles-storage.ts` → API).

**Runtime rules (implemented):**


| Actor                                       | Form behaviour                                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **أخصائي** (`CaseStudyForm` default)        | All 37 questions **editable**; full report on step 5                                                                      |
| **Distributed parties** (`variant="party"`) | All 37 questions **visible**; editable only where matrix assigns أصيل/ثانوي/معتمد; else **عرض فقط** (disabled checkboxes) |
| Party answers                               | **API** party form per `childTaskId`; display merges parent specialist draft for read-only context                        |


#### Party tasks — نموذج الدراسة tab

`PartyActiveTaskWork.tsx`: tabs **{workTitle}** + **نموذج الدراسة** → `PartyCaseStudyFormTab.tsx` embeds `CaseStudyForm` linked to parent `case-study-property` task.

Applies to: معاينة العقار · المراجعة الحكومية · استلام التقييم · تقييم العقار · الرفع المساحي (after تأكيد التوزيع creates child tasks).

#### Property detail — `/po/[poNumber]/property/[propertyId]`

- **Hero** (`PropertyDetailHero.tsx`) shared with case-study workspace.
- **Tabs** (`PoPropertyDetailTabs.tsx`): basic data · **مستندات العقار** (six source sections) · linked properties · failures · **الأطراف** · **تقرير دراسة الحالة** · appraisal placeholder · photos placeholder · audit log · **مفاتيح العقار** · **الرفع على إنفاذ** (placeholder).
- **مستندات العقار:** `property-detail-documents.ts` aggregates PO intake filenames + engineering/appraisal/inspection PDFs from party submission payloads (browser `dataUrl` when uploaded in-session).
- **الأطراف:** `buildPropertyDetailPartyCards` from workflow tasks + distribution; click card → `loadPropertyDetailPartySubmission` (API for specialist form + all five party submission kinds).
- **تقرير دراسة الحالة:** `PropertyDetailCaseStudyReport` embeds printable report (`buildCaseStudyReportModel` + `CaseStudyReportDocument`) — read-only; edit via workspace link → `/case-study/[taskId]`.
- **مفاتيح العقار:** `PropertyDetailPropertyKeys` — keys status / court / visit from government-review submission.
- **الرفع على إنفاذ:** tab registered; content TBD (mockup `infaz_upload_assistant_screen.html` at repo root for future build).

#### Full-page party work (shell routes)

Each party queue row opens a dedicated full-page task (mirrors engineering pattern): survey, appraisal, inspection, government review, valuation coordination — work body + submit via **PartyTaskSubmissions** API.

---

## 9. ادوات النظام (`/system-tools`)

**Purpose:** Living **field/screen catalog** for PO module (PM/BA/dev alignment).


| File                         | Role                                 |
| ---------------------------- | ------------------------------------ |
| `SystemToolsView.tsx`        | Filterable expandable cards          |
| `system-tools-po-catalog.ts` | Screen/field definitions (PO module) |
| `system-tools-view-model.ts` | Card builder + filters               |
| `PO_ROLE_RULES`              | Documented permission matrix         |


**No API · no DB.** Nav item lives under **جميع حقول النظام** dropdown (see section 5.3.1).

---

## 10. Browser storage (prototype state)


| Key / module                         | Purpose                                                   |
| ------------------------------------ | --------------------------------------------------------- |
| `assignment-doc-attachments`         | Image/PDF preview cache per property (migrating to `/api/attachments`) |
| `evalFailureRecords` (`FAILURES_STORAGE_KEY`) | Legacy تعذر cache — **`/api/failures`** is primary |
| JWT session (`auth-client`)          | API auth                                                  |
| `capabilities` (in-memory)           | From `GET /api/permissions` via `runtime-access.ts`       |


**Moved to API (no longer localStorage-primary):**


| Former key                             | Now                                              |
| -------------------------------------- | ------------------------------------------------ |
| `evalWorkflowTasks`                    | `WorkflowTasks` table + `/api/workflow-tasks`    |
| `evalCaseStudyForm:{taskId}`           | `CaseStudyForms` table + `/api/case-study-forms` |
| `evalCaseStudyFormParty:{childTaskId}` | `/api/case-study-forms/party/{taskId}`           |
| `evalCaseStudyInfoRoles`               | `CaseStudyInfoRolesConfigs` + `/api/case-study-info-roles` |
| `evalPrototypeRole`                    | **Removed** — `GET /api/permissions` + `PageAccessGate` |
| `evalPoIntakeDraft`                    | `PoIntakeDrafts` + `/api/po-intake-draft`        |
| Field dictionary / failure types / financial / survey / keys / VR list | respective `/api/*` module configs |


---

## 11. Monorepo packages


| Package                   | Exports                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| `@platform/shell`         | Next.js host; exports `./prototype-auth` only                                                |
| `@case-study/mfe`         | PO + active-transaction views, queries, prototype PO/task libs, UI widgets                   |
| `@failures/mfe`           | إدارة التعذرات — repository port, `failures-api.ts`, `FailureReportForm`                 |
| `@settings/mfe`           | users, courts, info-roles, system-tools views + storage                                    |
| `@platform/app-shared`    | `PrototypeContext`, registration, nav/constants, `prototypeKeys`, `active-transactions`    |
| `@platform/api-client`    | `auth`, `users`, `permissions`, `work-orders`, `courts`, `workflow-tasks`, `case-study-forms`, `party-task-submissions`, `failures`, `reporting`, `financial`, `prototype-modules`, `custom-assigned-screens`, … |
| `@platform/auth-client`   | Session + `AppAuthGate`                                                                      |
| `@platform/design-system` | CSS + `StatusBadge`                                                                          |
| `@platform/types`         | `PageId`, `RoleId`, `CASE_STUDY_READY_NAV`, users, organization types                        |


---

## 12. Screen status matrix (PM)


| Screen                                                 | Backend     | Frontend data                        | Nav styling                         |
| ------------------------------------------------------ | ----------- | ------------------------------------ | ----------------------------------- |
| Login / JWT                                            | Yes         | API                                  | —                                   |
| Dashboard                                              | Yes         | Reporting BFF API                    | Normal                              |
| PO list/detail/properties                              | Yes         | API                                  | Normal                              |
| PO intake                                              | Yes         | API (+ optional draft)               | Normal                              |
| البيانات الأولية                                       | Yes         | API (PO + tasks)                     | Normal + badge                      |
| استعلام بورصة                                          | Yes         | API (+ obstruction → local failures) | Normal + badge                      |
| توزيع المعاملات                                        | Yes         | API (PO + tasks)                     | Normal + badge                      |
| دراسة حالة العقارات                                    | Yes         | API (PO + tasks + forms)             | Normal + badge                      |
| Case study workspace + form + report                   | Yes (forms) | API                                  | `/case-study/[taskId]`              |
| علاقة المستخدم بالمعلومة                               | Yes         | API                                  | جميع حقول النظام                    |
| Party queues + نموذج الدراسة tab                       | Yes         | API                                  | المعاملات النشطة                    |
| Party work submit (5 flows) + property detail parties  | Yes         | API (`PartyTaskSubmissions`)         | Full-page routes + PO property detail |
| Users / org                                            | Yes         | API                                  | الإعدادات                           |
| Courts                                                 | Yes         | API                                  | جميع حقول النظام (placeholder flag) |
| Failures (إدارة التعذرات)                              | Yes         | API (+ legacy cache fallback)        | Normal                              |
| Survey, keys, VR list, financial, KPI                  | Yes         | API                                  | Normal / placeholder flags          |
| System tools                                           | No          | Static catalog                       | جميع حقول النظام                    |
| Messages                                               | No          | Not implemented                      | —                                   |


### 12.1 Backend ↔ Frontend alignment (how many backends?)

**Short answer:** **gateway + 9 domain services** (Identity, Case Study, Operations, Reporting, Financial, Valuation, Failures, Platform, Attachments). Shared Postgres in dev; schema-per-domain migration applied. See `backend/README.md`.

#### Services and primary consumers


| Service | Port | Frontend / notes |
| ------- | ---- | ---------------- |
| Gateway | 5160 | Single API base for `packages/api-client` |
| Identity | 5161 | Login, users, **`/api/permissions`** |
| Case Study | 5162 | PO, workflow, forms, party submissions, suspended transactions |
| Operations | 5163 | Survey offices, property keys MFEs |
| Reporting | 5164 | Dashboard + KPI (BFF aggregates upstream) |
| Financial | 5165 | Financial reports MFE |
| Valuation | 5166 | Valuation requests, evaluator recalls |
| Failures | 5167 | Failures + failure-types catalog |
| Platform | 5168 | Courts, field dictionary, info-roles, custom screens |
| Attachments | 5169 | File upload/download blobs |

#### Live API domains (by controller group)


| #   | Domain             | Service / controller            | Frontend consumers                                            |
| --- | ------------------ | ------------------------------- | ------------------------------------------------------------- |
| 1   | Auth + permissions | Identity — `AuthController`, `PermissionsController` | `/login`, `PrototypeContext`, `PageAccessGate` |
| 2   | Users              | Identity — `UsersController`    | `/users`, registration flows in app-shared                    |
| 3   | Work orders        | Case Study — `WorkOrdersController` | `@case-study/mfe` PO list, intake, properties, bourse    |
| 4   | Workflow tasks     | Case Study — `WorkflowTasksController` | MFE active queues, party tasks, distribution              |
| 5   | Case study forms   | Case Study — `CaseStudyFormsController` | `/case-study/[taskId]`, party نموذج الدراسة tab          |
| 6   | Party submissions  | Case Study — `PartyTaskSubmissionsController` | Five party work flows                               |
| 7   | Reporting / KPI    | Reporting — `ReportingController` | `@dashboard/mfe`, `@kpi/mfe`                            |
| 8   | Financial          | Financial — `FinancialController` | `@financial/mfe`                                        |
| 9   | Survey + keys      | Operations                        | `@survey/mfe`, `@keys/mfe`                                    |
| 10  | Valuation          | Valuation                         | `@valuation/mfe`, `@evaluator/mfe` recalls                    |
| 11  | Failures           | Failures                          | `@failures/mfe`                                               |
| 12  | Platform config    | Platform — courts, field dict, info-roles, custom screens | `@settings/mfe`                         |
| 13  | Attachments        | Attachments                       | PO/party/engineering PDF upload (rolling adoption)            |
| 14  | System maintenance | Case Study — `SystemController` | Dev reset only                                                |


**Core transaction path is aligned:** PO → البيانات الأولية → استعلام بورصة → توزيع → دراسة حالة → party tasks (save/submit in PostgreSQL) → property detail read-back.

#### Frontend `PageId` coverage (27 routes in `packages/types`)


| Status                            | Count | Pages / notes                                                                                                                                                                                                                                                    |
| --------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fully API-backed**              | 22+   | Core case-study path, users, courts, info-roles, failures, survey, keys, financial, KPI, valuation-requests, custom screens, field dictionary |
| **Partial API**                   | 4     | `dashboard` (reporting BFF; some team cards mock), PO/party attachments (blob API rolling out), `users` (PATCH expanded; search TBD), property detail **تقييم العقار** tab (placeholder) |
| **Intentionally no backend**      | 1     | `system-tools` (static field catalog) |


**Rough score:** ~26/26 `PageId` routes have defined UI (API-backed or intentional static).

#### New backend work still needed (by priority)


| Phase                        | Count | Items                                                                                                                   | Blocks                                             |
| ---------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **1 — attachment adoption**  | 1     | Finish wiring all MFEs to `/api/attachments` for PDF bytes                                                              | File previews, PO intake docs                      |
| **2 — users & auth**         | 2     | Users search; migrate remaining `po-roles.ts` / `isSuperAdmin(role)` to `hasCapability()`                              | Action-level RBAC parity with nav                  |
| **3 — richer screens**       | 1     | Property detail appraisal tab wiring                                                                                      | property detail                                    |
| **4 — platform hardening**   | 2     | Physical DB-per-service; full capability catalog on all actions                                                         | Production deploy                                  |
| **Deferred**                 | 1     | Court case parties on PO/property (§16)                                                                                 | أطراف التنفيذ                                      |


#### Summary table (PM)


| Question                                        | Answer                                        |
| ----------------------------------------------- | --------------------------------------------- |
| Backend deployables that exist today?           | **Gateway + 9 services**                      |
| Frontend areas aligned with API?                | **~22 full** + **~4 partial**                 |
| Prototype role switcher?                        | **Removed** — permissions API drives nav      |
| Next hardening focus?                           | Attachments adoption + `hasCapability()` on actions |


**Seeder path (corrected):** `backend/RealEstateEval.Infrastructure/Data/DataSeeder.cs` — seeds org admins + all sidebar `@ejadah.dev` HR personas + Jeddah survey PROC provider (`survey.jeddah@ejadah.dev`; `UserName` = email, not Arabic display name).

---

## 13. Other documentation in repo


| Path                                                    | Description                                                                                                                        |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `docs/DATABASE_OVERVIEW.md` / `.html`                   | DB overview EN / AR                                                                                                                |
| `docs/SYSTEM_BEHAVIOR_PM_REVIEW.md`                     | PM behavior review                                                                                                                 |
| `backend/README.md`                                     | Microservices layout, gateway routes, ports                                                                                        |
| `docs/ARCHITECTURE_MICROFRONTENDS_AND_MICROSERVICES.md` | Target architecture                                                                                                                |
| `docs/LEARNING_FAST_APPS.md`                            | **Study guide (EN):** frontend (TanStack/CWV/Next.js), backend (EF/HybridCache), PostgreSQL (EXPLAIN, indexes, pg_stat_statements) |
| `docs/infath_case_study_fields.md`                      | Case study field reference                                                                                                         |
| `docs/case_study_module.md`                             | Case study module notes                                                                                                            |
| `README.md`                                             | Full stack readme + roadmap                                                                                                        |
| `apps/plan/FRONTEND.md`                                 | Frontend plan                                                                                                                      |
| `backend/plan/LOCAL_INFRA.md`                           | Infra URLs                                                                                                                         |


---

## 14. Backlog (suggested next steps)

> **Canonical list:** see **§ What is remaining** at the top of this document (17 Jun 2026 snapshot). Items below are kept for historical context; strike-through = done since last major update.

### 14.1 إدارة المنظمة — screens & permissions

**Reference:** `docs/ejada-registration_1.html` — applied to `/users` registration UX (8 Jun 2026):


| Done | Item                                                                                                   |
| ---- | ------------------------------------------------------------------------------------------------------ |
| ✓    | HR full 4-step wizard (employment, org tree, personal, account, review)                                |
| ✓    | PROC individual path (unchanged logic) + org teams UI (mgmt + ops — UI only, not persisted to API yet) |
| ✓    | CRM 4-step flow (existing, themed shell)                                                               |
| ✓    | Side panel + ERP portal styling per source (HR / PROC / CRM)                                           |


**Still TODO:** persist PROC org teams to DB; users edit/deactivate/search/export (see § What is remaining P1).

**Done since 17 Jun:** server-driven nav via `GET /api/permissions`; prototype role switcher removed; no `hr_perms` → `evalPrototypeRole` mapping.

**Registration flows for:**


| Department      | Prototype role | API identity | Current UI                        |
| --------------- | -------------- | ------------ | --------------------------------- |
| الموارد البشرية | `hr-admin`     | `HrAdmin`    | `/users` → `HrRegistrationFlow`   |
| المالية والعقود | `proc-admin`   | `ProcAdmin`  | `/users` → `ProcRegistrationFlow` |
| علاقات العملاء  | `crm-admin`    | `CrmAdmin`   | `/users` → `CrmRegistrationFlow`  |


**Where exactly:** sidebar group **إدارة المنظمة** → page **إدارة المستخدمين** (`/users`, `settings-nav.ts` / الإعدادات footer). CDO sees `UsersOrganizationView` (read-only org tree); department admins see staff list + registration wizard (`RegisterUserFlow` / `RegistrationPortal`).

**Scope of build:** align fields, steps, labels, and permission model in that HTML with the three flows above — **not** court parties, **not** توزيع المعاملات assignees.

**Prerequisite:** add/commit `docs/ejada-registration_1.html`; confirm with PM before coding.

**Failures API:** ~~wire list UI off localStorage~~ — API live; **remaining:** drop `evalFailureRecords` cache path entirely; property detail tab API-only.

**Info roles API:** ~~persist matrix~~ — **done** (`CaseStudyInfoRolesConfigs`); **remaining:** server-side enforce أصيل/ثانوي/معتمد on form submit.

**Users (other):** edit/deactivate; search; export.

**PO:** finish **attachments** adoption; server pagination/search.

**Case study:** backend validation on form submit; documents/time-log tabs; wire matrix rules server-side.

**Platform:** physical DB-per-service; `hasCapability()` on all actions; Enfath upload assistant UI.

**Courts nav:** remove red placeholder styling when PM confirms courts screen is production-ready.

---

## 16. Deferred — أطراف التنفيذ (court case parties)

**Status:** discussion done; **implementation later**.

**Product question to answer when built:**

> من هم في القضية؟ ماذا نحتاج منهم؟

**Constraints (agreed):**

- أطراف التنفيذ = **أطراف القضية لدى المحكمة** (legal parties), **not** Ejadah employees.
- They **do not use the system** (no accounts, no `RoleId`, no tasks).
- Represent as **records on PO/property** (names, legal capacity, contact, documents required/received) — e.g. extend `PropertyContacts` / enforcement fields, not `workflow-users`.
- Existing hints in codebase: `CONTACT_ROLE_OPTIONS` (مالك، وكيل، …), `PoPropertyEnfathForm` text «يطلب السجل من أطراف التنفيذ», validator message on `RealEstateRegFileName`.

**Open design question for PM:** are parties stored **per PO** or **per property** within a PO?

**Out of scope for this item:** internal assignee lists (Firas, inspectors) — those stay under توزيع المعاملات + future «منفّذو الإسناد» admin if needed.

---

## 15. Changelog (high level)

1. Identity + user profiles (HR/Proc/CRM) in PostgreSQL.
2. Work orders, properties, contacts, courts + full REST API.
3. Next.js shell: PO intake refactor, Enfath/bourse split, Arabic RTL.
4. Users UI: expandable API-driven details.
5. Org model: CDO overview, department admins, scoped registration.
6. المعاملات النشطة sidebar; primary data + distribution queues with side panel.
7. Label/validation alignment: مصدر البيانات, البورصة العقارية, panel vs bourse save.
8. PO intake chrome reduction; `PromulgationDate` on PO.
9. System tools catalog page.
10. Schema tidy-up migrations (boundary/audit field drops).
11. **دراسة حالة العقارات:** queue (`ActiveCaseStudyView`), workspace route `/case-study/[taskId]`, phase `case-study` after distribution confirm.
12. **نموذج الدراسة:** 5-step form (37 questions), printable report aligned to PDF reference, fixed approver/stamp assets.
13. **UI polish:** workspace chrome, progress donut in form step row, tab panel spacing.
14. **Sidebar الإعدادات:** dropdown at footer (ادوات النظام · إدارة المستخدمين · المحاكم و الدوائر).
15. **علاقة المستخدم بالمعلومة:** admin matrix (`/case-study-info-roles`); later moved to API (changelog #29).
16. **Party integration:** `PartyActiveTaskWork` tab **نموذج الدراسة** — all questions visible, answer only per matrix; party storage per child task.
17. **Distribution parties:** child workflow tasks + party nav pages (`party-task-pages.ts`).
18. **جميع حقول النظام:** new sidebar group; system tools, info-roles, courts visible to all roles; الإعدادات reduced to users only (`4d3edc6`).
19. **Workflow tasks API:** `WorkflowTasks` table, full REST, frontend off localStorage (`9016a40`).
20. **Case study forms API:** `CaseStudyForms` table, specialist + party drafts persisted (`9016a40`).
21. **استعلام بورصة:** تاريخ الصك in pending queue; **حالة الصك** (فعال / غير فعال) → **متعذر** + reason → supervisor in إدارة التعذرات (`9016a40`).
22. **Terminology (8 Jun 2026):** documented court parties vs internal assignees vs user roles; deferred §16; org registration scope §14.1; removed `/workflow-users` prototype page.
23. **Backend layers (8 Jun 2026):** Domain / Application / Infrastructure split; HR persona seeding; JWT role scoping for department user lists; prototype silent auth.
24. **Alignment matrix (8 Jun 2026):** §12.1 — 7 live API domains, 6 needed for production-ready flows, ~15 for full sidebar.
25. **F3 microfrontend (9 Jun 2026):** `@case-study/mfe` — PO + `/active-primary-data`, `/bourse-inquiry`, `/active-distribution`; shell thin routes; `npm run build` single deploy; F5 deferred.
26. **@platform/app-shared (9 Jun 2026):** `PrototypeContext`, registration flows, nav/constants, `prototypeKeys`; breaks shell/MFE duplication for host shared UI.
27. **F3 decoupling (9 Jun 2026):** zero `@shell/` imports in MFE; PO queries + failures storage + shared UI in MFE; `CASE_STUDY_READY_NAV` in `@platform/types`.
28. **Dead-code cleanup (9 Jun 2026):** removed stale shell views and ~42 duplicate `components/prototype/*` files (po-intake, registration, distribution, active-transactions, primary-data); shell re-export shims removed.
29. **Info-role matrix API (9 Jun 2026):** `CaseStudyInfoRolesConfig` + `CaseStudyInfoRolesController`; frontend off `localStorage`; migration `20260609095419_AddCaseStudyInfoRolesConfig`.
30. **Docs (9 Jun 2026):** `apps/plan/FRONTEND.md` — F3 marked complete; packages table updated.
31. **`@settings/mfe` + `@failures/mfe`:** settings (users, courts, info-roles, system-tools) and failures (إدارة التعذرات) split into own packages; failures repository port + `FAILURES_CHANGED_EVENT`; dummy data unchanged (`evalFailureRecords`).
32. **Cleanup pass:** removed duplicate API helpers from case-study `work-orders-api-config`, dead evaluator checklist validation, stale doc paths (`README`, `progress`, PM review).
33. **F4b platform MFEs (Jun 2026):** `@dashboard`, `@survey`, `@keys`, `@financial`, `@kpi`, `@valuation` — views moved out of shell; `[page]/page.tsx` imports `@*/mfe` only.
34. **`@evaluator/mfe` + `@engineering-office/mfe`:** appraiser and engineering survey packages; party extensions wired into case-study queues and shell full-page routes.
35. **F4c shell cleanup:** orphan platform `*View.tsx` removed from shell (layout components only); `FRONTEND.md` checklist marked complete.
36. **F4d dashboard decoupling:** `@dashboard/mfe` reads work orders via `work-orders-read` + api-client (no import from `@case-study/mfe`).
37. **Party submissions API (14 Jun 2026):** `PartyTaskSubmissions` table + `PartyTaskSubmissionsController`; migration `20260614074003_AddPartyTaskSubmissions`; submit completes workflow task; reopen for engineering + appraiser.
38. **Five party flows on API:** engineering survey, property appraisal, government review, valuation coordination, field inspection — frontend storage modules call `party-submission-api.ts` (shared cache in app-shared).
39. **Full-page party routes:** `/active-survey/[taskId]`, `/property-appraisal/[taskId]`, `/property-inspection/[taskId]`, `/government-review/[taskId]`, `/valuation-coordination/[taskId]`.
40. **Property detail — الأطراف:** party cards + `PartyRoleDetailPanel` with per-role API submissions (`property-detail-party-submissions.ts`).
41. **Property detail — تقرير دراسة الحالة:** read-only `CaseStudyReportDocument` on same page (`PropertyDetailCaseStudyReport.tsx`); removed misleading progress bars.
42. **Engineering survey UX:** Google Maps panel, 13-item checklist, situation topbar, specialist reopen via `EngineeringSurveyAdvisoryPanel`; Jeddah default coordinates.
43. **UI polish:** RTL sidebar active indicator; breadcrumb dedup; engineering queue duplicate stats row removed.
44. **Still deferred after F4:** attachment blobs, server-driven roles, platform mock pages (survey/keys/KPI/financial), property photos, appraisal summary tab on property detail, **الرفع على إنفاذ** assistant UI.
45. **Unified property documents (14 Jun 2026):** `property-detail-documents.ts` — six sections by source on property detail; engineering/appraisal PDFs from party submission `dataUrl` cache.
46. **Engineering PDF persistence (14 Jun 2026):** `engineering-survey-attachments.ts`; merge-on-save in work panel + submission storage.
47. **Property detail tabs (14 Jun 2026):** **مفاتيح العقار** (`PropertyDetailPropertyKeys`); **الرفع على إنفاذ** tab placeholder (`PropertyDetailEnfathUpload`).
48. **Case study matrix (14 Jun 2026):** `CaseStudyMatrixTable` + party progress rings in form and property detail report tab.
49. **Field inspection flow (14 Jun 2026):** `FieldInspectionWorkBody` + API submission storage/validation.
50. **Failures API scaffold (14 Jun 2026):** `PropertyFailures` table + `FailuresController`; frontend repository port with `failures-api.ts`.
51. **PO / properties UI cleanup (14 Jun 2026):** removed export, refresh, and list eye buttons; full-row hover on properties table.
52. **Git (14 Jun 2026):** commit `17a61a8` pushed to `feature/failures-mfe-and-platform-split`.
53. **Microservices (17 Jun 2026):** deleted `RealEstateEval.Api` monolith; YARP gateway + 9 domain services; `backend/README.md`, `npm run dev:api`, Docker per service.
54. **Permissions API (17 Jun 2026):** `GET /api/permissions`, `PlatformPermissionCatalog`, `PermissionService`; frontend `PrototypeContext` + `PageAccessGate` + `permissions-queries`.
55. **Prototype switcher removed (17 Jun 2026):** deleted `auth-role-map.ts`, `DEMO_ROLE_CREDENTIALS.txt`, `prototype-users.ts`, sidebar role dropdown, `evalPrototypeRole` sessionStorage, silent persona login.
56. **Login (17 Jun 2026):** `POST /api/auth/login-username` — username-only dev login page.
57. **Reporting BFF (17 Jun 2026):** `ReportingUpstreamClient` — dashboard/KPI aggregate via HTTP to upstream services.
58. **Redis caching (17 Jun 2026):** reporting, financial, survey offices, courts hot reads.
59. **Schema split (17 Jun 2026):** migration `20260617145650_SplitDatabaseSchemas` — per-domain PostgreSQL schemas.
60. **New module APIs (17 Jun 2026):** field dictionary, failure-types catalog, financial config, PO intake drafts, delegation letters, evaluator recalls, custom assigned screens, attachments blob storage, outbox/events.
61. **MFE API wiring (17 Jun 2026):** dashboard, KPI, financial, survey, keys, valuation, settings modules call respective `/api/*` endpoints.
62. **CI (17 Jun 2026):** `.github/workflows/backend-ci.yml` — `dotnet build` on solution.
63. **Git (17 Jun 2026):** commit `266be9b` pushed to `main`.

---

*This file was verified against the codebase on 17 June 2026. Update when `main` changes materially.*