# Architecture — platform domain MFEs (dashboard, survey, keys, financial, KPI)

**Status:** **F4c/F4d complete** — dashboard PO/property reads use `@platform/app-shared/prototype/work-orders-read` + `api-client` (not `@case-study/mfe`). Shell re-exports dashboard query hooks; platform views import from domain MFEs only.

**Goal:** split five shell/mock domains into **independent logical MFE packages**, and **remove the dashboard from `@case-study/mfe`** so case-study owns transaction workflows only.

---

## 1. Domains and routes

| Arabic label | `PageId` | Shell route | New package | NPM name |
|--------------|----------|-------------|-------------|----------|
| لوحة التحكم | `dashboard` | `/dashboard` | `apps/mfe-dashboard` | `@dashboard/mfe` |
| الرفع المساحي | `survey` | `/survey` | `apps/mfe-survey` | `@survey/mfe` |
| إدارة المفاتيح | `keys` | `/keys` | `apps/mfe-keys` | `@keys/mfe` |
| التقارير المالية | `financial` | `/financial` | `apps/mfe-financial` | `@financial/mfe` |
| مؤشرات الأداء | `kpi` | `/kpi` | `apps/mfe-kpi` | `@kpi/mfe` |

Each package owns **exactly one** navigable page today. Future sub-routes (e.g. `/financial/reports/[id]`) stay inside the same MFE.

---

## 2. What moves out of `@case-study/mfe`

Dashboard was placed in case-study for convenience; it is **not** a case-study transaction flow.

| Asset (today in `@case-study/mfe`) | Target |
|-----------------------------------|--------|
| `views/DashboardView.tsx` | `@dashboard/mfe` |
| `components/dashboard/TeamCurrentLoadCard.tsx` | `@dashboard/mfe` |
| `hooks/use-has-mounted.ts` | `@dashboard/mfe` (or `@platform/app-shared` if reused elsewhere) |

**Dashboard data today**

| Source | Type | Future owner |
|--------|------|--------------|
| `usePoListRowsQuery`, `usePropertyListItemsQuery` | PO/work-order reads | Keep calling **work-orders API** via `@platform/api-client` — not via `@case-study/mfe` |
| `DASHBOARD_TEAM_ROWS`, `MOCK_VR` | Mock constants | `@platform/app-shared` until reporting API exists |
| `TeamCurrentLoadCard` specialist bars | Mock | `@dashboard/mfe` until KPI/reporting API exists |

**Rule:** `@dashboard/mfe` must **not** depend on `@case-study/mfe`. Shared reads go through `api-client` + `prototype-keys`, same as other MFEs.

---

## 3. What stays in shell / case-study (do not confuse)

### Survey — two different concepts

| Route | Owner | Meaning |
|-------|-------|---------|
| `/survey` | `@survey/mfe` | إدارة الرفع المساحي — offices, request stats (`SurveyView`, `MOCK_SURVEY_OFFICES`) |
| `/active-survey` | `@case-study/mfe` | **Party queue** for `engineering-survey` tasks (`PartyActiveTaskView`, `GenericPartyWorkBody`) |

Only `/survey` moves to `@survey/mfe`. The active transaction queue remains in case-study with other party tasks.

### Keys — custody vs government review

| Concern | Owner |
|---------|-------|
| `/keys` — key custody admin | `@keys/mfe` |
| Government review delegation letters, court visits | `@case-study/mfe` (unchanged) |

### Case-study MFE scope after this split

```
/po/*
/active-primary-data, /bourse-inquiry, /active-distribution, /active-case-study
/case-study/[taskId]
  Party queues: property-inspection, property-appraisal,
              active-survey, government-review
```

---

## 4. Current location of shell views (migration source)

| View | Current location | Status |
|------|------------------|--------|
| `DashboardView` | `@dashboard/mfe` | ✓ moved from `@case-study/mfe` |
| `SurveyView` | `@survey/mfe` | ✓ |
| `KeysView` | `@keys/mfe` | ✓ |
| `FinancialView` | `@financial/mfe` | ✓ |
| `KpiView` | `@kpi/mfe` | ✓ |

Shell `components/views/` holds layout only (`AppShell`, `AppBreadcrumb`, `NavIcon`); all platform views import from `@*/mfe`.

---

## 5. Package layout (mirror `@failures/mfe`)

Each new app follows the same monorepo pattern — **library package**, not a second Next.js app until F5 (Module Federation).

```text
apps/mfe-{domain}/
  package.json          # name: @{domain}/mfe
  tsconfig.json
  src/
    index.ts            # public surface — views + lib exports
    routes.ts           # {DOMAIN}_MFE_PAGE_IDS, is{Domain}MfePage()
    views/
      {Domain}View.tsx
    components/         # domain-only UI
    lib/
      {domain}-types.ts
      {domain}-api.ts   # stub → @platform/api-client
    query/
      {domain}-queries.ts   # TanStack hooks (when API exists)
```

**`package.json` exports** (same shape as `@failures/mfe`):

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./routes": "./src/routes.ts",
    "./query/*": "./src/query/*",
    "./lib/*": "./src/lib/*",
    "./views/*": "./src/views/*",
    "./components/*": "./src/components/*"
  }
}
```

**Peer dependencies:** `react`, `react-dom`, `next` (host provides runtime).

**Shared dependencies:** `@platform/app-shared`, `@platform/ui-kit`, `@platform/types`, `@platform/auth-client`, `@platform/api-client`, `@tanstack/react-query`.

---

## 6. Dependency rules

```text
                    ┌─────────────────┐
                    │  @platform/shell │  host: login, layout, [page] router
                    └────────┬────────┘
                             │ imports views only
     ┌───────────────────────┼───────────────────────┐
     ▼                       ▼                       ▼
@dashboard/mfe          @survey/mfe              @keys/mfe
@financial/mfe          @kpi/mfe
     │                       │                       │
     └───────────────────────┴───────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
    @platform/app-shared            @platform/api-client
    @platform/ui-kit         (future domain APIs)
    @platform/types
```

| Package | May depend on | Must not depend on |
|---------|---------------|-------------------|
| `@dashboard/mfe` | `api-client`, `app-shared` | `@case-study/mfe` |
| `@survey/mfe` | `api-client`, `app-shared` | `@case-study/mfe` |
| `@keys/mfe` | `api-client`, `app-shared` | `@case-study/mfe` |
| `@financial/mfe` | `api-client`, `app-shared` | `@case-study/mfe` |
| `@kpi/mfe` | `api-client`, `app-shared` | `@case-study/mfe` |
| `@case-study/mfe` | `@failures/mfe`, `@settings/mfe`, `api-client` | `@dashboard/mfe`, other platform MFEs |

**Optional later:** a thin **BFF** or `reporting` service aggregates dashboard + KPI; both `@dashboard/mfe` and `@kpi/mfe` call it through `api-client`, not each other.

---

## 7. Shell integration contract (implemented for F4b)

The host keeps a single dynamic route. Each MFE registers its `PageId` in `routes.ts`. Platform views are imported from `@dashboard/mfe`, `@survey/mfe`, `@keys/mfe`, `@financial/mfe`, and `@kpi/mfe` in `apps/shell/src/app/(app)/[page]/page.tsx`.

**Nav / badges:** `packages/app-shared` keeps `NAV_ITEMS`, `PAGE_LABELS`, role → pages matrix. MFEs do not own navigation config.

**TypeScript paths** (root / shell `tsconfig`, same as existing MFEs):

```json
"@dashboard/mfe": ["apps/mfe-dashboard/src/index.ts"],
"@survey/mfe": ["apps/mfe-survey/src/index.ts"],
"@keys/mfe": ["apps/mfe-keys/src/index.ts"],
"@financial/mfe": ["apps/mfe-financial/src/index.ts"],
"@kpi/mfe": ["apps/mfe-kpi/src/index.ts"]
```

**Root scripts** (future): `typecheck:mfe-dashboard`, … one per package.

---

## 8. Backend alignment (future APIs)

| MFE | Planned API prefix | Service domain |
|-----|-------------------|----------------|
| `@dashboard/mfe` | `GET /api/reporting/v1/dashboard` (BFF aggregate) | Read-only: PO counts, property stats, team snapshot |
| `@survey/mfe` | `/api/operations/v1/survey/*` | Survey offices, jobs, assignments |
| `@keys/mfe` | `/api/operations/v1/keys/*` | Key requests, receipts, custody |
| `@financial/mfe` | `/api/financial/v1/*` | Invoices, cost lines, PO billing |
| `@kpi/mfe` | `/api/reporting/v1/kpi/*` | Specialist load, provider SLA, management KPIs |

Until APIs exist, each MFE keeps **mock data** in its own `lib/` (or reads shared constants from `app-shared` where already centralized).

---

## 9. Implementation phases (when work starts — not now)

| Phase | Work |
|-------|------|
| **F4a** | Scaffold five packages: `package.json`, `tsconfig`, `routes.ts`, empty `index.ts` |
| **F4b** | Move views from shell; move dashboard out of `@case-study/mfe` |
| **F4c** | Add `api-client` stubs + query hooks per domain |
| **F4d** | Remove re-exports from `@case-study/mfe`; shell imports only from domain MFEs |
| **F5** | Module Federation remotes + independent deploy URLs |

---

## 10. Updated `apps/` tree (target)

```text
apps/
  shell/                 # host
  mfe-case-study/        # PO + active transactions + party queues (no dashboard)
  mfe-failures/
  mfe-settings/
  mfe-dashboard/         # NEW — لوحة التحكم
  mfe-survey/            # NEW — الرفع المساحي (/survey)
  mfe-keys/              # NEW — إدارة المفاتيح
  mfe-financial/         # NEW — التقارير المالية
  mfe-kpi/               # NEW — مؤشرات الأداء
  (future)
  mfe-valuation/         # valuation-requests, field-form
```

---

## 11. Checklist before first code move

- [x] Confirm `active-survey` stays in `@case-study/mfe` (party queue)
- [x] Confirm dashboard PO queries use `api-client` + `app-shared/work-orders-read`, not `@case-study/mfe` imports (F4c)
- [x] Five workspace packages: `mfe-dashboard`, `mfe-survey`, `mfe-keys`, `mfe-financial`, `mfe-kpi`
- [x] Shell `tsconfig` paths for all five `@*/mfe` packages
- [x] Root `typecheck:mfe-*` scripts
- [x] Wire shell `[page]/page.tsx` to survey / keys / financial / KPI MFE views (F4b Batch 1)
- [x] Move `SurveyView`, `KeysView`, `FinancialView`, `KpiView` from shell (F4b Batch 1)
- [x] Wire dashboard from `@dashboard/mfe`; move `DashboardView` out of `@case-study/mfe` (F4b Batch 2)

**Related:** [FRONTEND.md](./FRONTEND.md) · [ARCHITECTURE_MICROFRONTENDS_AND_MICROSERVICES.md](../../docs/ARCHITECTURE_MICROFRONTENDS_AND_MICROSERVICES.md)
