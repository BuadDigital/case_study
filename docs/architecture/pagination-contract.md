# List pagination, filtering and sorting contract

**Date:** 2026-09-04 · **Branch:** dev
**Scope:** the three list endpoints behind the heaviest screens — work orders, workflow tasks,
operations tasks. This file is the contract the front-end implements against; it is exact, and any
change to a parameter name, an allowed sort key, or a filter's meaning belongs here first.

Companion documents: [`solid-scorecard.md`](./solid-scorecard.md), [`../ARCHITECTURE.md`](../ARCHITECTURE.md).

## Shared rules

These hold on all three endpoints.

| Rule | Behaviour |
| --- | --- |
| Response shape | `page` **or** `pageSize` present → `PagedResultDto<T>`. Neither present → the plain JSON array the endpoint has always returned. Every existing caller keeps working untouched. |
| `page` | 1-based. Values below 1 clamp to 1. |
| `pageSize` | Clamped to `Database:MaxPageSize` (500). Omitted with `page` present → `Database:DefaultPageSize` (100). |
| Unpaged cap | Without `page`/`pageSize` the row count is still capped at `Database:UnpaginatedListCap` (500). Filters and sort still apply. |
| `sort` | A key from the endpoint's allow-list. **An unknown key falls back to the endpoint default — never a 400.** |
| `dir` | `asc` or `desc`. Anything else (including omitted) falls back to the endpoint default, which is `desc` on all three. |
| `q` | Free text, trimmed. Blank/whitespace means "no search". Substring, case-sensitive as the database collation decides; matched columns are listed per endpoint. |
| Visibility | The actor's visibility rule is applied **inside** the query, before `COUNT` and before `OFFSET/LIMIT`. `TotalCount` is therefore the actor's total, never the table's. |
| Ordering stability | Every sort ends with a deterministic tiebreaker so consecutive pages never overlap or drop a row. |
| Filtering | Every filter is an EF expression. No row is dropped after `ToListAsync`, so a page's contents and `TotalCount` always agree. |

`PagedResultDto<T>`:

```json
{
  "items": [ /* T */ ],
  "totalCount": 137,
  "page": 2,
  "pageSize": 25,
  "totalPages": 6
}
```

`totalPages` is computed from `totalCount` and `pageSize`; it is serialised but not accepted on input.

---

## 1. Work orders

**Route:** `GET /api/work-orders`
**Item type:** `WorkOrderListItemDto`
**Request type:** `WorkOrderListQuery` (`CaseStudy.Application/Contracts/WorkOrderListQuery.cs`)
**Rules module:** `WorkOrderListQueryRules` (`CaseStudy.Application/Rules/WorkOrderListQueryRules.cs`)
**Query service:** `CaseStudy.Infrastructure/Persistence/WorkOrderQueryService.cs`
**Screen it replaces:** `apps/mfe-case-study/src/views/po-list-view-state.ts`

### Query parameters

| Parameter | Type | Meaning |
| --- | --- | --- |
| `page` | int | 1-based page. Presence switches to the paged envelope. |
| `pageSize` | int | Rows per page (clamped, see shared rules). |
| `sort` | string | `created` \| `po` \| `received` \| `due`. |
| `dir` | string | `asc` \| `desc`. Default `desc`. |
| `q` | string | Free text (columns below). |
| `status` | string | One PO list status bucket (below). |
| `type` | string | Assignment-type **Arabic label**: `تنفيذ`, `تركات`, `قطاع خاص`. |

### Sort keys

| `sort` | Column | Notes |
| --- | --- | --- |
| `created` | `WorkOrders.CreatedAtUtc` | **Default.** With the default `dir=desc` this is the exact order the endpoint returned before this contract existed. |
| `po` | `WorkOrders.PoNumber` | |
| `received` | `WorkOrders.ReceivedFromEnfathAt` | The screen's «تاريخ الاستلام». |
| `due` | `WorkOrders.DueDateAt` | |

Tiebreaker: `PoNumber` ascending (unique).

### Filter semantics

**`type`** — exact match on the assignment type behind the label. An unrecognised label is ignored
(no filter), matching the screen, where the type dropdown only ever offers labels present in the data.

**`status`** — the PO list bucket, computed from Case Study columns only:

| Value | Rows returned |
| --- | --- |
| `new` | No live (non-removed) properties yet. |
| `under_study` | At least one live property, but not every expected property is registered **and** studied. |
| `completed` | Live properties ≥ `ExpectedPropertyCount` (min 1) **and** every live property has a case-study parent task that is `completed` or in phase `done`. |
| `stopped` | `LifecycleStatus = stopped`. |
| `cancelled` | `LifecycleStatus = cancelled`. |
| `partially_billed` | **Widened to `under_study`.** See the client-side list below. |
| `fully_billed` | **Widened to `completed`.** See the client-side list below. |

`cancelled` and `stopped` are the manual lifecycle overrides and win over the counts, exactly as in
`WorkOrderListStatus.Resolve`. The other three buckets exclude rows carrying either override. An
unrecognised value is ignored (no filter).

**`q`** — a row matches when any of these contains the text:

- `WorkOrders.PoNumber`
- `WorkOrders.AssignmentSpecialist`
- the Arabic label of `WorkOrders.AssignmentType` (resolved to the matching enum values before the query)
- any live property's `DeedNumber` or `RealEstateRegNumber`

### Response

Paged: `PagedResultDto<WorkOrderListItemDto>`. Unpaged: `WorkOrderListItemDto[]`.

### Still client-side

1. **The billing refinement.** `partially_billed` / `fully_billed` depend on whether Finance issued
   an Enfaz invoice for the PO. That fact lives in the Financial context behind
   `IPoEnfazInvoiceLookup`, which is an HTTP call in the split deployment and only answers for a
   supplied list of PO numbers — it cannot be a SQL predicate. The server therefore returns the
   study bucket the billing label refines, and the client still narrows on `row.status`. **Paging is
   approximate for those two buckets**: request them with a generous `pageSize`, or filter them
   client-side over a `status=under_study` / `status=completed` page.
2. **Deed-mode search expansion.** `buildPoListDisplay` turns a deed query into one row *per matching
   deed* (`view: "property"`) using `classifyPoListSearch`, `normalizeDeedQuery` and the deed index
   from `/api/work-orders/property-rows` — Arabic-digit folding, leading-zero folding, and the
   `صك` / `رقم الصك` prefixes. The server `q` is a plain substring match and always returns PO rows.
   Keep `buildPoDeedIndex`, the deed-row view, and the search-mode badge on the client.
3. **KPI counters and per-row derivations.** `poListKpi`, `isDueUrgent` / `isDueSoon` /
   `isDueWithin48`, `poProgressPct`, `progFill`, `poStatusStyle`.
4. **Team stack.** `teamNamesByPo` reads workflow-task assignees; `registeredCountsByPo` reads the
   deed index. Both come from other endpoints.
5. **The type dropdown's options.** `assignmentTypesFromRows` derives them from the loaded rows; with
   server paging the client should switch to the three known labels rather than the page's contents.

---

## 2. Workflow tasks

**Route:** `GET /api/workflow-tasks`
**Item type:** `WorkflowTaskDto`
**Request type:** `WorkflowTaskListQuery` (`CaseStudy.Application/Contracts/WorkflowTaskListQuery.cs`)
**Rules module:** `WorkflowTaskListQueryRules` (`CaseStudy.Application/Rules/WorkflowTaskListQueryRules.cs`)
**Query service:** `CaseStudy.Infrastructure/Persistence/WorkflowTaskQueryService.cs`
**Screens it replaces:** `apps/mfe-case-study/src/views/active-transaction-queue-state.ts` and
`apps/mfe-case-study/src/lib/app-data/active-queue-list-filters.ts`

### Query parameters

| Parameter | Type | Meaning |
| --- | --- | --- |
| `page` | int | 1-based page. Presence switches to the paged envelope. |
| `pageSize` | int | Rows per page (clamped). |
| `sort` | string | `created` \| `updated` \| `po` \| `poReceived` \| `poCreated`. |
| `dir` | string | `asc` \| `desc`. Default `desc`. |
| `q` | string | Free text (columns below). |
| `kind` | string | Comma-separated task kinds. |
| `status` | string | Comma-separated task statuses. |
| `phase` | string | Comma-separated case-study phases. |
| `assigneeId` | string | Exact `AssigneeId` (distribution assignee id). |
| `assigneeRole` | string | Exact `AssigneeRole`, case-insensitive. |
| `poNumber` | string | Exact `PoNumber`. |
| `assignmentType` | string | Exact `WorkflowTasks.AssignmentType` label carried on the task row. |

### Sort keys

| `sort` | Order |
| --- | --- |
| `created` | `WorkflowTasks.CreatedAtUtc`. **Default** — with `dir=desc` this is the order the endpoint returned before this contract. |
| `updated` | `WorkflowTasks.UpdatedAtUtc`. The queue's own default (`distributed-newest-first` / `compareQueueTasksByUpdatedNewestFirst`). |
| `po` | `WorkflowTasks.PoNumber`. |
| `poReceived` | `ReceivedFromEnfathAt` of the task's work order — the queue's `oldest-first` with `dir=asc`. |
| `poCreated` | `CreatedAtUtc` of the task's work order — the queue's `newest-first` with `dir=desc`. |

Tiebreakers, in order: `PoNumber` ascending, `PropertyOrdinal` ascending, `Id` ascending. That
matches the queue comparators, which all fall back to PO then property slot.

### Filter semantics

**`kind`** — CSV of the wire values: `case-study-property`, `field-inspection`,
`property-appraisal`, `engineering-survey`, `government-review`, `valuation-coordination`.
Unrecognised tokens are dropped. If **every** token is unrecognised the filter is not applied (the
list is not narrowed to nothing).

**`status`** — CSV of `open`, `completed`, `cancelled`, `blocked`. Same drop-unknown rule.
The queue's default listing is `status=open,blocked`; its "show all" toggle simply omits the
parameter.

**`phase`** — CSV of `enfath`, `bourse`, `distribution`, `case-study`, `obstruction`, `done`.
Same drop-unknown rule.

**`assigneeId` / `assigneeRole` / `poNumber` / `assignmentType`** — trimmed exact matches; blank
means no filter. `assigneeRole` compares lower-cased on both sides.

**`q`** — a row matches when any of these contains the text: `PoNumber`, `Title`, `AssigneeName`,
`AssignmentType`.

### Visibility

`WorkflowTaskVisibilityRules.VisibleTo(actor)` is the first `Where` in the query:

- staff who may manage party submissions see every task;
- a party actor sees tasks whose `AssigneeRole` equals their prototype role **and** whose assignee is
  them by distribution assignee id, user id, or display name;
- no actor, or an actor with no identity at all, sees nothing.

It runs before `COUNT`, so `totalCount` is the actor's.

### Response

Paged: `PagedResultDto<WorkflowTaskDto>`. Unpaged: `WorkflowTaskDto[]`.
Both shapes still carry the enrichment fields `fieldInspectionCompleted`, `fieldInspectionAccepted`
and `fieldInspectionTaskId`, which are filled per page.

### Still client-side

1. **Everything joined from the PO intake record.** Deed label, city, district, property type,
   classification, and the `record.assignmentType ?? task.assignmentType` fallback are produced by
   `buildPrimaryQueueRowMeta` / `buildDistributionQueueRowMeta` from a *different* endpoint's data.
   So `filterPrimaryQueueRowMeta`'s and `filterDistributionQueueRows`'s search over deed / city /
   district / property type / classification stays on the client, as does the `typeFilter` when it is
   driven by the PO record rather than the task column. Server `q` covers the task's own columns only.
2. **The status-label filter.** The queue filters on a *badge label*
   (`resolveQueueTaskStatusFilterLabel` → `fieldInspectionTaskStatusBadge`, or the remaining-time
   state «متأخرة» / «ضمن المهلة»), which is computed from the field-inspection workspace and the SLA
   clock, not from a column. Server `status` is the persisted `WorkflowTaskStatus`.
3. **Appraisal status groups.** `APPRAISAL_STATUS_FILTERS` and `appraiserQueueStatusGroup` read
   sibling tasks and valuation state per row.
4. **The suspended-property exclusion** inside `isListedQueueTask` (`isTaskOnSuspendedProperty`),
   which reads the Failures context cache.
5. **Per-page `config.filterListed` predicates** and the PO grouping (`buildAllTxPoGroups`).

---

## 3. Operations tasks

**Route:** `GET /api/operations-tasks`
**Item type:** `OperationsTaskDto`
**Request type:** `OperationsTaskListQuery` (`Operations.Application/Contracts/OperationsTaskListQuery.cs`)
**Rules module:** `OperationsTaskListQueryRules` (`Operations.Application/Rules/OperationsTaskListQueryRules.cs`)
**Query service:** `Operations.Infrastructure/Services/OperationsTaskQueryService.cs`
**Screen it replaces:** `apps/mfe-case-study/src/views/operations-tasks-view-state.ts`

### Query parameters

| Parameter | Type | Meaning |
| --- | --- | --- |
| `page` | int | 1-based page. Presence switches to the paged envelope. |
| `pageSize` | int | Rows per page (clamped). |
| `sort` | string | `queue` \| `created` \| `due` \| `updated` \| `priority`. |
| `dir` | string | `asc` \| `desc`. Default `desc`. |
| `q` | string | Free text (columns below). |
| `assigneeId` | string | Exact `AssigneeId`. **Unchanged from before this contract.** |
| `createdBy` | string | Exact `CreatedBy` user id. **Unchanged.** |
| `status` | string | Single status. **Unchanged**, including the "unknown matches nothing" rule. |
| `scope` | string | `general` \| `transaction` \| `work_order` \| `multi`. |
| `type` | string | `general` \| `court_visit` \| `reshoot` \| `field_visit` \| `inquiry`. |
| `activeOnly` | bool | `true` keeps only `created` and `in_progress`. |
| `excludeFailurePaused` | bool | `true` drops rows parked on an active property failure. |

### Sort keys

| `sort` | Order |
| --- | --- |
| `queue` | **Default.** Status band ascending (`created`/`in_progress` = 0, `paused` = 1, `completed`/`cancelled` = 2), then `CreatedAtUtc` in `dir` (default `desc`). This is the screen's `taskStatusRank` order. |
| `created` | `CreatedAtUtc`. |
| `due` | `DueAtUtc`. |
| `updated` | `UpdatedAtUtc`. |
| `priority` | `high` → `medium` → `low` with `dir=asc` (the stored string would sort alphabetically, so the endpoint orders by an explicit rank). |

Tiebreakers: `DisplayId` ascending, then `Id`.

> The `queue` band is always ascending — `dir` only flips the within-band recency, exactly as the
> screen does. `sort=queue&dir=asc` gives oldest-first inside each band.

### Filter semantics

**`status`, `scope`, `type`** — parsed against the wire values. **An unrecognised value returns an
empty list (`totalCount: 0`), it does not widen the result.** This preserves the endpoint's existing
behaviour for `status` and applies the same rule to the two new filters.

**`activeOnly=true`** — `status ∈ {created, in_progress}`. Mirrors the screen's "show all" toggle in
its off position. Combine freely with `status`; the two intersect.

**`excludeFailurePaused=true`** — drops rows where `Status = paused` and `PauseReason` starts with
`تعذر نشط` (`OperationsTaskLifecycleRules.FailurePauseReasonPrefix`, shared with
`IsFailureObstructionPauseReason` and with the front-end's `isOpsTaskFailurePauseReason`). This is
the half of `queueTasksForViewer` that the task row can answer on its own.

**`q`** — a row matches when any of these contains the text: `Title`, `DisplayId`, `AssigneeName`,
`PoNumber`, `Reference`.

### Actor narrowing

Unchanged from before this contract, and applied inside the query so counts are the actor's:

- a manager role (`case-specialist`, `section-supervisor`, `general-manager`, `cdo`) sees every task;
- anyone else sees only tasks assigned to their distribution assignee id, or that they created.

### Response

Paged: `PagedResultDto<OperationsTaskDto>`. Unpaged: `OperationsTaskDto[]`.

### Still client-side

1. **`isOperationsTaskBlockedByFailure`.** The other half of the hidden-by-failure rule needs the
   Failures records and the PO → property mapping (`failureTargetsForOperationsTask` +
   `blockingFailureForProperty`), neither of which is in the Operations database. Only the
   pause-reason half moved (`excludeFailurePaused`). A viewer whose queue hides blocked rows must
   still filter the page it received — so `totalCount` can overstate what that viewer sees.
2. **Deed-number search.** `OperationsTasks.DeedsJson` is a `jsonb` column, so a substring match
   would need a cast (and a matching index) to be safe in Postgres. `q` therefore does not search
   deeds; the screen's `t.deeds.join(" ")` term stays on the client. Search by PO number instead
   where possible.
3. **KPI counters.** `operationsTaskKpis` (active / created / paused / in-progress / completed) is
   computed over the loaded rows; with server paging it needs its own call or a metrics endpoint.
4. **`operationsTasksToResumeAfterFailure`** — the auto-resume sweep the view performs.
5. **`matchesOperationsTaskAssignee`'s display-name fallback.** The server matches an actor by
   distribution assignee id or creator id only; the client's "is this row mine" check also falls back
   to comparing display names.

---

## Verification

- `cd backend && dotnet build RealEstateEval.slnx -nologo -v q` — clean.
- `dotnet test RealEstateEval.Application.Tests/...` — includes `WorkOrderListQueryRulesTests`,
  `WorkflowTaskListQueryRulesTests`, `OperationsTaskListQueryRulesTests` (pure allow-list / sort-map
  coverage) and `WorkOrderListQueryTests`, `WorkflowTaskListQueryTests`,
  `OperationsTaskListQueryTests` (filter + sort + paging + visibility over the in-memory provider).
- `dotnet test RealEstateEval.Architecture.Tests/...` — `ListPagingSafetyTests`,
  `RepositoryBoundaryTests`, `CaseStudySessionFacadeTests` and `InfrastructureServiceSizeTests` all
  still green: the request types are plain records in `Application/Contracts`, the allow-lists are
  pure modules in `Application/Rules`, and EF stays inside the query services.
