# Architecture — `@evaluator/mfe` (appraiser / property-appraisal)

**Status:** Implemented — evaluator code lives in `apps/mfe-evaluator` (`@evaluator/mfe`); shell keeps thin route adapters only.

**Goal:** Extract shell-owned **مقيم عقاري** prototype into `@evaluator/mfe`, while `@case-study/mfe` keeps the **party-task queue shell** (`PartyActiveTaskWork`) and receives appraiser UI through a stable injection contract.

**Related:** [MFE_PLATFORM_DOMAINS.md](./MFE_PLATFORM_DOMAINS.md) · [FRONTEND.md](./FRONTEND.md)

---

## 1. Inventory — shell evaluator/appraiser assets today

### `components/prototype/evaluator/` (3 files)

| File | Role |
|------|------|
| `EvaluatorWindow.tsx` | Upload form: PDF report, price, notes, validation, submit via `finalizeAppraiserSubmission` |
| `AppraiserUploadTab.tsx` | Party work body: `EvaluatorWindow` + embedded `CaseStudyForm` (party advisory) |
| `EvaluatorAdvisoryPanel.tsx` | Specialist view on `/case-study/[taskId]`: submitted appraisal, recall approve/reject, checklist |

### `lib/prototype/evaluator/` (11 files)

| File | Role |
|------|------|
| `evaluator-window-data.ts` | Types, draft factory, status/price formatters |
| `evaluator-submission-storage.ts` | localStorage draft/submit; `EVALUATOR_SUBMISSION_CHANGED_EVENT` |
| `@platform/app-shared/prototype/party-task-recall-storage` | Recall request/approve/reject; `PARTY_TASK_RECALL_CHANGED_EVENT` |
| `evaluator-validation.ts` | Field validation for upload form |
| `evaluator-report-attachments.ts` | PDF cache + preview |
| `evaluator-inspection-gate.ts` | Sibling inspection gate (disabled in prototype); `findAppraisalChildForParent` |
| `evaluator-queue.ts` | Appraiser queue filter, open rules, status badges |
| `appraiser-queue-row-menu.ts` | Row ⋮ items on `/property-appraisal` queue |
| `appraiser-recall-menu-items.ts` | PO property row ⋮ recall items |
| `finalize-appraiser-submission.ts` | Submit + sync party `CaseStudyForm` draft (`@case-study/mfe`) |
| `evaluator-window-host.ts` | Ref bridge types (`submit`, `onSubmitted`, `onSavingChange`) |

### Shell wiring (outside evaluator folders)

| File | Role |
|------|------|
| `lib/prototype/party-appraisal-extensions.tsx` | Implements `PartyAppraisalExtensions` — queue patches + `renderAppraisalWork` |
| `components/party-tasks/PartyActiveTaskViewHost.tsx` | Passes `partyAppraisalExtensions` → `PartyActiveTaskView` |
| `app/(app)/[page]/page.tsx` | Routes `property-appraisal` (and other party pages) via `PartyActiveTaskViewHost` |
| `app/(app)/case-study/[taskId]/page.tsx` | Injects `EvaluatorAdvisoryPanel` via `CaseStudyWorkspaceView.renderPartiesExtras` |
| `components/po/PoPropertiesPageClient.tsx` | Appraiser-only recall menu + event-driven refetch on PO properties |

### Case-study MFE slots (stay in `@case-study/mfe`)

| Asset | Role |
|-------|------|
| `lib/party-appraisal-extensions.ts` | **Types only** — `PartyAppraisalExtensions`, `PartyEvaluatorWorkHostRef` |
| `views/PartyActiveTaskView.tsx` | Accepts optional `appraisalExtensions`; patches queue for `property-appraisal` |
| `views/PartyActiveTaskWork.tsx` | Appraisal footer, `evaluatorHostRef`, calls `renderAppraisalWork` / `isEvaluatorLocked` |
| `views/PartyActiveTaskWorkPanel.tsx` | Thin panel wrapper |
| `lib/case-study-evaluator-events.ts` | Duplicate event name — must stay in sync with evaluator storage |
| `components/case-study/CaseStudyForm.tsx` | Listens to `EVALUATOR_SUBMISSION_CHANGED_EVENT` to refresh party answers |

### Tangential shell references (not evaluator MFE scope)

| File | Note |
|------|------|
| `@valuation/mfe` → `ValuationRequestsView` | `real-estate-appraiser` role filter — wired in shell `[page]/page.tsx` |
| `lib/query/prototype-queries.ts` | Shared task/PO queries — shell or `api-client`, not evaluator-owned |
| `packages/design-system/.../prototype.css` | `.evaluator-*`, `.appraiser-*` styles (~56 rules) — keep in design-system until F5 |

---

## 2. What stays in shell vs future `@evaluator/mfe`

### Moves to `@evaluator/mfe` (`apps/mfe-evaluator`)

Everything under `components/prototype/evaluator/*` and `lib/prototype/evaluator/*`, plus:

- `party-appraisal-extensions.tsx` → export `partyAppraisalExtensions` (and optionally `createPartyAppraisalExtensions()` if tests need overrides)
- A thin **`renderCaseStudyEvaluatorExtras`** helper for the advisory panel (so `case-study/[taskId]/page.tsx` stays a one-liner)
- **`buildAppraiserPoPropertyRowMoreItems`** (or hook) consumed by `PoPropertiesPageClient`

Suggested package surface (mirror `@failures/mfe`):

```text
apps/mfe-evaluator/
  package.json          # name: @evaluator/mfe
  src/
    index.ts            # partyAppraisalExtensions, EvaluatorAdvisoryPanel, Po recall helpers
    routes.ts           # EVALUATOR_MFE_PAGE_IDS (property-appraisal only today)
    components/
    lib/
    extensions/
      party-appraisal-extensions.tsx
```

### Stays in `@platform/shell` (host)

| Concern | Why |
|---------|-----|
| `PartyActiveTaskViewHost` | Host adapter: imports `@case-study/mfe` view + `@evaluator/mfe` extensions |
| `[page]/page.tsx` routing | Shell owns `PageId` → view map |
| `case-study/[taskId]/page.tsx` | Shell route; imports evaluator render helper |
| `PoPropertiesPageClient` | Shell PO route wrapper; passes evaluator-built menu callback into `@case-study/mfe` |
| `prototype-queries` | Cross-cutting TanStack hooks until domain APIs land |

### Stays in `@case-study/mfe`

| Concern | Why |
|---------|-----|
| `PartyActiveTaskWork` / `PartyActiveTaskView` | Generic party-queue + work panel for **all** party kinds |
| `PartyAppraisalExtensions` **interface** | Case-study defines the injection contract; evaluator implements it |
| `CaseStudyForm`, `CaseStudyWorkspaceView` | Case-study domain; appraiser **embeds** form, does not own it |
| Workflow tasks, PO properties page shell | Transaction workflow core |
| `loadPartyCaseStudyFormDraft` / `savePartyCaseStudyFormDraft` | Party answer persistence |

**Rule:** `@evaluator/mfe` may depend on `@case-study/mfe` (for `WorkflowTask`, `CaseStudyForm`, draft APIs). `@case-study/mfe` must **not** depend on `@evaluator/mfe`.

---

## 3. Dependency edges (injection contract)

```text
┌─────────────────────────────────────────────────────────────────┐
│  shell                                                           │
│  [page]/page.tsx ──► PartyActiveTaskViewHost                     │
│  case-study/[taskId] ──► renderCaseStudyEvaluatorExtras()        │
│  po/.../property ──► PoPropertiesPageClient + recall callback    │
└────────────┬───────────────────────────────┬────────────────────┘
             │ appraisalExtensions            │ renderPartiesExtras
             ▼                                ▼
┌────────────────────────┐         ┌──────────────────────────────┐
│  @evaluator/mfe        │         │  @case-study/mfe              │
│  partyAppraisalExt…    │────────►│  PartyActiveTaskView          │
│  AppraiserUploadTab    │ render  │    └► PartyActiveTaskWork     │
│  EvaluatorAdvisoryPanel│         │         property-appraisal     │
│  storage / queue / …   │         │         slots only             │
└───────────┬────────────┘         └──────────────┬───────────────┘
            │ finalizeAppraiserSubmission          │ CaseStudyForm
            │ (party draft read/write)             │ listens to event
            └──────────────────────────────────────┘
```

### `PartyActiveTaskWork` slots (case-study)

| Slot | Evaluator provides |
|------|-------------------|
| `appraisalExtensions.patchQueueConfig` | Appraiser filter, badges, row ⋮, refresh events |
| `appraisalExtensions.renderAppraisalWork` | `AppraiserUploadTab` → `EvaluatorWindow` + `CaseStudyForm` |
| `appraisalExtensions.isEvaluatorLocked` | Read submission storage; lock after submit |
| `PartyEvaluatorWorkHostRef.submit` | Wired by `EvaluatorWindow` via ref |

### Cross-package couplings to preserve

| Edge | Notes |
|------|-------|
| `finalize-appraiser-submission` → case-study draft APIs | Hard boundary; keep in evaluator MFE, import from `@case-study/mfe` |
| `AppraiserUploadTab` → `CaseStudyForm` | Intentional embed; appraiser party answers live in case-study |
| `EVALUATOR_SUBMISSION_CHANGED_EVENT` | Single source in `@evaluator/mfe`; case-study re-exports or imports constant |
| `evaluator-inspection-gate` → `field-inspection` tasks | Workflow coupling stays; gate logic belongs in evaluator |

---

## 4. Recommended move order

| Step | Work | Risk |
|------|------|------|
| **E0** | Scaffold `apps/mfe-evaluator`: `package.json`, `tsconfig`, shell path alias, `typecheck:mfe-evaluator` | Low |
| **E1** | Move leaf `lib/` (window-data, storage, validation, report-attachments, recall, queue, menus, window-host) | Low — no UI |
| **E2** | Move `EvaluatorWindow` + `AppraiserUploadTab` + `EvaluatorAdvisoryPanel` | Medium — CSS classes in design-system |
| **E3** | Move `party-appraisal-extensions.tsx`; wire `PartyActiveTaskViewHost` to `@evaluator/mfe` | Medium — party queue regression |
| **E4** | Export `renderCaseStudyEvaluatorExtras`; update `case-study/[taskId]/page.tsx` | Low |
| **E5** | Export PO recall builder; slim `PoPropertiesPageClient` | Low |
| **E6** | Deduplicate `case-study-evaluator-events.ts` → import from `@evaluator/mfe` | Low |
| **E7** | Add `api-client` stubs + query hooks when appraisal API exists | Future |

Do **after** E3–E6: optional collapse of `PartyActiveTaskViewHost` into a generic “party extensions registry” if more party MFEs appear.

---

## 5. What NOT to move yet

| Asset | Reason |
|-------|--------|
| `PartyActiveTaskWork`, `PartyActiveTaskView`, `ActiveTransactionQueueView` | Shared party-queue framework — not appraiser-specific |
| `PartyAppraisalExtensions` type definition | Stays in case-study as the injection interface |
| `CaseStudyForm`, `CaseStudyWorkspaceView`, party draft storage | Case-study domain |
| `ValuationRequestsView`, `FieldFormView` | Separate future `@valuation/mfe` (coordination / field inspector), per platform plan |
| `GovernmentReviewView` party path | Different party kind; unchanged |
| Nav / `PAGE_LABELS` / role → pages in `@platform/app-shared` | Host config |
| `prototype-queries.ts` | Shell-wide until per-domain API hooks exist |
| `prototype.css` evaluator styles | Keep in `@platform/design-system` until split theming (F5) or evaluator ships standalone CSS module |
| Inspection gate **enforcement** (commented TODO) | Product decision tied to field-inspection rollout — do not enable during MFE split |

---

## 6. Target `apps/` tree (evaluator slice)

```text
apps/
  shell/                 # host: wires evaluator extensions into routes
  mfe-case-study/        # party queues + CaseStudyForm (no evaluator impl)
  mfe-evaluator/         # NEW — property-appraisal work + advisory + recall
  (future)
  mfe-valuation/         # valuation-requests, field-form
```

---

## 7. Checklist before first code move

- [x] Confirm `@case-study/mfe` does not import `@evaluator/mfe` (one-way edge)
- [x] Single owner for `EVALUATOR_SUBMISSION_CHANGED_EVENT` / `EVALUATOR_RECALL_CHANGED_EVENT` (`@evaluator/mfe`; case-study keeps duplicate constant for one-way edge)
- [x] `PartyActiveTaskViewHost` remains shell-only (3-line adapter)
- [ ] Regression paths: `/property-appraisal` queue, PO properties recall ⋮, `/case-study/[taskId]` advisory panel
- [ ] Appraiser login (`real-estate-appraiser`) smoke test after each step
