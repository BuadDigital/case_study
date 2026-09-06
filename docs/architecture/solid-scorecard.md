# Design Patterns and SOLID Scorecard

**Date:** 2026-09-02 · **Branch:** dev
**Scope:** whole monorepo (backend contexts, shared assemblies, gateway, apps, packages). Excludes the idempotency work tracked in ADR 0008.
**Method:** every claim below was checked against the tree with file counts, line counts, and greps. Figures are as of this date; re-measure before citing them later.

Companion documents: [`../ARCHITECTURE.md`](../ARCHITECTURE.md), [`../architecture-split-plan.md`](../architecture-split-plan.md), [`../status/architecture-split-status.md`](../status/architecture-split-status.md), [`../frontend-best-practices-gap-report.md`](../frontend-best-practices-gap-report.md).

## Summary

This is an intentionally patterned enterprise monorepo mid-decomposition, not a clean textbook end-state. Design patterns are deliberate and enforced. SOLID is uneven by design: dependency inversion and hosting boundaries are the high points; single responsibility and interface segregation are where the monolith hangover still shows.

The one finding that changes the usual reading: **the fat services are not in the Application layer. They are in each context's Infrastructure assembly.** Application holds interfaces, DTOs, and rules. The use-case orchestration is compiled next to EF Core. This satisfies the architecture tests while leaving every use case coupled to the ORM.

## Patterns in play

| Pattern | Evidence |
| --- | --- |
| DDD bounded contexts | `backend/contexts/{attachments,case-study,failures,financial,identity,operations,platform,valuation}` each with Domain / Application / Infrastructure. 111 Domain source files across contexts. |
| Microservices behind a YARP gateway | `backend/gateway/RealEstateEval.Gateway`. Thin controllers: 65 controllers, average 106 lines. |
| Transactional outbox / consumer inbox | ADR 0004. 32 source files reference outbox or inbox messages. |
| CQRS by naming, not by framework | Commands and query services are separate classes (`*Commands.cs`, `*QueryService.cs`). No MediatR reference in any project. |
| Logical micro-frontends | `apps/shell` plus 10 MFE apps and 6 packages. No Module Federation; composition is by package import. |
| Shared frontend packages + TanStack Query | `api-client`, `app-shared`, `ui-kit`, `types`. 12 workspaces depend on `@tanstack/react-query`. |
| Architecture enforcement | `backend/RealEstateEval.Architecture.Tests` holds 52 facts/theories. Eight ADRs under `docs/adr`. |

## SOLID scorecard

| Principle | Score | Reality |
| --- | --- | --- |
| **S** Single responsibility | Mixed | Controllers are thin. 27 Infrastructure services exceed 400 lines; the largest is 1,142. 10 prototype storage facades on the frontend, three over 900 lines. 23 components over 1,000 lines. |
| **O** Open/closed | Mixed, trending strong | 13 rules modules under `RealEstateEval.Application/Rules` plus request validators are the genuine extension points. Most flows still grow by editing a large service. |
| **L** Liskov substitution | Strong | Substitution happens through DI (cache, permissions, publishers). Little inheritance to abuse. |
| **I** Interface segregation | Mixed, trending strong | At audit time `ICaseStudyRepository` exposed 17 DbSet/IQueryable members and one method from `RealEstateEval.Infrastructure`. Retired the same day: every Case Study consumer now takes a per-aggregate port in `CaseStudy.Application/Abstractions`, and an architecture test keeps the facade deleted. |
| **D** Dependency inversion | Strong in shape | Abstractions live in Application, implementations in Infrastructure, host `ServiceModule` composition wires them, and the architecture tests enforce the direction. See the caveat below. |

## Findings

### 1. Application is anemic; Infrastructure carries the use cases

In the Case Study context, Application has 27 abstraction files and Infrastructure has 36 service implementations. The largest file in the shared `RealEstateEval.Application` assembly is a 455-line validator. The transaction scripts sit under `contexts/*/Infrastructure/Services`:

| File | Lines |
| --- | --- |
| `financial/.../PartyBillingStatementService.cs` | 1,142 |
| `case-study/.../PartyTaskSubmissionService.cs` | 915 |
| `financial/.../PartyFeePricingService.cs` | 854 |
| `failures/.../FailureService.cs` | 805 |
| `identity/.../UserRegistrationService.cs` | 795 |
| `case-study/.../WorkOrderPropertyCommands.cs` | 745 |
| `platform/.../RegionsService.cs` | 739 |
| `financial/.../InspectorFeeService.cs` | 739 |

Consequence: the DIP score is earned by the layering, not by where the logic lives. Unit-testing a use case means standing up a DbContext.

### 2. EF leaks through the repository seam

`RealEstateEval.Infrastructure/Data/Contexts/CaseStudy/ICaseStudyRepository.cs` is a DbContext facade with a repository name. Ten files across contexts pass `IQueryable` across a service boundary, one of them an Application abstraction. Callers compose queries against EF, so the persistence model is part of the contract.

### 3. Rules modules are the working open/closed pattern

`FieldInspectionSubmissionValidator`, `InspectorFeeBillingRules`, and the other rules files are cohesive, testable, and extended rather than edited. They are the model the transaction scripts should migrate toward.

### 4. Frontend workflow lives in facades and components

| File | Lines |
| --- | --- |
| `apps/mfe-case-study/src/components/field-inspection/FieldInspectionWorkBody.tsx` | 2,791 |
| `apps/mfe-case-study/src/views/OperationsTasksView.tsx` | 2,168 |
| `apps/mfe-keys/src/components/KeyEnvelopeDetailModal.tsx` | 2,140 |
| `apps/mfe-evaluator/src/components/evaluator/valuation-work/ValuationWorkShell.tsx` | 2,072 |
| `apps/mfe-case-study/src/lib/prototype/po-intake-storage.ts` | 1,507 |
| `apps/mfe-case-study/src/lib/prototype/tasks-storage.ts` | 988 |
| `apps/mfe-case-study/src/lib/prototype/inspector-workspace-storage.ts` | 916 |

The `lib/prototype/*-storage.ts` facades blur reads and writes and own workflow decisions that belong in hooks or the API client. Components and views still hold too much orchestration.

## Status after the first pass (2026-09-02)

All four slices below were started the same day. Verification at close: full backend build clean, `RealEstateEval.Application.Tests` 1,123 passed, `RealEstateEval.Architecture.Tests` 59 passed with 4 failures that belong to the in-flight command-idempotency work (table owner not yet catalogued). Frontend: all micro-frontends typecheck except `mfe-keys`, which fails on a pre-existing error in uncommitted work; vitest 303 passed / 5 pre-existing failures in one evaluator test.

| Slice | Shipped | Still open |
| --- | --- | --- |
| 1. Use-case orchestration into Application | `PartyTaskSubmissionService` (915 lines) now lives in `CaseStudy.Application/Services` behind `IPartyTaskSubmissionRepository`, `ICurrentPrototypeRoleResolver`, and `IPartyTaskFailureGate`; EF adapter in `Infrastructure/Persistence`. Added to the `RepositoryBoundaryTests` pilots. New ratchet `InfrastructureServiceSizeTests` freezes the 26 Infrastructure services over 400 lines. | Every other service on the frozen list. |
| 2. Retire the DbSet facade | Done. `IWorkflowTaskVisibilityFilter` replaced by the pure predicate `WorkflowTaskVisibilityRules`. All 26 consumers converted: pure adapters moved to `Infrastructure/Persistence` taking `CaseStudyDbContext` directly; use cases (building inventory, inspection limits, property groups, transaction state, workflow slot sync) moved to `CaseStudy.Application/Services` behind narrow ports. `ICaseStudyRepository` deleted; `CaseStudySessionFacadeTests` keeps it deleted and forbids EF query types on any Application abstraction. Case Study `Infrastructure/Services` went from 34 files to 15. | Nothing for the facade. Remaining Case Study Infrastructure services are mappers, HTTP adapters, and the four large command services still on the size ratchet. |
| 3. Rules out of the fat services | Five services lost 20-43% each: billing statements 1,142 to 871, work-order property commands 745 to 422, fee pricing 854 to 661, failures 805 to 643, inspector fees 739 to 470. Rules modules under each context's `Application/Rules`, 113 new unit tests. Identity registration was skipped because it had uncommitted edits. | All five are still above the 400-line cap; `FailureService.ToDto` stays put because it needs a remote-client label resolver. |
| 4. Split the prototype storage facades | PO intake, tasks, and inspector workspace each split into `-model` / `-reads` / `-commands` under `lib/app-data`. Seven barrels deleted with about 90 importers moved to deep imports; the tasks barrel kept as named re-exports (95 importers). `OperationsTasksView` 2,170 to 1,310 and `FieldInspectionWorkBody` 2,796 to 1,233 lines, workflow moved into `useOperationsTasksWorkflow` / `useFieldInspectionWorkflow` plus pure state modules. | The 33-line Infath deposit facade (not worth splitting), the four `*-storage.ts` files in other MFEs, and the next tier of components (`KeyEnvelopeDetailModal`, `ValuationWorkShell`, `ActiveTransactionQueueView`). |

## Status after the second pass (2026-09-03)

Verification at close: `RealEstateEval.Application.Tests` 1,124 passed, `RealEstateEval.Architecture.Tests` 67 passed / 0 failed (the four idempotency failures were closed by cataloguing `messaging.CommandIdempotencyRecords` as per-producer shared infrastructure and recording the store's five-API registration, same as the outbox). Frontend: every micro-frontend and the shell typecheck clean individually (the combined script still stops at the in-flight `mfe-keys` deed-number error); vitest 277 passed / 5 pre-existing failures.

| Principle | Score now | Evidence |
| --- | --- | --- |
| **S** Single responsibility | Strong on the backend, good on the frontend | No Infrastructure service is over 400 lines: `Identity/UserRegistrationService`, the last one, moved to `Identity.Application/Services` on 2026-09-03 and the frozen list is now empty. Fourteen frontend components were halved or better; the largest entry files are now under 700 lines. |
| **O** Open/closed | Strong | Rules modules in every context: shared, Case Study, Financial, Operations, Platform, Valuation, Failures. |
| **L** Liskov | Strong | Unchanged. |
| **I** Interface segregation | Strong | Per-aggregate ports in every context; no Application abstraction exposes a query type. |
| **D** Dependency inversion | Strong | 40 use cases in `<Ctx>.Application/Services` across seven contexts; EF only in `Infrastructure/Persistence`; Application projects reference no EF or Infrastructure package. |

| Context | Use cases in Application | Infrastructure services left over the cap |
| --- | --- | --- |
| Case Study | 17 | 0 |
| Financial | 8 | 0 |
| Operations | 5 | 0 |
| Platform | 3 | 0 |
| Valuation | 5 (+ report field builder as a rule) | 0 |
| Failures | 1 | 0 |
| Identity | 1 | 0 |

Still open after this pass:

- Two large new hooks that split cleanly into data and commands halves: `useEngineeringSurveyWorkflow` (657) and `useCaseStudyFormWorkflow` (670).
- The `mfe-keys` typecheck error and the vitest count drop from 303 to 282 between the morning and afternoon commits, both in your in-flight work.
- `BoundedContextBoundaryTests.ExtractedTablesAreNoLongerWrittenThroughTheLegacyContext` now scans `Infrastructure/Services`, `Infrastructure/Persistence` and `Application/Services` per context instead of a hard-coded folder list, so future moves do not need a hand edit there.

## Identity slice (2026-09-03)

`UserRegistrationService` was the last transaction script in an `Infrastructure/Services` folder. It now lives in `Identity.Application/Services` (805 lines across the command and query partials) behind two ports in `Identity.Application/Abstractions`:

- `IStaffRegistrationRepository` — profile rows, uniqueness guards, refresh-token revocation, the yearly user reference, the audit rows, and the transaction. EF adapter: `Identity.Infrastructure/Persistence/StaffRegistrationRepository.cs`.
- `IStaffIdentityStore` — account lookups, role membership, lockout, activation ticket and password reset. `UserManager<ApplicationUser>` adapter: `Identity.Infrastructure/Persistence/StaffIdentityStore.cs`. Every result is a plain value (`StaffIdentityUser`, `StaffIdentityError`), so `Identity.Application` still references neither EF nor ASP.NET Identity.

`StaffUserRules`, `StaffRoleDefaults` and the new pure `StaffRoleCatalog` moved to `Identity.Application/Rules`; `PrototypeRoleResolver` now forwards to the catalog and keeps only the profile-reading `Resolve`. `RegistrationMapper` stayed in Infrastructure — it maps `ApplicationUser`/`UserProfile`, which are compiled into the shared Infrastructure assembly and cannot cross into Application.

One baseline line moved with real meaning: `apiSchemaAccess.identity` now records `audit` beside `identity`. The identity host has appended audit rows through `IdentityDbContext` since D7 approved the per-producer ledger (`audit.AuditLogs` lists `IdentityDbContext` as a writer); the old measurement missed it because `UserRegistrationService` was a partial class and the type-to-file map resolved to the query half. Splitting the adapter out made the catalogued fact visible. No new coupling was introduced.

## Status after the third pass (2026-09-04)

Backend: `InfrastructureServiceSizeTests.FrozenOverCap` is empty — no Infrastructure service in any context exceeds 400 lines. Identity joined the other six contexts (`UserRegistrationService` in `Identity.Application/Services` behind `IStaffRegistrationRepository` and `IStaffIdentityStore`; ASP.NET Identity stays behind the store adapter). `RealEstateEval.Application.Tests` 1,124 passed; `RealEstateEval.Architecture.Tests` 67 passed / 0 failed.

Frontend: seven more components split (inspector wizard 1,170→348, PO list 1,138→523, party fees 1,083→593, engineering fees 1,063→231, property detail tabs 1,047→516, comparables view 1,008→343, professional report view 1,006→209); the two large workflow hooks from the second pass split into data / commands halves. The Tabler icon font is now loaded once in the shell layout. The five long-standing live-fill test failures were fixture bugs and are fixed. All ten micro-frontends and the shell typecheck clean; vitest 58 files / 282 tests, 0 failed; barrel-import lint clean.

Only four `.tsx` files remain over 1,000 lines, and each is a deliberate non-target: two are pure table / parts collections (`active-transaction-queue-tables.tsx`, `OperationsTasksViewParts.tsx`) and two are already-split shells that are mostly JSX (`OperationsTasksView.tsx`, `FieldInspectionWorkBody.tsx`).

Follow-up worth a look: `dtoToProperty` in `po-intake-model.ts` maps `deedNumber` without the `?? ""` its neighbours have, so a malformed payload could still write `undefined` over the default.

## Pagination slice (2026-09-04)

Contract: `docs/architecture/pagination-contract.md`. Server-side paging, filtering and sorting on `GET /api/work-orders`, `GET /api/workflow-tasks`, `GET /api/operations-tasks` (`page`, `pageSize`, `sort`, `dir`, `q`, endpoint filters; `PagedResultDto` envelope only when a page is requested, so every existing caller keeps the plain array). Filtering and sorting are EF expressions in the Persistence query services; the allow-lists and sort maps are pure rules in `<Ctx>.Application/Rules` (`WorkOrderListQueryRules`, `WorkflowTaskListQueryRules`, `OperationsTaskListQueryRules`). Party visibility is applied before paging so counts belong to the actor. 99 backend tests added (rules + in-memory query services) and the three Postgres container list tests now cover every filter/sort combination; `Application.Tests` 1,223 passed, `Architecture.Tests` 67 / 0, `Api.IntegrationTests` 214 / 0.

Client: `packages/api-client/src/pagination.ts` gained `fetchListPage` + `buildListQueryString`; typed list queries and paged fetchers for the three resources; paged TanStack hooks with `keepPreviousData`; a shared `useDebouncedValue`. `PoListView` is fully server-paged (pager shows real totals). The active transaction queue and operations tasks send their filters and sort to the server but keep no row window, because the rules the contract lists as client-side (PO-record joins, computed status badges, blocked-by-failure hiding) run after the cut and would make totals wrong. Vitest 63 files / 338 tests, 0 failed (+56 tests).

Known gaps, all documented in the contract's "still client-side" lists: Enfaz billing buckets widen server-side and narrow in the browser; the queue's search covers PO-record columns the task endpoint does not have, so `q` is plumbed but not sent for that screen; deed-number search on operations tasks is not available server-side (`DeedsJson` is jsonb). Container tests: the eight long-standing 403 failures on dispatch routes were a test gap (the upstream header required since 2026-08-30 was never sent); fixed in the two test helpers.

## Frontend architecture ratchet (2026-09-04)

The backend has frozen its layering in `RealEstateEval.Architecture.Tests`. The frontend now has the
equivalent under **`tests/architecture/`**, running inside the existing `npx vitest run`
(`vitest.config.ts` gained `tests/**/*.{test,spec}.{ts,tsx}` to its `include`). Three suites plus a
shared scanner in `tests/architecture/support/frontend-tree.ts`; no AST, no new dependency, just
`node:fs` walks and a handful of regexes. Every failure message names the fix and points back here.

The frozen lists live in [`frontend-size-baseline.json`](frontend-size-baseline.json) and **may only
shrink**. Each size suite asserts both directions, the same pair as `InfrastructureServiceSizeTests`:
nothing over the cap may be missing from the list, and every listed file must still exist and still be
over the cap. So a file that gets split has to be removed from the baseline, which is what stops it
regrowing unnoticed.

| Suite | Scope | Cap | Frozen at freeze time |
| --- | --- | --- | --- |
| `component-size.test.ts` | `apps/*/src/**/*.tsx` (excludes `node_modules`, `.next`, `dist`/`build`, `__tests__`, `*.test.tsx`) | 700 lines | 24 of 336 components |
| `hook-size.test.ts` | `use*.ts` under `apps/*/src` and `packages/*/src` | 500 lines | 4 of 50 hooks |
| `storage-module-purity.test.ts` | `apps/*/src/lib/app-data`, `packages/app-shared/src/app-data`, plus a repo-wide `*-storage.ts` sweep | n/a | 3 storage facades |

Finding 4 above is what these cap. The 24 frozen components are the tail the third pass did not reach;
the four frozen hooks are the workflow hooks that absorbed orchestration when the big views were split
(`useOperationsTasksWorkflow`, `useActiveTransactionQueueWorkflow`, and the two `useValuationWork*`
halves). Splitting any of them means deleting its baseline row in the same commit.

Storage purity encodes the shape slice 4 moved to — `-model` / `-reads` / `-commands` triples under
`lib/app-data`:

- a `*-reads.ts` module may not carry `method: "POST" | "PUT" | "PATCH" | "DELETE"`, may not call
  `repositoryFetch` with a `method` option, and may not import runtime code from a `*-commands`
  sibling (`import type` is fine);
- a `*-commands.ts` module may not own a TanStack `useQuery` / `useInfiniteQuery` / `useSuspenseQuery`;
- no new `*-storage.ts` facade anywhere in `apps/*/src` or `packages/*/src`. The three left are
  `apps/mfe-case-study/src/lib/app-data/{tasks,infath-deposit}-storage.ts` and
  `apps/mfe-settings/src/lib/app-data/courts-storage.ts`.

All three rules pass on the current tree with no exemptions, and each was verified to fail when
deliberately broken (a component pushed to 703 lines, a hook to 506, a `POST` literal added to
`tasks-reads.ts`, a `useQuery` to `tasks-commands.ts`, a stray `probe-storage.ts`, and a stale baseline
row for the already-split `PoListView.tsx`).

Also closed in this pass: the third-pass follow-up on `dtoToProperty`. `deedNumber` now falls back to
`""` like its neighbours, covered by
`apps/mfe-case-study/src/lib/app-data/__tests__/po-intake-model-deed-number.test.ts`.

## Pagination slice, second pass (2026-09-04)

The contract (`docs/architecture/pagination-contract.md`) now covers seven endpoints plus a counts
route, and two of the three original endpoints lost the client-side rules that were keeping their
screens un-pageable.

| Endpoint | What landed |
| --- | --- |
| `GET /api/work-orders/counts` | New. The PO screen's whole KPI band (`poListKpi`) and its empty-state copy as six SQL `COUNT`s over the same filtered, visibility-narrowed set the list pages. `WorkOrderListCountsDto` in `CaseStudy.Application/Contracts`; `WorkOrderQueryService` now takes an injected `TimeProvider` for the due-date window. |
| `GET /api/workflow-tasks` | `WorkflowTaskDto` carries `deedNumber`, `city`, `district`, `propertyType`, `classification` joined from `WorkOrderProperty` (additive, null for unlinked slots); `q` covers all five; `sort=deed` and `sort=city` added. The active-transaction queue's PO-record search and joins are retired, so it can page. |
| `GET /api/operations-tasks` | `q` matches deed numbers server-side. Migration `AddOperationsTaskDeedSearchIndex` adds a stored generated `DeedsText` projection plus GIN `jsonb_path_ops` (exact `@>`) and GIN `gin_trgm_ops` (substring `LIKE`) indexes; the in-memory provider takes a LINQ fallback behind `Database.IsNpgsql()`. `OperationsTaskQueryService` moved from `Infrastructure/Services` to `Infrastructure/Persistence`. |
| `GET /api/comparable-properties` | Paged envelope, six sort keys, and the comparison-method §2 field-first priority pushed from an in-memory re-truncation into the SQL ordering — so a page and its count now agree. |
| `GET /api/failures` | Went from no parameters at all to the full contract; visibility still narrows before the count. The HTTP client forwards the filters upstream. |
| `GET /api/notifications` | Paged envelope plus `q` / `category` / `unread`; the SSE stream is untouched and the feed keeps its own 50-row unpaged cap. |
| `GET /api/financial/{incentive-suspensions,discount-flags}` | Paged envelope, shared `FinancialLedgerListQueryRules`, hard-coded `Take(200)` kept as the unpaged cap. |

Two endpoint families remain deliberately plain arrays — party-fee-pricing tables (a catalogue that
answers 400 on a bad `category`) and the non-list `*-dispatch` routes (owner-to-owner). The contract's
§8 records each reason. The party billing and Enfaz billing lists, first left out because they are
cross-host passthroughs and two of them compose rows in memory, are now §9–§10: the dispatch mirrors
return the same envelope as the public routes, and the synthesised lists page over the materialised
row set so the count and the page still agree (`MaterialisedListPage`, `*ListQueryRules` under
`Financial.Application/Rules`).

Verification at close: build clean; `Application.Tests` 1,324 passed, `Architecture.Tests` 67 / 0,
`Api.IntegrationTests` 214 / 0, `Api.ContainerTests` 42 / 0. The Operations migration was applied to
the local dev database.

## Read-side decision: no BFF / GraphQL for now (2026-09-04)

Criteria used (stated here for the first time; earlier they were only discussed): a BFF or GraphQL layer is justified when a screen needs six or more requests across several services on initial load and its slowest endpoint is the user-visible cost. Measured with `e2e/.measure-property-detail.mjs` (three cold runs, medians, fixture PO 036680; full tables in `property-detail-fanout-2026-09-04.md`):

| Page | Requests | Distinct endpoints | Bytes | Slowest endpoint |
| --- | --- | --- | --- | --- |
| Property detail | 88 | 24 | 11.98 MB | party task submission, 439 ms |
| Active transactions queue | 56 | 17 | 86 KB | party case-study form, 399 ms |
| PO list | 27 | 18 | 75 KB | distribution assignees, 259 ms |

The request count trips the threshold but the shape argues against a BFF: 59% of the property detail requests hit one service (attachments), and 36 of them download only 19 distinct blobs at full resolution because `usePropertyDetailDocuments` runs on mount with no tab gate and prefetches every inspection photo for previews. The queue's cost is a per-row N+1 in `case-study-party-progress.ts` (four requests per row, repeated three times per load, 64% of the page). Neither is breadth across services; both are repetition on the client.

Decision: fix the clients, keep REST. Next slices, in value order: (1) gate the documents / photo prefetch on the documents and photos tabs and de-duplicate blob downloads through the query cache; (2) switch the document lists to the existing `GET /api/attachments/for-property` and give it a thumbnail variant, which removes about 51 of the 88 requests and nearly all of the 12 MB; (3) replace the queue's per-row party-form calls with one batched lookup. Re-measure after each; revisit the BFF question only if a screen is still over the threshold with the repetition gone.

## Status after the read-side fixes (2026-09-04, evening)

All three read-side slices shipped and re-measured (`property-detail-fanout-2026-09-04.md`): property detail cold load 88 → 29 requests and 12 MB → 180 KB with the overview photo intact; active queue 56 → 20 with the party-form N+1 replaced by `GET /api/case-study-forms/batch`. The two queue workflow hooks are split (data / commands / pure state) and out of the frontend baseline. Finance lists (party billing statements, ready lines, Enfaz summaries and tracking) follow the pagination contract on both hosts, failures and the finance screens render the shared `ListPager`. Five Playwright journeys cover intake → distribution, inspection, survey, appraisal and billing, and the full e2e suite is green twice (47 smoke, 19 journeys, 0 skips). Product bugs found by the journeys are fixed: specialist read access to the final report (`ReadValuationReport` policy), engineering-survey pricing seed (tiers **and** the per-office assignment, added through the DbSet), photo pickers for the five component toggles, concurrency-safe session issuance, and the survey accept now refreshes the timeline rail.

The original four slices below are complete; they stay for the record.

## Frontend burn-down, first slice (2026-09-05)

The four components over 1,200 lines and the two frozen evaluator hooks are split, behaviour-preserving, with their baseline entries removed (`hooks.frozen` is now empty; 19 components remain frozen, 716–989 lines):

| Was | Now |
| --- | --- |
| `active-transaction-queue-tables.tsx`, 1,378 | deleted; one file per table/toolbar (117–288 lines), shared row parts, `active-transaction-queue-tables-state.ts` (14 tests) |
| `OperationsTasksView.tsx` 1,310 + `OperationsTasksViewParts.tsx` 1,336 | view 125 lines composing eleven region files (102–511); fourteen pure helpers added to `operations-tasks-view-state.ts` (33 tests) |
| `FieldInspectionWorkBody.tsx`, 1,235 | 286-line composition over seven step/chrome files (133–283); `field-inspection-work-state.ts` (14 tests) |
| `useValuationWorkCommands.ts` 779 / `useValuationWorkData.ts` 733 | 33 / 439, composing six concern hooks (113–303) over `market-commands-state.ts` and `valuation-data-state.ts` (37 tests) |

Verification: typecheck clean on every MFE, vitest 80 files / 531 tests with the size ratchets, barrel lint clean, the five journeys and the modules smoke green. One product race surfaced by the survey journey under a slow dev server and fixed: engineering-survey draft writes were built from a cache that only advanced when the PUT resolved, so overlapping writes erased each other; writes — field patches and the report upload/clear alike — are now serialised per task through `engineering-survey-draft-write-queue.ts`, and submit waits for the queue (`engineering-survey-draft-write-queue.test.ts`).

## Frontend burn-down, second slice (2026-09-05): frozen lists empty

The remaining nineteen components were split the same way, six agents on disjoint folders, and both frozen lists in `frontend-size-baseline.json` are now `[]`. From here the ratchet is absolute: no `.tsx` over 700 lines, no `use*.ts` over 500, no new storage facades.

| Area | Was | Now |
| --- | --- | --- |
| Settings (4 views, 845–989) | monoliths | 69 / 88 / 101 / 195-line views over workflow hooks, state modules and region files; shared `ConfirmActionModal` (53 tests) |
| Shell (nav parts 982, shell 870, offline sync 733) | | 538 / 285 / 95 over `app-shell-nav-state`, `app-shell-chrome-state`, `offline-sync-state`, five hooks and `offline-sync-replay` (48 tests) |
| Keys (dialogs 968, register modal 928, view 791) | | four dialog files + shared; 265-line modal over a workflow hook and sections; 156-line view over a workflow hook and regions (49 tests) |
| Financial (revenue tables 972, Enfaz billing 731) + failures view 916 | | 25-line re-export hub over six tables; 182-line billing over a workflow hook; 64-line failures view over a workflow hook and six regions (44 tests) |
| Property intake (inspection parts 941, Enfaz form 866, upload 769) | | 29 / 205 / 94 over parts, sections, an autofill hook and an upload workflow (55 tests) |
| Task work view 965, create-task modal 879, defined photos 716 | | 121 / 272 / 312 over workflow + commands hooks, a reducer state module and slot components (36 tests) |

Verification after the slice: typecheck clean on all seven MFEs, the shell and the api-client; vitest 99 files / 816 tests including both size ratchets; barrel lint clean; Playwright smoke 47 pass, journeys 19 pass twice. One deliberate behaviour fix surfaced by the split: failure cards on mobile now show action spinners (a memo with a stale dependency had hidden them).

## Recommended next slices

None open. The scorecard's findings are closed on both sides; the ratchets (backend size and boundaries, frontend size and storage purity) hold the shape. Reopen only with a new finding.

Completed slices (kept for the record):

1. ~~Move use-case orchestration into Application, one service at a time.~~ Done for all seven contexts; `FrozenOverCap` is empty.
2. ~~Retire `ICaseStudyRepository` as a DbSet facade.~~ Done; no `IQueryable`/`DbSet` on any Application abstraction.
3. ~~Extract rules from the five largest Infrastructure services.~~ Done; `Rules` modules per context, list-query rules per paged endpoint.
4. ~~Split the three largest prototype storage facades.~~ Done; model / reads / commands modules with the purity ratchet.

## What not to reopen

- No MediatR. CQRS by naming is a deliberate choice; adding a mediator would not fix finding 1.
- No Module Federation. Logical MFEs are the agreed shape until the split plan says otherwise.
- The two shared assemblies (`RealEstateEval.Application`, `RealEstateEval.Infrastructure`) remain deliberate per the A8/A10 close-out. Finding 1 is about the per-context assemblies, not those two.
