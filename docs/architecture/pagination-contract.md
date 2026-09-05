# List pagination, filtering and sorting contract

**Date:** 2026-09-04 · **Branch:** dev
**Scope:** every list endpoint that a screen pages, sorts or searches — work orders (plus their KPI
counts), workflow tasks, operations tasks, comparable properties, failures, notifications, the two
financial ledgers, the party billing lists and the Enfaz billing lists. This file is the contract the
front-end implements against; it is exact, and any change to a parameter name, an allowed sort key,
or a filter's meaning belongs here first.

Companion documents: [`solid-scorecard.md`](./solid-scorecard.md), [`../ARCHITECTURE.md`](../ARCHITECTURE.md).

## Shared rules

These hold on every endpoint below.

| Rule | Behaviour |
| --- | --- |
| Response shape | `page` **or** `pageSize` present → `PagedResultDto<T>`. Neither present → the plain JSON array the endpoint has always returned. Every existing caller keeps working untouched. |
| `page` | 1-based. Values below 1 clamp to 1. |
| `pageSize` | Clamped to `Database:MaxPageSize` (500). Omitted with `page` present → `Database:DefaultPageSize` (100). |
| Unpaged cap | Without `page`/`pageSize` the row count is still capped (`Database:UnpaginatedListCap`, 500, or the endpoint's own cap where noted). Filters and sort still apply. |
| `sort` | A key from the endpoint's allow-list. **An unknown key falls back to the endpoint default — never a 400.** |
| `dir` | `asc` or `desc`. Anything else (including omitted) falls back to the endpoint default, which is `desc` everywhere. |
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

---

## 1.1 Work-order KPI counts

**Route:** `GET /api/work-orders/counts`
**Item type:** `WorkOrderListCountsDto` (`CaseStudy.Application/Contracts/WorkOrderListCountsDto.cs`)
**Query service:** `WorkOrderQueryService.CountsAsync`
**Screen it replaces:** `poListKpi` and the empty-state copy in `po-list-view-state.ts` / `PoListView.tsx`

Takes **the same parameters as the list except the page window and the sort** — `q`, `status`, `type`
only. `page`, `pageSize`, `sort` and `dir` are not accepted and would be meaningless. Visibility is
applied exactly as on the list, before every count, so the numbers are the actor's.

Every field is a SQL `COUNT`; no row is materialised.

```json
{
  "total": 137,
  "totalUnfiltered": 240,
  "active": 88,
  "overdue": 12,
  "dueSoon": 5,
  "doneProperties": 310
}
```

| Field | Screen | Definition |
| --- | --- | --- |
| `total` | — | Rows matching `q` / `status` / `type`. **Always equals `PagedResultDto.TotalCount` for the same filters**, so the pager can be driven from either. |
| `totalUnfiltered` | empty state | Rows visible to the actor with `q` / `status` / `type` ignored. Show «لا توجد أوامر عمل.» when this is `0`, «لا توجد نتائج مطابقة» when it is non-zero but `total` is `0`. |
| `active` | «أوامر نشطة» | Rows whose PO list status is **not terminal** — i.e. the `new` and `under_study` buckets. Terminal is `cancelled`, `stopped`, `completed` and therefore `fully_billed`, which only refines `completed`. Mirrors `!isPoListStatusTerminal(status)`. |
| `overdue` | «متأخرة عن الاستحقاق» | `active` rows with `DueDateAt < today`. |
| `dueSoon` | «تستحق خلال 48 ساعة» | `active` rows with `today < DueDateAt ≤ today + 2 days`. |
| `doneProperties` | «عقارات أُنجزت» | Live properties across **all** matched rows (terminal ones included) whose case-study task is `completed` or in phase `done`. This is the sum of the list's `completedCount`, matching the screen, which adds `p.done` before the terminal `continue`. |

**Clock.** `today` is the UTC date from the injected `TimeProvider`. The screen's `isPastDue` uses the
browser's local midnight and `isDueWithin48` parses the due date at UTC midnight and compares against
`now` / `now + 48h`; at date granularity that window is always exactly *tomorrow and the day after*,
which is what `dueSoon` implements. Expect at most a one-day difference for a viewer whose timezone
has already rolled over.

**Note for the caller.** The client previously computed the KPI band by loading the whole list. It no
longer needs to: one `/counts` call replaces `usePoListRowsQuery()` for the band and the empty-state
copy. Send it the same filter values as the list (and re-fetch it when they change), but not the page.

### Still client-side (work orders)

1. **The billing refinement.** `partially_billed` / `fully_billed` depend on whether Finance issued
   an Enfaz invoice for the PO. That fact lives in the Financial context behind
   `IPoEnfazInvoiceLookup`, which is an HTTP call in the split deployment and only answers for a
   supplied list of PO numbers — it cannot be a SQL predicate. The server therefore returns the
   study bucket the billing label refines, and the client still narrows on `row.status`. **Paging is
   approximate for those two buckets**: request them with a generous `pageSize`, or filter them
   client-side over a `status=under_study` / `status=completed` page. The same caveat applies to
   `/counts` with those two `status` values — it answers for the widened bucket.
2. **Deed-mode search expansion.** `buildPoListDisplay` turns a deed query into one row *per matching
   deed* (`view: "property"`) using `classifyPoListSearch`, `normalizeDeedQuery` and the deed index
   from `/api/work-orders/property-rows` — Arabic-digit folding, leading-zero folding, and the
   `صك` / `رقم الصك` prefixes. The server `q` is a plain substring match and always returns PO rows.
   Keep `buildPoDeedIndex`, the deed-row view, and the search-mode badge on the client.
3. **Per-row derivations only.** `isDueUrgent` / `isDueSoon` / `isDueWithin48`, `poProgressPct`,
   `progFill`, `poStatusStyle` still run per row. **`poListKpi` is retired** — the four counters and
   the empty-state totals now come from `/api/work-orders/counts` (§1.1).
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
| `sort` | string | `created` \| `updated` \| `po` \| `poReceived` \| `poCreated` \| `deed` \| `city`. |
| `dir` | string | `asc` \| `desc`. Default `desc`. |
| `q` | string | Free text (columns below — **now includes the PO-record columns**). |
| `kind` | string | Comma-separated task kinds. |
| `status` | string | Comma-separated task statuses. |
| `phase` | string | Comma-separated case-study phases. |
| `assigneeId` | string | Exact `AssigneeId` (distribution assignee id). |
| `assigneeRole` | string | Exact `AssigneeRole`, case-insensitive. |
| `poNumber` | string | Exact `PoNumber`. |
| `assignmentType` | string | Exact `WorkflowTasks.AssignmentType` label carried on the task row. |

### The PO-record columns on the row (new)

Every `WorkflowTaskDto` now carries the five columns the queue used to join client-side from the PO
intake record. They come from the task's `WorkOrderProperty` (`PropertyId`), joined in the same
`case_study` schema by a correlated sub-query, filled per page:

| Field | Source column | Null when |
| --- | --- | --- |
| `deedNumber` | `WorkOrderProperties.DeedNumber` | the task has no `propertyId` (an unfilled slot), or the property row is gone |
| `city` | `WorkOrderProperties.City` | ditto |
| `district` | `WorkOrderProperties.District` | ditto |
| `propertyType` | `WorkOrderProperties.PropertyType` | ditto |
| `classification` | `WorkOrderProperties.Classification` | ditto |

**Additive.** All five are optional and absent-as-null; no existing consumer of `WorkflowTaskDto`
changes behaviour, and the enrichment fields `fieldInspectionCompleted`, `fieldInspectionAccepted`
and `fieldInspectionTaskId` are unaffected.

### Sort keys

| `sort` | Order |
| --- | --- |
| `created` | `WorkflowTasks.CreatedAtUtc`. **Default** — with `dir=desc` this is the order the endpoint returned before this contract. |
| `updated` | `WorkflowTasks.UpdatedAtUtc`. The queue's own default (`distributed-newest-first` / `compareQueueTasksByUpdatedNewestFirst`). |
| `po` | `WorkflowTasks.PoNumber`. |
| `poReceived` | `ReceivedFromEnfathAt` of the task's work order — the queue's `oldest-first` with `dir=asc`. |
| `poCreated` | `CreatedAtUtc` of the task's work order — the queue's `newest-first` with `dir=desc`. |
| `deed` | **New.** `DeedNumber` of the task's property. Tasks with no property sort as null (first with `dir=asc`). |
| `city` | **New.** `City` of the task's property. Same null handling. |

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

**`q`** — a row matches when any of these contains the text:

- the task's own columns: `PoNumber`, `Title`, `AssigneeName`, `AssignmentType`;
- **the PO-record columns of its property: `DeedNumber`, `City`, `District`, `PropertyType`,
  `Classification`.**

That is exactly the haystack `filterPrimaryQueueRowMeta` builds (`deed`, `assignmentType`, `city`,
`district`) plus the two extra columns `filterDistributionQueueRows` adds (`propertyType`,
`classification`) — so both queue searches can now be sent to the server.

### Visibility

`WorkflowTaskVisibilityRules.VisibleTo(actor)` is the first `Where` in the query:

- staff who may manage party submissions see every task;
- a party actor sees tasks whose `AssigneeRole` equals their prototype role **and** whose assignee is
  them by distribution assignee id, user id, or display name;
- no actor, or an actor with no identity at all, sees nothing.

It runs before `COUNT`, so `totalCount` is the actor's.

### Response

Paged: `PagedResultDto<WorkflowTaskDto>`. Unpaged: `WorkflowTaskDto[]`.

### Retired client-side rules (the queue can now page)

These were the reason the active transaction queue kept every row in the browser. They are gone:

- **the PO-record search.** `filterPrimaryQueueRowMeta`'s and `filterDistributionQueueRows`'s
  `hay.includes(q)` over deed / city / district / property type / classification — server `q` covers
  all five. Send the search term instead of filtering the page.
- **the PO-record joins for display.** `deedNumber`, `city`, `district`, `propertyType` and
  `classification` are on the row; `buildPrimaryQueueRowMeta` / `buildDistributionQueueRowMeta` no
  longer need `poByNumber` for them. The `record.assignmentType ?? task.assignmentType` fallback
  still applies where the PO record carries a different label than the task row.
- **deed / city sorting.** `sort=deed` and `sort=city` replace the client comparators.

### Still client-side (workflow tasks)

1. **The status-label filter.** The queue filters on a *badge label*
   (`resolveQueueTaskStatusFilterLabel` → `fieldInspectionTaskStatusBadge`, or the remaining-time
   state «متأخرة» / «ضمن المهلة»), which is computed from the field-inspection workspace and the SLA
   clock, not from a column. Server `status` is the persisted `WorkflowTaskStatus`.
2. **Appraisal status groups.** `APPRAISAL_STATUS_FILTERS` and `appraiserQueueStatusGroup` read
   sibling tasks and valuation state per row.
3. **The suspended-property exclusion** inside `isListedQueueTask` (`isTaskOnSuspendedProperty`),
   which reads the Failures context cache.
4. **Per-page `config.filterListed` predicates** and the PO grouping (`buildAllTxPoGroups`).

Rules 1-4 still run after the page is cut, so a viewer using one of them sees fewer rows than
`totalCount` promises. A queue that only uses search, `kind`/`status`/`phase`/assignee filters and
one of the seven sort keys is fully server-paged.

---

## 3. Operations tasks

**Route:** `GET /api/operations-tasks`
**Item type:** `OperationsTaskDto`
**Request type:** `OperationsTaskListQuery` (`Operations.Application/Contracts/OperationsTaskListQuery.cs`)
**Rules modules:** `OperationsTaskListQueryRules` and `OperationsTaskDeedSearch`
(`Operations.Application/Rules/`)
**Query service:** `Operations.Infrastructure/Persistence/OperationsTaskQueryService.cs`
(moved out of `Infrastructure/Services` — it is a persistence adapter, like every other `*QueryService`)
**Screen it replaces:** `apps/mfe-case-study/src/views/operations-tasks-view-state.ts`

### Query parameters

| Parameter | Type | Meaning |
| --- | --- | --- |
| `page` | int | 1-based page. Presence switches to the paged envelope. |
| `pageSize` | int | Rows per page (clamped). |
| `sort` | string | `queue` \| `created` \| `due` \| `updated` \| `priority`. |
| `dir` | string | `asc` \| `desc`. Default `desc`. |
| `q` | string | Free text (columns below — **now includes deed numbers**). |
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
`PoNumber`, `Reference`, **or any deed number in `DeedsJson`**.

#### Deed search (new)

`OperationsTasks.DeedsJson` is a `jsonb` array of deed numbers. On PostgreSQL the deed half of `q` is
two index-backed predicates OR-ed together:

```sql
"DeedsJson" @> '["<q>"]'          -- exact deed number
OR "DeedsText" LIKE '%<q>%' ESCAPE '\'   -- partial deed number
```

Both are created by migration **`20260904093334_AddOperationsTaskDeedSearchIndex`** (Operations
stream, raw SQL because the D2 task tables are Operations-owned but still physically named in the
`case_study` schema):

| Object | Why |
| --- | --- |
| `CREATE EXTENSION IF NOT EXISTS pg_trgm` | prerequisite for the trigram index |
| `"DeedsText" text GENERATED ALWAYS AS ("DeedsJson" #>> '{}') STORED` | a text projection of the jsonb array. `#>> '{}'` is immutable (a plain `::text` cast is not), so PostgreSQL accepts it in a generated column, and EF can translate a `LIKE` against a mapped column. Declared as a shadow property with `HasComputedColumnSql(..., stored: true)`, so EF never writes it. |
| `GIN ("DeedsJson" jsonb_path_ops)` — `IX_OperationsTasks_DeedsJson` | accelerates `@>` containment, i.e. the exact-deed-number case |
| `GIN ("DeedsText" gin_trgm_ops)` — `IX_OperationsTasks_DeedsText_Trgm` | accelerates the substring case |

**Why not `jsonb_path_ops` alone, and why not a generated tsvector.** `jsonb_path_ops` only indexes
hashed whole values, so it answers `@>` (element equality) and nothing else — a *partial* deed number
cannot use it. A generated `tsvector` matches whole lexemes, or prefixes with `:*`, but never an
infix, so `q=029844` against deed `310107029844` would miss. The only index shape that serves a
substring on this data is a trigram GIN, which needs a `text` operand — hence the generated column.
`jsonb_path_ops` is kept anyway because it gives the planner a cheap exact-match path, which is the
common case when a user pastes a full deed number.

Escaping: `q` is escaped for both sides — JSON-serialised for `@>`, and `\`, `%`, `_` prefixed with a
backslash for the `LIKE` (passed as the explicit `ESCAPE` character). A user typing `%` matches a
literal percent sign, not every row.

**In-memory provider.** Neither operator exists there, and there is no computed column, so the query
service checks `Database.IsNpgsql()` and falls back to a plain `DeedsJson.Contains(q)` LINQ
substring. Same rows, no index. The SQL path is proved by the container test
`Operations_task_deed_search_executes_against_postgres`.

### Actor narrowing

Unchanged from before this contract, and applied inside the query so counts are the actor's:

- a manager role (`case-specialist`, `section-supervisor`, `general-manager`, `cdo`) sees every task;
- anyone else sees only tasks assigned to their distribution assignee id, or that they created.

### Response

Paged: `PagedResultDto<OperationsTaskDto>`. Unpaged: `OperationsTaskDto[]`.

### Still client-side (operations tasks)

1. **`isOperationsTaskBlockedByFailure`.** The other half of the hidden-by-failure rule needs the
   Failures records and the PO → property mapping (`failureTargetsForOperationsTask` +
   `blockingFailureForProperty`), neither of which is in the Operations database. Only the
   pause-reason half moved (`excludeFailurePaused`). A viewer whose queue hides blocked rows must
   still filter the page it received — so `totalCount` can overstate what that viewer sees.
2. ~~**Deed-number search.**~~ **Retired** — `q` now matches deed numbers server-side (above). The
   screen's `t.deeds.join(" ")` term can be dropped from the client filter.
3. **KPI counters.** `operationsTaskKpis` (active / created / paused / in-progress / completed) is
   computed over the loaded rows; with server paging it needs its own call or a metrics endpoint.
   There is no `/api/operations-tasks/counts` yet — the work-order one (§1.1) is the pattern to copy
   when a screen needs it.
4. **`operationsTasksToResumeAfterFailure`** — the auto-resume sweep the view performs.
5. **`matchesOperationsTaskAssignee`'s display-name fallback.** The server matches an actor by
   distribution assignee id or creator id only; the client's "is this row mine" check also falls back
   to comparing display names.

---

## 4. Comparable properties

**Route:** `GET /api/comparable-properties`
**Item type:** `ComparablePropertyDto`
**Request type:** `ComparablePropertyListQuery` (`Valuation.Application/Contracts/ComparablePropertyDtos.cs`)
**Rules module:** `ComparablePropertyListQueryRules` (`Valuation.Application/Rules/`)
**Use case:** `Valuation.Application/Services/ComparablePropertyService.cs`
**Repository:** `Valuation.Infrastructure/Persistence/ComparablePropertyRepository.cs`
**Screen:** `apps/mfe-valuation/src/views/ComparablePropertiesView.tsx`

### Query parameters

Every pre-existing filter is unchanged. The paging four are new.

| Parameter | Type | Meaning |
| --- | --- | --- |
| `page` | int | **New.** 1-based page. Presence switches to the paged envelope. |
| `pageSize` | int | **New.** Rows per page (clamped). Takes precedence over `take` when paging. |
| `sort` | string | **New.** `transaction` \| `created` \| `price` \| `pricePerSqm` \| `area` \| `district`. |
| `dir` | string | **New.** `asc` \| `desc`. Default `desc`. |
| `take` | int | **Legacy, unchanged.** Row cap for the *unpaged* array (default 100, max 200). Ignored when `page`/`pageSize` is sent. |
| `q` | string | Free text (columns below). **Unchanged.** |
| `district`, `city` | string | Substring match. **Unchanged.** |
| `transactionKind`, `source`, `intakeChannel` | string | Exact match. **Unchanged.** |
| `propertyType` | string | Substring on `ComparablePropertyType`. **Unchanged.** |
| `fromDate`, `toDate` | date | `TransactionDate` range, inclusive. Unparsable values are ignored. **Unchanged.** |
| `includeInactive` | bool | `false` (default) hides `IsActive = false`. **Unchanged.** |
| `forPropertyId` | guid | Comparison-method §2 display priority (below). A blank or unparsable value means "no priority" — never a 400. **Unchanged on the wire.** |

### Sort keys

| `sort` | Column |
| --- | --- |
| `transaction` | `TransactionDate`. **Default** — with `dir=desc` this is the order the endpoint always returned. |
| `created` | `CreatedAtUtc`. |
| `price` | `Price`. |
| `pricePerSqm` | `PricePerSqm`. |
| `area` | `AreaSqm`. |
| `district` | `District`. |

Tiebreakers: `CreatedAtUtc` descending, then `Id`.

### `forPropertyId` and paging

Comparison-method spec §2 wants the subject property's own field comparables first, then any other
field comparable, then the rest of the bank. That ranking **used to be applied in memory after an
over-fetch**, which made a page and a count disagree. It is now an EF `OrderByDescending` over a
`CASE` expression, applied *before* the chosen sort key:

```
2 → SourcePropertyId = <forPropertyId> AND (Source = field OR IntakeChannel = field)
1 → Source = field OR IntakeChannel = field
0 → everything else
```

So the priority survives paging: page 1 holds the subject's field rows whatever `sort` says, and
`totalCount` is exact.

### Filter semantics

**`q`** — a row matches when any of these contains the text: `ReferenceCode`,
`ComparablePropertyType`, `District`, `ListingNumber`, `Description`.

### Response

Paged: `PagedResultDto<ComparablePropertyDto>`. Unpaged: `ComparablePropertyDto[]`.

Both shapes still carry the `duplicateSuspect` advisory, computed per page from the bank's duplicate
coordinate set.

### Still client-side (comparables)

1. **`duplicateSuspect` costs a second query per call.** `DuplicateSuspectCoordsAsync` scans the
   active bank for shared coordinates on every list call. It does not affect the row count, but a
   caller paging quickly through a large bank pays for it each page.
2. **Ranking for the evaluator.** `apps/mfe-evaluator/.../bank-ranking.ts` loads the bank in bulk and
   ranks it against a subject property; that is a different computation from `forPropertyId` and
   stays a bulk (`take`) load.
3. **The map view** (`usePropertyMapWorkflow`) also loads in bulk with `take: 200`. Both bulk callers
   keep working untouched because they send no `page`/`pageSize`.

---

## 5. Failures

**Route:** `GET /api/failures`
**Item type:** `FailureRecordDto`
**Request type:** `FailureListQuery` (`Failures.Application/Contracts/FailureListQuery.cs`)
**Rules module:** `FailureListQueryRules` (`Failures.Application/Rules/`)
**Use case:** `Failures.Application/Services/FailureService.cs`
**Repository:** `Failures.Infrastructure/Persistence/FailureRepository.cs`
**Screens:** `apps/mfe-failures` queue, `apps/mfe-dashboard` counters

### Query parameters

All new — the endpoint took no parameters at all before.

| Parameter | Type | Meaning |
| --- | --- | --- |
| `page` | int | 1-based page. Presence switches to the paged envelope. |
| `pageSize` | int | Rows per page (clamped). |
| `sort` | string | `updated` \| `created` \| `po` \| `deed`. |
| `dir` | string | `asc` \| `desc`. Default `desc`. |
| `q` | string | Free text (columns below). |
| `status` | string | Comma-separated persisted statuses. |
| `poNumber` | string | Exact `PoNumber`. |
| `problemTypeId` | string | Exact `ProblemTypeId`. |

### Sort keys

| `sort` | Column |
| --- | --- |
| `updated` | `UpdatedAtUtc`. **Default** — with `dir=desc` this is the order the endpoint always returned. |
| `created` | `CreatedAtUtc`. |
| `po` | `PoNumber`. |
| `deed` | `DeedNumber`. |

Tiebreaker: `Id`.

### Filter semantics

**`status`** — CSV of `internal`, `review`, `approved`, `returned`, `suspended`, `resolved`.
Unrecognised tokens are dropped; an all-unknown list applies no filter (the queue is never narrowed
to nothing by a typo). Same rule as the workflow-task queue, deliberately *not* the operations-task
"unknown matches nothing" rule — this endpoint had no status filter before, so there is no prior
behaviour to preserve.

**`poNumber` / `problemTypeId`** — trimmed exact matches; blank means no filter.

**`q`** — a row matches when any of these contains the text: `PoNumber`, `DeedNumber`, `Title`,
`Specialist`.

### Visibility

`FailureService.ResolveVisiblePoNumbersAsync` decides the PO set:

- an actor with `FailureRules.SeesEveryFailure` sees every row (no narrowing);
- a null actor, or one with no visibility key, sees nothing — `totalCount: 0`, `items: []`;
- otherwise the actor's PO numbers come from `ICaseStudyLookup.ListPoNumbersByAssigneesAsync` and
  become a `Contains` inside the query, before the count.

Note this is one cross-context call per request, unchanged from before.

### Response

Paged: `PagedResultDto<FailureRecordDto>`. Unpaged: `FailureRecordDto[]`, still capped at 500.

Specialist display names are resolved per page after materialisation (a label lookup, not a filter),
so the page contents and `totalCount` still agree.

### Dispatch route, unchanged

`HttpFailureService.ListAsync` (the Case Study and Operations hosts' client for this route) forwards
the filters and the sort on the query string and lets the upstream re-derive the actor from the
bearer header. The genuinely internal failure lists live on `api/failure-dispatch/*`
(`FailureDispatchController`, `[RequireUpstreamDispatch]`) — those are owner-to-owner routes no
screen pages, and they are **not** part of this contract.

---

## 6. Notifications

**Route:** `GET /api/notifications`
**Item type:** `UserNotificationDto`
**Request type:** `NotificationListQuery` (`RealEstateEval.Application/Contracts/NotificationListQuery.cs`)
**Rules module:** `NotificationListQueryRules` (`Platform.Application/Rules/`)
**Service:** `Platform.Infrastructure/Services/NotificationService.cs`
**Screen:** `apps/shell/src/components/ServerNotificationBridge.tsx` (the bell feed)

### Query parameters

| Parameter | Type | Meaning |
| --- | --- | --- |
| `page` | int | 1-based page. Presence switches to the paged envelope. |
| `pageSize` | int | Rows per page (clamped). |
| `sort` | string | `created` only — the feed has one meaningful order. Any other value resolves to it. |
| `dir` | string | `asc` \| `desc`. Default `desc` (newest first). |
| `q` | string | Free text over `Title` and `Body`. |
| `category` | string | Exact `Category`. |
| `unread` | bool | `true` → unread only (`ReadAtUtc IS NULL`); `false` → read only; omitted → both. |

Tiebreaker: `Id`.

### Visibility

The signed-in user's id (`ActorClaims.Id`) is the first `Where`; an unauthenticated caller gets 401.
`totalCount` is that user's total.

### Response

Paged: `PagedResultDto<UserNotificationDto>`. Unpaged: `UserNotificationDto[]`, still capped at the
feed's own **50** rows (`NotificationService.MaxItemsPerUser`), not the 500 shared cap.

**The SSE stream is untouched.** `GET /api/notifications/stream` keeps its frame format and its 25s
keep-alive; the bell still pairs the two.

**Owner-only.** `PlatformNotificationRequestService` (the write-only facade non-Platform hosts get)
throws `OwnerOnly()` for all three read overloads. This route is only served by the Platform host.

---

## 7. Financial ledgers

Two lists on `FinancialController`, sharing one rules module because their rows have the same shape.

**Rules module:** `FinancialLedgerListQueryRules` (`Financial.Application/Rules/`)
**Request types:** `IncentiveSuspensionListQuery`, `DiscountFlagListQuery`
(`Financial.Application/Contracts/FinancialLedgerListQueries.cs`)
**Services:** `Financial.Infrastructure/Services/IncentiveSuspensionService.cs`,
`Financial.Infrastructure/Services/DiscountFlagService.cs`
**Routes are also served under the `api/financial/v1` alias.**

### 7.1 `GET /api/financial/incentive-suspensions`

| Parameter | Type | Meaning |
| --- | --- | --- |
| `page`, `pageSize` | int | **New.** Paging (clamped). |
| `sort` | string | **New.** `created` \| `transaction`. |
| `dir` | string | **New.** `asc` \| `desc`. Default `desc`. |
| `q` | string | **New.** Free text over `TransactionKey`, `AssigneeId`, `Reason`. |
| `transactionKey` | string | Exact match. **Unchanged.** |
| `assigneeId` | string | Exact match. **Unchanged.** |
| `activeOnly` | bool | Default **`true`** — only suspensions with `LiftedAtUtc IS NULL`. **Unchanged.** |

Item type `IncentiveSuspensionDto`. Unpaged cap 200 (unchanged).

### 7.2 `GET /api/financial/discount-flags`

| Parameter | Type | Meaning |
| --- | --- | --- |
| `page`, `pageSize` | int | **New.** Paging (clamped). |
| `sort` | string | **New.** `created` \| `transaction`. |
| `dir` | string | **New.** `asc` \| `desc`. Default `desc`. |
| `q` | string | **New.** Free text over `TransactionKey`, `TargetAssigneeId`, `Reason`. |
| `transactionKey` | string | Exact match. **Unchanged.** |
| `status` | string | Exact match on `pending` \| `approved` \| `rejected`. **Unchanged** — an unrecognised value simply matches no row. |

Item type `DiscountFlagDto`. Unpaged cap 200 (unchanged).

### Sort keys (both)

| `sort` | Column |
| --- | --- |
| `created` | `CreatedAtUtc`. **Default** — with `dir=desc` this is the order both endpoints always returned. |
| `transaction` | `TransactionKey`, for grouping a PO's entries together. |

Tiebreaker: `Id`.

### Note for the caller

Neither ledger has a front-end consumer today (they are reached through
`CapabilityPolicyNames.ManageOperations` and no screen calls them). They are in the contract because
they are ordinary EF lists whose only cap was a hard-coded `Take(200)`; a future supervisor screen
can page them without a server change.

---

## 8. Endpoints deliberately **not** extended

Each of these was examined and left as a plain array. The reason matters, because it is what would
have to change first.

| Route | Host | Why not |
| --- | --- | --- |
| `GET /api/enfaz-billing/{poNumber}/followups` | Case Study API | A per-PO detail list bounded at 100 rows, rendered whole in a panel. No screen pages it; adding the envelope would be surface with no caller. |
| `GET /api/financial/party-fee-pricing/tables` | Financial API | A pricing **catalogue**, not a ledger: a handful of admin-managed rows, also used as a dropdown source. It additionally returns **400 on an unrecognised `category`** (deliberate — a typo used to silently return another category's tables), which is the opposite of this contract's fall-back rule for `sort`. Left alone rather than blurring the two behaviours. |
| `GET /api/failure-dispatch/*` (`gates`, `approved-keys`, `property`, `suspended`, `active-ids`) | Failures API | **Owner-to-owner dispatch routes** (`[RequireUpstreamDispatch]`), called by other backend hosts, never paged by a screen. Skipped, as the brief allows. |
| `GET /api/case-study-forms/batch?parentTaskIds=a,b,…` | Case Study API | **A decorator for a row window the caller already holds**, not a list of its own: the active queue passes the parent ids of the rows it is rendering and gets back, per parent, the case-study form plus the party forms of its children keyed by child task id (`CaseStudyFormBatchDto`). Capped at 100 distinct ids (400 above it); the client chunks. Visibility is the single-item rule (`CaseStudyFormReadRules`) applied per parent and per child, and a hidden or unknown id is absent rather than an error, so the batch cannot probe. Replaces the `1 + N` single GETs per row — see `property-detail-fanout-2026-09-04.md`. |
| `GET /api/financial-dispatch/*` other than the four billing lists of §9–§10 | Financial API | Internal mirrors of single-item and write routes; nothing to page. The four list mirrors **do** carry the envelope — see "Dispatch route" under §9 and §10. |

The party billing statement list, its ready lines and the two Enfaz billing lists used to sit in
this table (a two-hop envelope change, and rows synthesised in memory). They are now §9 and §10;
the "materialised list" rule those sections introduce is how the synthesised lists keep the
Filtering invariant.

---

## 9. Party billing statements

Two lists on `PartyBillingStatementsController` (Case Study host, alias route
`api/eng-billing-statements`). The Case Study host holds only `HttpPartyBillingStatementService`,
an HTTP passthrough to `api/financial-dispatch/party-billing-statements` on the Financial host,
so the contract is served in two hops — the same parameters go upstream and the same envelope
comes back.

**Request types:** `PartyBillingStatementListQuery`, `PartyBillingReadyLineListQuery`
(`RealEstateEval.Application/Contracts/BillingListQueries.cs` — the shared assembly, because the
Case Study host forwards them)
**Rules modules:** `PartyBillingStatementListQueryRules`, `PartyBillingReadyLineListQueryRules`,
`MaterialisedListPage` (`Financial.Application/Rules/`)
**Use case:** `Financial.Application/Services/PartyBillingStatementService.Lists.cs`
**Repository:** `Financial.Infrastructure/Persistence/PartyBillingStatementRepository.cs`
(`ListStatementsAsync` / `CountStatementsAsync` over `PartyBillingStatementListFilterQuery`)
**Remote client:** `Shared.RemoteClients/HttpPartyBillingStatementService.cs`
**Screens:** `apps/mfe-financial` — the payee account's «المستحقات» / «مسيرات وأوامر صرف» /
«مدفوعة» tabs (`usePartyBillingStatementsWorkflow`)

### The materialised-list rule (new, shared with §10)

A list whose rows are **synthesised** — composed from cross-context reads and then filtered in
memory — cannot count in SQL. Instead of dropping the envelope, the use case builds the full row
set exactly as the plain array always did, applies the contract's `q` and `sort` over that list
(the rules module does both, so they are unit-tested), and then cuts `skip`/`take` from it with
`MaterialisedListPage.Cut`. `totalCount` is the length of the list the page was cut from, so a page
and its count always agree — the Filtering invariant holds, at the cost of the full synthesis on
every call. The unpaged array keeps its historical cap; the paged envelope counts past it.

### 9.1 `GET /api/party-billing-statements`

Counted and cut **in the database** — this one is an ordinary EF list.

| Parameter | Type | Meaning |
| --- | --- | --- |
| `page`, `pageSize` | int | **New.** Paging (clamped). |
| `sort` | string | **New.** `created` \| `issued` \| `closed` \| `reference` \| `total`. |
| `dir` | string | **New.** `asc` \| `desc`. Default `desc`. |
| `q` | string | **New.** Free text over `ReferenceNumber`, `VendorInvoiceNumber`, `DisbursementVoucher`, `TransferReference`. |
| `assigneeId` | string | Exact payee. **Unchanged.** |
| `status` | string | **Widened to CSV** of `draft`, `issued`, `invoice_received`, `closed`, `cancelled`. A single value is the exact match it always was. Unknown tokens are dropped; **an all-unknown value still matches no row** (the endpoint's historical answer to a typo — a bad value must never widen a payee's view). Blank = no filter. |
| `issuedOrLaterOnly` | bool | `issued` / `invoice_received` / `closed` only. **Unchanged.** |

| `sort` | Column |
| --- | --- |
| `created` | `CreatedAtUtc`. **Default** — with `dir=desc` the order the endpoint always returned. |
| `issued` | `IssuedAtUtc`. |
| `closed` | `ClosedAtUtc`. |
| `reference` | `ReferenceNumber`. |
| `total` | `TotalNetSar`. |

Tiebreaker: `Id`.

**Visibility.** Unchanged, and now folded into the query *before* it is forwarded
(`NarrowStatementList` in the controller): an office actor is forced onto its own `assigneeId`
with `issuedOrLaterOnly=true` (403 when it has no assignee id at all); an operations manager who
is not finance gets `issuedOrLaterOnly=true`; finance gets what it asked for. Because the
narrowing is part of the filter, `totalCount` is the actor's.

**Item.** `PartyBillingStatementDto`, lines included per page (one lines query for the page's ids).
Unpaged cap 500 (unchanged).

**New companion route.** `GET /api/party-billing-statements/{statementId}` returns one statement
under the same visibility rule (404 for a payee's unissued or foreign statement). A screen that
pages needs it to open a deep-linked statement that is not on the page it shows.

### 9.2 `GET /api/party-billing-statements/ready-lines`

A **materialised list** (rule above): the ledgers minus claimed line keys, one per task, plus open
court-visit charges — synthesised exactly as before, then searched, sorted and cut.

| Parameter | Type | Meaning |
| --- | --- | --- |
| `page`, `pageSize` | int | **New.** Paging (clamped) over the materialised list. |
| `sort` | string | **New.** `updated` \| `accrued` \| `net` \| `po`. |
| `dir` | string | **New.** `asc` \| `desc`. Default `desc`. |
| `q` | string | **New.** Free text over `PropertyLabel`, `PoNumber`, `WorkflowTaskId` (case-insensitive) — the dues screen's haystack. |
| `assigneeId` | string | Exact payee. **Unchanged.** |

| `sort` | Order |
| --- | --- |
| `updated` | `UpdatedAtUtc ?? AccruedAtUtc`. **Default** — with `dir=desc` this is `OrderReadyLines`, the order the endpoint always returned. |
| `accrued` | `AccruedAtUtc ?? UpdatedAtUtc`. `dir=asc` is the dues screen's oldest-first order. |
| `net` | `NetFeeSar`. |
| `po` | `PoNumber`. |

Tiebreakers: `PropertyLabel` then `WorkflowTaskId`, ordinal.

Item `PartyBillingReadyLineDto`. Unpaged cap 500 (unchanged). Requires `ManageFinancial`.

### Dispatch route (both lists)

`api/financial-dispatch/party-billing-statements` and `…/ready-lines` on the Financial host accept
the identical parameter set and apply the identical envelope rule — the "billing-statements
dispatch envelope" gap is closed. The Financial host re-resolves the page window from its own
`Database` options (the same clamp), so the skip/take the Case Study host computed are
informational; the remote client sends `page`/`pageSize` only when the caller paged.

### Still client-side (party billing)

1. **The payees list** («المستحقون المسجّلون لدى المالية», `FinanceCostPartiesList`) is an aggregate:
   one row per payee summing every ready line and every statement of that payee. There is no
   group-by-payee endpoint, so it loads both lists whole and windows the aggregate client-side with
   the shared pager. The account header and tab badges (`FinanceCostsView`) read the same whole
   lists for the same reason.
2. **The selection total** on the dues tab sums lines ticked across pages; the workflow keeps the
   net of every ticked id alongside the id set, since an earlier page's rows are gone.

---

## 10. Enfaz billing

Two lists on `EnfazBillingController` (Case Study host), each a **materialised list** (§9 rule):
both start from `ICaseStudyLookup.ListWorkOrdersForBillingAsync` (newest work order first, capped at
500 orders) and expand per property. Served in two hops through `HttpPoEnfazBillingService` →
`api/financial-dispatch/enfaz-billing/*`, same envelope both ends.

**Request types:** `EnfazReadyPoListQuery`, `EnfazTrackingListQuery`
(`RealEstateEval.Application/Contracts/BillingListQueries.cs`)
**Rules modules:** `EnfazReadyPoListQueryRules`, `EnfazTrackingListQueryRules`
(`Financial.Application/Rules/`)
**Use case:** `Financial.Application/Services/PoEnfazBillingService.Lists.cs`
**Screens:** `apps/mfe-financial` — the Enfaz billing side list (`FinanceEnfazReadyPoList`); the
revenue stages read `tracking` whole (below)

### 10.1 `GET /api/enfaz-billing/ready-pos-summary`

| Parameter | Type | Meaning |
| --- | --- | --- |
| `page`, `pageSize` | int | **New.** Paging (clamped) over the readiness scan. |
| `sort` | string | **New.** `created` \| `po`. |
| `dir` | string | **New.** `asc` \| `desc`. Default `desc`. |
| `q` | string | **New.** Free text over `PoNumber`. |

| `sort` | Order |
| --- | --- |
| `created` | **Default.** The scan's own order — work orders newest first. The DTO carries no date, so `dir=asc` simply reverses the scan. |
| `po` | `PoNumber`, ordinal. |

Item `EnfazReadyPoSummaryDto`. Requires `ReadFinancialData`.

### 10.2 `GET /api/enfaz-billing/tracking`

| Parameter | Type | Meaning |
| --- | --- | --- |
| `page`, `pageSize` | int | **New.** Paging (clamped) over the materialised rows. |
| `sort` | string | **New.** `created` \| `po` \| `completed` \| `invoiceIssued`. |
| `dir` | string | **New.** `asc` \| `desc`. Default `desc`. |
| `q` | string | **New.** Free text over `PoNumber`, `DeedNumber`, `PropertyLabel`, `City`, `InvoiceNumber`. |

| `sort` | Order |
| --- | --- |
| `created` | **Default.** The scan's order — newest work order first, properties in request/deed order inside it. `dir=asc` reverses the scan. |
| `po` | `PoNumber`. |
| `completed` | `CompletedAtUtc` (null sorts as min). |
| `invoiceIssued` | `InvoiceIssuedAtUtc` (null sorts as min). |

Tiebreakers on the explicit sorts: `PoNumber` then `PropertyId`, ordinal.

Item `EnfazTrackingRowDto`. Unpaged cap **2000** (unchanged); the paged envelope counts past it.

### Still client-side (Enfaz)

1. **The revenue stages** (`FinanceRevenueView`) keep loading `tracking` whole: the stage tabs are
   client-side buckets (`bucketRevenueRows`) whose badges count every row, the study table shows
   «X of Y» properties per work order from its siblings, and the collection table groups rows by
   invoice. A server page would cut across those groups. Moving the stage rule server-side is what
   would have to change first.
2. **Aging** (`GET /api/enfaz-billing/aging`) is a report, not a list; untouched.

---

## Verification

- `cd backend && dotnet build RealEstateEval.slnx -nologo -v q` — clean.
- `dotnet test RealEstateEval.Application.Tests/...` — the rules modules
  (`WorkOrderListQueryRulesTests`, `WorkflowTaskListQueryRulesTests`,
  `OperationsTaskListQueryRulesTests`, `ComparablePropertyListQueryRulesTests`,
  `FailureListQueryRulesTests`, `NotificationListQueryRulesTests`,
  `FinancialLedgerListQueryRulesTests`, `OperationsTaskDeedSearchTests`, and for §9–§10
  `PartyBillingStatementListQueryRulesTests`, `PartyBillingReadyLineListQueryRulesTests`,
  `EnfazBillingReadyPoListQueryRulesTests`, `EnfazBillingTrackingListQueryRulesTests`,
  `MaterialisedListPageTests` in `BillingListQueryRulesTests.cs`) and the query services over
  the in-memory provider (`WorkOrderListQueryTests`, `WorkOrderListCountsTests`,
  `WorkflowTaskListQueryTests`, `WorkflowTaskListPoRecordTests`, `OperationsTaskListQueryTests`,
  `ComparablePropertyListQueryTests`, `FailureListQueryTests`, `NotificationListQueryTests`,
  `FinancialLedgerListQueryTests`).
- `dotnet test RealEstateEval.Architecture.Tests/...` — `ListPagingSafetyTests`,
  `RepositoryBoundaryTests`, `CaseStudySessionFacadeTests`, `InfrastructureServiceSizeTests`,
  `MigrationStreamTests` and `TimeProviderUsageTests` all still green: the request types are plain
  records in `Application/Contracts`, the allow-lists are pure modules in `Application/Rules`, EF
  stays inside the query services and repositories, the new migration belongs to the Operations
  stream, and the counts endpoint takes its clock from an injected `TimeProvider`.
- `dotnet test RealEstateEval.Api.IntegrationTests/...`
- `dotnet test RealEstateEval.Api.ContainerTests/...` (needs Docker) — every filter and sort of every
  endpoint above is exercised against Postgres, including the jsonb deed search, which has no
  in-memory equivalent.
- The Operations migration is applied with
  `dotnet run --project backend/tools/DbMigrate -- update` and the nine
  `REAL_ESTATE_EVAL_PG_CONNECTION_STRING_{SERVICE}` environment variables.
