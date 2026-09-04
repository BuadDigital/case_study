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

## Recommended next slices

Ordered by value over cost. Each needs its own decision.

1. **Move use-case orchestration into Application, one service at a time.** Start with `PartyTaskSubmissionService` (915 lines, Case Study). Leave EF access behind a narrow port; keep the Infrastructure class as the adapter. Add an architecture test that caps Infrastructure service size or forbids business rules there once the first slice lands.
2. **Retire `ICaseStudyRepository` as a DbSet facade.** Replace the 17 exposed sets with per-aggregate ports in Application. Stop passing `IQueryable` across the Application boundary; the visibility filter abstraction is the first candidate.
3. **Extract rules from the five largest Infrastructure services** into `Rules` modules, mirroring the existing validators. This is the cheapest SRP gain and reuses a proven pattern.
4. **Split the three largest prototype storage facades** into read hooks and write commands, starting with PO intake. Track the split in the frontend gap report so it is not re-audited as new.

## What not to reopen

- No MediatR. CQRS by naming is a deliberate choice; adding a mediator would not fix finding 1.
- No Module Federation. Logical MFEs are the agreed shape until the split plan says otherwise.
- The two shared assemblies (`RealEstateEval.Application`, `RealEstateEval.Infrastructure`) remain deliberate per the A8/A10 close-out. Finding 1 is about the per-context assemblies, not those two.
