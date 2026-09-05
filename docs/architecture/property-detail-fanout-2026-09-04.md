# Property detail request fan-out — 2026-09-04

Measured against the running dev stack (http://127.0.0.1:3000 shell, http://127.0.0.1:5160 gateway) as `osama@ejadah.dev` (case specialist), 3 runs, fresh browser context per run so the TanStack cache and HTTP cache start cold. Driver: `e2e/.measure-property-detail.mjs`. Raw data: `property-detail-fanout-2026-09-04.json`.

Fixture: PO `036680`, property `1fcdff4b-28c3-4602-a67a-21e9531f0393`.

## Initial page loads

### PO property detail — `/po/{po}/property/{id}`

| Metric | Median | Per run |
| --- | ---: | --- |
| Total `/api/` requests | **88** | 88, 85, 89 |
| Distinct endpoints (method + templated path) | 24 | |
| Total response bytes | 11.98 MB | |

**Requests by upstream service** (gateway proxies; classified by the YARP route table)

| Service | Port | Median requests |
| --- | ---: | ---: |
| `attachments` | 5169 | 52 |
| `case-study` | 5162 | 23 |
| `platform` | 5168 | 5 |
| `failures` | 5167 | 3 |
| `operations` | 5163 | 3 |
| `identity` | 5161 | 2 |
| `reporting` | 5164 | 1 |

**Slowest three endpoints** (median across all runs)

| Endpoint | Service | Median ms | Median bytes | Observations |
| --- | --- | ---: | ---: | ---: |
| `GET /api/party-task-submissions/{id}` | case-study | 439 | 1.8 KB | 27 |
| `GET /api/key-envelopes/gate` | operations | 277 | 275 B | 3 |
| `GET /api/attachments` | attachments | 245 | 21 B | 48 |

### Active transactions queue — `/active-case-study`

| Metric | Median | Per run |
| --- | ---: | --- |
| Total `/api/` requests | **56** | 56, 56, 53 |
| Distinct endpoints (method + templated path) | 17 | |
| Total response bytes | 85.7 KB | |

**Requests by upstream service** (gateway proxies; classified by the YARP route table)

| Service | Port | Median requests |
| --- | ---: | ---: |
| `case-study` | 5162 | 45 |
| `platform` | 5168 | 5 |
| `failures` | 5167 | 3 |
| `identity` | 5161 | 2 |
| `reporting` | 5164 | 1 |

**Slowest three endpoints** (median across all runs)

| Endpoint | Service | Median ms | Median bytes | Observations |
| --- | --- | ---: | ---: | ---: |
| `GET /api/case-study-forms/party/{id}` | case-study | 399 | 396 B | 81 |
| `GET /api/case-study-forms/{id}` | case-study | 320 | 393 B | 27 |
| `GET /api/inspector-fees` | case-study | 256 | 122 B | 3 |

### PO list — `/po`

| Metric | Median | Per run |
| --- | ---: | --- |
| Total `/api/` requests | **27** | 23, 27, 28 |
| Distinct endpoints (method + templated path) | 18 | |
| Total response bytes | 75.1 KB | |

**Requests by upstream service** (gateway proxies; classified by the YARP route table)

| Service | Port | Median requests |
| --- | ---: | ---: |
| `case-study` | 5162 | 17 |
| `platform` | 5168 | 4 |
| `failures` | 5167 | 3 |
| `identity` | 5161 | 2 |
| `reporting` | 5164 | 1 |

**Slowest three endpoints** (median across all runs)

| Endpoint | Service | Median ms | Median bytes | Observations |
| --- | --- | ---: | ---: | ---: |
| `GET /api/users/distribution-assignees` | identity | 259 | 4.3 KB | 3 |
| `GET /api/inspector-fees` | case-study | 259 | 127 B | 3 |
| `POST /api/workflow-tasks/sync` | case-study | 198 | 21 B | 3 |

## Property detail: repeated calls on the initial load

Every `/api/` call the initial load makes, grouped by method + templated path, summed over all 3 runs (so divide by 3 for a per-load figure).

| Calls (all runs) | Per load | Method | Endpoint | Service | Bytes (all runs) |
| ---: | ---: | --- | --- | --- | ---: |
| 107 | 35.7 | `GET` | `/api/attachments/{id}` | attachments | 35.65 MB |
| 48 | 16.0 | `GET` | `/api/attachments` | attachments | 2.3 KB |
| 27 | 9.0 | `GET` | `/api/party-task-submissions/{id}` | case-study | 55.8 KB |
| 9 | 3.0 | `GET` | `/api/notifications` | platform | 41.4 KB |
| 6 | 2.0 | `GET` | `/api/inspector-fees` | case-study | 757 B |
| 5 | 1.7 | `GET` | `/api/workflow-tasks` | case-study | 36.1 KB |
| 5 | 1.7 | `GET` | `/api/failures` | failures | 80 B |
| 5 | 1.7 | `GET` | `/api/work-orders/properties/pending-bourse` | case-study | 95 B |
| 5 | 1.7 | `GET` | `/api/operations-tasks` | operations | 80 B |
| 3 | 1.0 | `GET` | `/api/organization-settings` | platform | 21.6 KB |
| 3 | 1.0 | `GET` | `/api/permissions` | identity | 1.3 KB |
| 3 | 1.0 | `GET` | `/api/work-orders/details` | case-study | 55.2 KB |
| 3 | 1.0 | `GET` | `/api/work-orders` | case-study | 3.5 KB |
| 3 | 1.0 | `GET` | `/api/work-orders/property-rows` | case-study | 3.9 KB |
| 3 | 1.0 | `GET` | `/api/work-orders/{n}` | case-study | 4.8 KB |
| 3 | 1.0 | `POST` | `/api/workflow-tasks/sync` | case-study | 58 B |
| 3 | 1.0 | `GET` | `/api/users/distribution-assignees` | identity | 12.8 KB |
| 3 | 1.0 | `GET` | `/api/work-orders/{n}/properties/{id}/timeline` | case-study | 2.5 KB |
| 3 | 1.0 | `GET` | `/api/case-study-forms/{id}` | case-study | 1.2 KB |
| 3 | 1.0 | `GET` | `/api/case-study-forms/party/{id}` | case-study | 1.1 KB |
| 3 | 1.0 | `GET` | `/api/case-study-info-roles` | platform | 1.1 KB |
| 3 | 1.0 | `GET` | `/api/key-envelopes/gate` | operations | 820 B |
| 3 | 1.0 | `GET` | `/api/failure-types-catalog` | failures | 3.0 KB |
| 3 | 1.0 | `GET` | `/api/reporting/v1/dashboard` | reporting | 3.3 KB |

## The duplicate-blob finding

`GET /api/attachments/{id}` is not a metadata call — it is `downloadAttachmentBlob`, which streams the **whole file**. On the initial load the property detail page downloads every document and inspection photo at full size to build data-URL previews, and it downloads a large share of them more than once.

| Metric | Median | Per run |
| --- | ---: | --- |
| Blob downloads (`GET /api/attachments/{id}`) | **36** | 35, 36, 36 |
| Distinct blob ids among them | 19 | 19, 19, 19 |
| Redundant downloads | **17 (47% wasted)** | |
| Bytes over the wire for blobs | 11.90 MB | |

The 16 `GET /api/attachments` metadata calls per load are one per document scope, issued by `prefetchPropertyDocAttachments` (`assignment-doc-attachments.ts`), which fires seven `hydrateKindFromApi` calls in parallel — one per `PropertyDocKind`:

```
scope=evaluator-report&scopeKey=62fb83e7-5ff5-45b9-859c-461f99aab392
scope=property-boundaries&scopeKey=036680%3A1fcdff4b-28c3-4602-a67a-21e9531f0393
scope=property-bourse-deed&scopeKey=036680%3A1fcdff4b-28c3-4602-a67a-21e9531f0393
scope=property-decree&scopeKey=036680%3A1fcdff4b-28c3-4602-a67a-21e9531f0393
scope=property-deed-ownership&scopeKey=036680%3A1fcdff4b-28c3-4602-a67a-21e9531f0393
scope=property-delegation&scopeKey=036680%3A1fcdff4b-28c3-4602-a67a-21e9531f0393
scope=property-other&scopeKey=036680%3A1fcdff4b-28c3-4602-a67a-21e9531f0393
scope=property-registry&scopeKey=036680%3A1fcdff4b-28c3-4602-a67a-21e9531f0393
```

## Added requests per tab

Tabs clicked in catalog order on the already-loaded page, so these are *additional* requests on top of the initial load. A tab that renders from data the initial load already fetched adds nothing.

The live queues poll on a 30 s timer (`LIVE_QUEUE_POLL_INTERVAL_MS`), so the raw *added* column drifts between runs depending on which tab was open when the timer fired. The **new endpoints** column counts only requests to a `method + path` this run had not issued before, which is the stable signal for what the tab itself needs.

| # | Tab id | Label | Median added | Per run | New endpoints (median) | Median bytes |
| ---: | --- | --- | ---: | --- | ---: | ---: |
| 1 | `basic` | البيانات الأساسية | 0 | 0, 1, 0 | 0 | 0 B |
| 2 | `documents` | مستندات العقار | 1 | 5, 1, 1 | 0 | 5.9 KB |
| 3 | `linked` | العقارات المرتبطة | 7 | 7, 13, 7 | 4 | 6.8 KB |
| 4 | `survey` | التقرير المساحي | 2 | 5, 1, 2 | 0 | 5.9 KB |
| 5 | `inspection` | معاينة العقار | 7 | 7, 7, 7 | 5 | 47.0 KB |
| 6 | `photos` | صور العقار | 5 | 5, 5, 1 | 0 | 10.8 KB |
| 7 | `government` | المراجعات الحكومية | 2 | 2, 1, 2 | 0 | 5.0 KB |
| 8 | `keys` | مفاتيح العقار | 3 | 1, 6, 3 | 0 | 6.1 KB |
| 9 | `appraisal` | تقييم العقار | 1 | 1, 2, 1 | 1 | 0 B |
| 10 | `failures` | التعذرات | 0 | 0, 0, 0 | 0 | 0 B |
| 11 | `report` | دراسة العقار | 2 | 2, 2, 3 | 0 | 831 B |
| 12 | `enfath-upload` | الرفع على انفاذ | 0 | 0, 0, 0 | 0 | 0 B |
| 13 | `finance` | المالية | 2 | 2, 2, 2 | 1 | 222 B |
| 14 | `log` | السجل والتدقيق | 0 | 0, 0, 0 | 0 | 0 B |
| 15 | `survey-notes` | ملاحظات | 0 | 0, 0, 0 | 0 | 0 B |

**Total across all tabs (median): 32 additional requests, of which 11 go to endpoints the initial load had not already called.** Initial load 88 + tabs 32 = **120 requests** to fully exercise one property detail page.

Tabs that add nothing at all are the tell: the initial load has already fetched their data, so the page front-loads all fifteen tabs before the user opens any of them.

### Endpoints first introduced by a tab

| Tab | Endpoints not already called by the initial load |
| --- | --- |
| `linked` | `GET /api/property-groups/by-property/{id}`<br>`GET /api/work-orders/deeds/prior/history` |
| `inspection` | `GET /api/property-comparable-links`<br>`GET /api/valuation-lists` |
| `government` | `GET /api/notifications/stream` |
| `keys` | `GET /api/notifications/stream` |
| `appraisal` | `GET /api/notifications/stream`<br>`GET /api/valuation-requests/open-by-property/{id}` |
| `finance` | `GET /api/enfaz-billing/{n}/properties/{id}` |

### Slowest endpoints introduced by tabs

| Tab | Endpoint | Service | Median ms |
| --- | --- | --- | ---: |
| `keys` | `GET /api/workflow-tasks` | case-study | 223 |
| `keys` | `GET /api/operations-tasks` | operations | 216 |
| `photos` | `GET /api/failures` | failures | 115 |
| `photos` | `GET /api/work-orders/properties/pending-bourse` | case-study | 106 |
| `linked` | `GET /api/property-groups/by-property/{id}` | case-study | 95 |
| `linked` | `GET /api/work-orders/deeds/prior/history` | case-study | 87 |
| `documents` | `GET /api/work-orders/properties/pending-bourse` | case-study | 68 |
| `documents` | `GET /api/operations-tasks` | operations | 67 |

## The active queue's per-row N+1

`useActiveTransactionQueueWorkflow.ts:773-774` maps over every listed row and calls
`loadPartyCaseStudyAnswersByParty(parent, tasks)`. That function
(`case-study-party-progress.ts:154-160`) issues **one `GET /api/case-study-forms/{parentId}`
plus one `GET /api/case-study-forms/party/{childId}` per non-`specA` child**. The queue is the
`case-study` table layout (`ActiveCaseStudyView.tsx:49` → `showPartyColumns: true`), so the
effect is live on `/active-case-study`.

Measured, identically in all three runs:

| | Distinct ids | Requests issued | Times each id was fetched |
| --- | ---: | ---: | ---: |
| `GET /api/case-study-forms/{id}` (parent) | 3 | 9 | 3× |
| `GET /api/case-study-forms/party/{id}` (child) | 9 | 27 | 3× |
| **Total** | **12** | **36 of 56 requests (64%)** | |

So the cost is **4 distinct requests per row** (1 parent + 3 party children), and because the
effect re-runs three times per load — its dependency list includes `tasks` and
`infoRolesMatrix`, both of which change identity as the page settles — the observed cost is
**12 requests per row**. Three rows produce 36 requests.

This is the part that does not survive growth. The queue deliberately keeps the full row list
rather than a server row window (`solid-scorecard.md`, pagination slice: the case-study table
reads a parent's children, so it is one of the "still client-side" tables). At the 16
case-study rows already in this database the same code path would issue roughly
16 × 4 × 3 ≈ 190 requests for the progress columns alone.

### Fix: one batch read per listed page

Shipped 2026-09-04, both halves of the N+1 removed:

- **Backend** — `GET /api/case-study-forms/batch?parentTaskIds=<guid>,<guid>` (cap 100 distinct
  ids, 400 above it) returns `CaseStudyFormBatchDto { byParentTaskId: { [parentId]:
  { parentTaskId, parent: CaseStudyFormDto, partyFormsByChildTaskId: { [childId]:
  CaseStudyFormDto } } } }`. Use case `CaseStudyFormBatchReadService` (Application/Services)
  over a narrow port `ICaseStudyFormBatchQuery` (two set reads: the parents with their
  children and grandchildren, then the forms) with the EF adapter
  `CaseStudyFormBatchQueryService` (Infrastructure/Persistence). The read gate is the one
  the two single-item GETs apply — extracted to `CaseStudyFormReadRules` so both paths share
  it — evaluated per parent and again per child, and a hidden or unknown id is simply absent,
  so the batch cannot probe. Entity → DTO projection moved to `CaseStudyFormMapping` so the
  batch and the single reads return the same shape. Listed in `pagination-contract.md` §8 as
  a deliberately not-paged decorator. Unit tests: `CaseStudyFormBatchReadTests` (fake port
  for the gate / dedupe / cap, plus an in-memory EF row-for-row parity check against
  `CaseStudyFormService.GetAsync`).
- **Frontend** — `getCaseStudyFormsBatch` (`@platform/api-client`),
  `loadCaseStudyFormDraftsForParents` (chunks at the cap) and the pure
  `partyCaseStudyAnswersFromBatch` / `loadPartyCaseStudyAnswersForParents` in
  `case-study-party-progress.ts`. `useQueuePartyProgress` now holds a TanStack
  `useCaseStudyFormBatchQuery` keyed on the sorted parent id set (`listedTaskIdsKey`) with the
  queue's 60 s `staleTime` and `keepPreviousData`, and folds the batch onto the per-row `pct`
  in a `useMemo` — so a fresh `tasks` array or `infoRolesMatrix` identity re-folds in memory
  and never refetches. `PARTY_CASE_STUDY_FORM_CHANGED_EVENT` invalidates
  `appDataKeys.caseStudyFormBatches()`. The single-item loaders stay for the form editors.
  Expected cost for the progress columns: **1 request per page of up to 100 rows** instead
  of `rows × 4 × 3`.

**After** (case-study service rebuilt, same driver, cold load of the queue, 2026-09-04):

| Queue cold load | Before | After |
| --- | ---: | ---: |
| `/api/` requests | 56 | **20** |
| Distinct endpoints | 17 | 17 |
| `GET /api/case-study-forms/{id}` + `/party/{id}` | 36 | **0** |
| `GET /api/case-study-forms/batch` | 0 | **1** |
| Response bytes | 86 KB | 278 KB (the batch carries every listed form in one body) |

The remaining 20 are the queue's own reads (work orders, workflow tasks, property rows,
party submissions, assignees, info roles, failures, fees, notifications ×3). The
`3 × per-row` repetition is gone with the effect: a fresh `tasks` array re-folds in memory.
Measured with `e2e/.measure-property-detail.mjs` (now logging in with the passwordless mobile).

## Method and caveats

- Driver: `e2e/.measure-property-detail.mjs`. Login is the API + `sessionStorage` seed from
  `e2e/fixtures/auth.ts` plus the `ree-auth` cookie; a fresh browser context per run gives a
  cold TanStack cache and a cold HTTP cache.
- Only `xhr`/`fetch` requests whose path starts with `/api/` are counted. Upstream service is
  derived from the YARP route table in
  `backend/gateway/RealEstateEval.Gateway/appsettings.json` (the `case-study` cluster is the
  `Order: 100` catch-all), not observed directly — the gateway is the only host the browser
  talks to.
- Durations are `request.timing().responseEnd`; sizes are `request.sizes().responseBodySize`.
  These are **dev-server** numbers (Next dev, no production build, debug backends) and are
  useful for comparing endpoints against each other, not as production latency.
- **Dataset caveat.** A concurrent agent was running Playwright journeys against the same
  stack throughout. Work orders grew from 2 to 27 and workflow tasks from 16 to 33 during the
  session. The property detail figures are stable across runs because they are scoped to one
  fixture property, but the **PO list and active queue figures are dataset-dependent** and
  should be read as a shape, not a constant. An earlier attempt auto-discovered an `E2E-`
  seeded PO with no documents and measured 65 requests / 35 KB for the same page; the driver
  now filters `E2E-` POs and the fixture is pinned.
- Per-tab counts are noisy because the live queues poll on a 30 s timer
  (`LIVE_QUEUE_POLL_INTERVAL_MS`); the "new endpoints" column is the stable signal.
- Tabs were exercised by clicking, not by URL navigation, so the page kept its warm cache —
  which is why most tabs add nothing.

## Reading: does this justify a BFF or GraphQL layer?

**Against the brief's thresholds, the page trips the request-count trigger and misses the
latency one.** The property detail page issues a median of **88 `/api/` requests** on a cold
load — about fifteen times the "six or more requests" line — and 120 once every tab has been
opened. But the slowest endpoint is `GET /api/party-task-submissions/{id}` at a **439 ms**
median, with the next two at 277 ms and 245 ms; nothing is slow enough that collapsing round
trips is where the time goes. The shape matters more than the count: those 88 requests come
from only **24 distinct endpoints**, and **52 of them (59%) hit a single service**,
`attachments` on 5169. This is not a view that needs many different things from many services
and cannot ask for them in one trip — the classic case a BFF answers. It is one view asking
the same two endpoints over and over, and asking for data belonging to tabs the user has not
opened. `usePropertyDetailDocuments` (`property-detail-documents-query.ts:76-95`) runs on
mount with no `enabled` gate from `usePoPropertyDetailTabsWorkflow.ts:190`, eagerly pulling
document scopes, the survey package, the evaluator report and every inspection photo; that is
why `documents`, `photos`, `survey`, `report`, `log` and `survey-notes` each add nothing when
clicked. Worse, `GET /api/attachments/{id}` is `downloadAttachmentBlob` — the whole file — and
the page fetches **19 distinct blobs 36 times, 47% of them redundant, for 11.9 MB** on a page
whose visible content is a form. A BFF placed in front of this would inherit the duplication
and still move 11.9 MB; it would hide the defect rather than remove it. **Recommendation: do
not add a BFF or GraphQL layer for this page.** It should be noted plainly that neither the
"six or more requests" rule nor any slowest-endpoint latency rule currently appears in
`docs/architecture/solid-scorecard.md` — there is no mention of BFF, GraphQL, or request
fan-out anywhere under `docs/architecture/`. These thresholds came from the measurement brief,
so if they are to govern, they need to be written into the scorecard first.

**The single endpoint change that removes the most requests is to make
`GET /api/attachments/for-property?propertyId=…` the one call the page makes for property
media, extended to carry a bounded preview.** That endpoint already exists
(`AttachmentsController.cs:99`) and already returns `Scope` and `ScopeKey` on every row
(`AttachmentDtos.cs:5-15`), so the client can group by scope with no backend change at all.
Adopting it as-is inside `prefetchPropertyDocAttachments`
(`assignment-doc-attachments.ts:513-536`, which today fires seven parallel `hydrateKindFromApi`
calls, one per `PropertyDocKind`) collapses **16 metadata calls into 1, removing 15 requests
per load for free**. Extending the same response with a thumbnail or preview URL per row, so
`hydrateOneMeta` and `prefetchInspectorWorkspacePhotos` stop calling `downloadAttachmentBlob`
for previews, removes the other **36 blob downloads** as well — **51 of 88 requests (58%) and
essentially all of the 11.9 MB**, in one endpoint. Two cheaper fixes should land alongside it
and need no endpoint work: pass `enabled` from the tabs workflow so the prefetch follows the
active tab instead of front-loading all fifteen, and de-duplicate in-flight blob requests by
attachment id, which alone would cut 17 of the 36 downloads. If only one thing is done, do the
`for-property` swap — it is the largest reduction available and costs nothing on the server.

## After — documents gated, blobs de-duplicated, one list call, overview photo kept (2026-09-04, later the same day)

Same driver, same fixture (PO `036680`, property `1fcdff4b-28c3-4602-a67a-21e9531f0393`), same user, 3 runs with a fresh browser context each. Raw data: `property-detail-fanout-2026-09-04-after.json` (the three runs were driven as three `RUNS=1` invocations and merged with the driver's own aggregation, so the medians are computed the same way as the "before" file). Frontend only — no backend change, no thumbnail endpoint.

### What changed

| Change | Where |
| --- | --- |
| Documents / photos load only once a tab that shows them has been opened (`documents`, `photos`, `enfath-upload`); passed as `enabled` to `usePropertyDetailDocuments`. Visited tabs stay mounted, so the flag never flips back and the tab's UX is unchanged. | `apps/mfe-case-study/src/components/po-intake/usePoPropertyDetailTabsWorkflow.ts` |
| The overview (`basic`) tab keeps its primary photo on a cold load through a primary-photo-only path: the `for-property` metadata list (1 request), the inspector workspace read when an inspection task exists (shared with the party-submissions query, so 0 extra on this page), and exactly one blob for the entry `pickPrimaryPropertyDetailPhoto` would pick — same preference (`رئيس`/`main`/`primary` by name, else the first image) over the same candidate order (intake, then inspection), restricted to entries that can actually be hydrated. Metadata and blob land in the caches the full prefetch reads, so a media tab opened later reuses them. | `apps/mfe-case-study/src/query/property-primary-photo-query.ts` (new), `lib/app-data/property-detail-documents.ts` (`collectPrimaryPhotoCandidates`, `inspectionPhoto` ref on inspection entries), `assignment-doc-attachments.ts` (`primePropertyDocMetadata`, `hydrateCachedPropertyDocPreview`) |
| One `GET /api/attachments/{id}` per attachment id per page load: in-flight promise shared between concurrent callers, successful result kept fresh for 10 min (the non-hook equivalent of one shared query key + `staleTime`). Used by the intake-document, inspector-photo and task-attachment preview paths. | `packages/app-shared/src/app-data/attachment-blob-cache.ts` (new, with tests), `task-attachments-api.ts`, `apps/mfe-case-study/src/lib/app-data/inspector-photo-upload.ts`, `assignment-doc-attachments.ts` |
| The seven parallel per-scope `GET /api/attachments?scope=…` calls are replaced by one `GET /api/attachments/for-property?propertyId=<po>:<propertyId>` (rows carry `scope`, grouped client-side), cached for 60 s and forgotten on any write to a property scope, so the overview and the documents tab share it. The endpoint matches `scopeKey == needle` or `scopeKey startsWith needle + ":"`, and property documents are keyed `po:propertyId`, so the compound key is the needle — a bare property id returns nothing for these scopes. | `assignment-doc-attachments.ts` (`fetchPropertyDocMetas`, `hydrateAllKindsFromApi`) |
| The documents effect re-runs as task ids resolve (and dev strict mode double-fires effects); the property prefetch, the task-attachment prefetch, the inspector-photo prefetch and the inspector workspace read now share their in-flight promise instead of re-issuing the request. | same modules, `inspector-workspace-reads.ts` |

### PO property detail — initial load, before vs after

| Metric | Before (median) | After (median) | Per run (after) |
| --- | ---: | ---: | --- |
| Total `/api/` requests | **88** | **29** | 29, 29, 29 |
| Distinct endpoints (method + templated path) | 24 | 24 | |
| Total response bytes | 11.98 MB | **180 KB** | |
| Requests to `attachments` (5169) | 52 | **2** (`for-property` list + one blob) | |
| Blob downloads (`GET /api/attachments/{id}`) | 36 | **1** | 1, 1, 1 |
| Distinct blob ids downloaded | 19 | 1 (the overview photo, 57 KB) | |
| `GET /api/attachments` per-scope list calls | 16 | 0 | |
| `GET /api/party-task-submissions/{id}` | 9 | 3 | the survey / evaluator / inspection submissions the documents hook fetched on mount no longer run; the overview reuses the party-submissions query's inspection read |

Intermediate stage, for the record: with the tab gate alone the cold load measured 27 requests / 118 KB but the overview showed its "no photo yet" placeholder. The primary-photo path costs +2 requests / +62 KB on top of that and restores the photo — within the 3-request / one-blob budget.

**Requests by upstream service (after)**

| Service | Port | Median requests |
| --- | ---: | ---: |
| `case-study` | 5162 | 15 |
| `platform` | 5168 | 5 |
| `attachments` | 5169 | 2 |
| `failures` | 5167 | 2 |
| `identity` | 5161 | 2 |
| `operations` | 5163 | 2 |
| `reporting` | 5164 | 1 |

**Slowest three endpoints (after)**: `GET /api/key-envelopes/gate` 107 ms, `GET /api/inspector-fees` 80 ms, `GET /api/case-study-info-roles` 78 ms. The blob is the fastest request on the load (13 ms median for 57 KB, served after the metadata list).

### Where the load moved: the documents tab

The attachment work is deferred, not deleted. Opening `documents` (the first media tab in catalog order) is now the moment it happens, and it happens once:

| Metric | Before (`tab:documents`) | After (`tab:documents`) | Per run (after) |
| --- | ---: | ---: | --- |
| Added requests | 1 | **23** | 23, 23, 23 |
| Requests to `attachments` | 0 | 19 | |
| List calls | — | 1 — `GET /api/attachments?scope=evaluator-report&scopeKey=62fb…` (task-scoped report, not a property scope). The `for-property` list from the cold load is reused. | |
| Blob downloads / distinct ids | 0 / 0 | **18 / 18 — 0 redundant**; the overview photo is not downloaded again | 18, 18, 18 |
| Added bytes | 5.9 KB | 7.84 MB | |

`photos` (opened after `documents`) adds 1 request and no attachment traffic — it reads the same sections. `enfath-upload` adds nothing. Deep-linking straight to `?tab=documents` or `?tab=photos` pays the 23 on the first paint instead of the initial 29 + 23.

### Whole page (initial load + all fifteen tabs)

| Metric | Before | After | Per run (after) |
| --- | ---: | ---: | --- |
| Total `/api/` requests | 120 (88 + 32) | **80** | 80, 80, 80 |
| Blob downloads / distinct ids | 36 / 19 (17 redundant) | **19 / 19 (0 redundant)** | |
| Total response bytes | ≈ 12.0 MB | 8.11 MB | |

The 8.1 MB is the full-resolution price of the 19 files fetched exactly once; it is only paid by a user who opens a media tab. Cutting it further needs a bounded preview per row on `for-property` — the backend change this document recommends and which was deliberately not made here.

### Caveats for the after run

- Dataset and code drift continued around this measurement (concurrent journeys and agents): `GET /api/work-orders/details` is 57 KB per load now versus 18 KB before, and the active queue moved from 56 to 18 requests because its per-row N+1 was fixed separately. The property-detail numbers are scoped to the fixture property and were identical across all three runs.
- The overview photo's cost depends on the fixture: here the inspection workspace was already being read by the party-submissions query, so the primary path added only the list and the blob. On a page where nothing else reads that submission it adds one more request (3 total), never more.
- `listAttachmentsForProperty` in `apps/mfe-evaluator/src/lib/evaluator/valuation-report-print-attachments.ts` passes the bare property id, so for the `property-*` scopes it sees nothing (they are keyed `po:propertyId`). Pre-existing and out of scope here; noted because the key semantics above are easy to get wrong.
