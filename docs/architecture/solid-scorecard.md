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
| **I** Interface segregation | Mixed | Narrow ports exist (`IWorkflowTaskVisibilityFilter`). Against that, `ICaseStudyRepository` exposes 17 DbSet/IQueryable members and one method, and lives in `RealEstateEval.Infrastructure`, not a Domain or Application port. |
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
| 2. Retire the DbSet facade | `IWorkflowTaskVisibilityFilter` (the one Application abstraction passing `IQueryable`) replaced by the pure predicate `WorkflowTaskVisibilityRules`. New `CaseStudySessionFacadeTests` freezes the 26 remaining `ICaseStudyRepository` consumers and forbids EF query types on any Application abstraction. | Converting those 26 consumers to per-aggregate ports; the facade itself stays until the list is empty. |
| 3. Rules out of the fat services | Five services lost 20-43% each: billing statements 1,142 to 871, work-order property commands 745 to 422, fee pricing 854 to 661, failures 805 to 643, inspector fees 739 to 470. Rules modules under each context's `Application/Rules`, 113 new unit tests. Identity registration was skipped because it had uncommitted edits. | All five are still above the 400-line cap; `FailureService.ToDto` stays put because it needs a remote-client label resolver. |
| 4. Split the prototype storage facades | PO intake, tasks, and inspector workspace each split into `-model` / `-reads` / `-commands` under `lib/app-data`. Two barrels deleted with 30 importers moved to deep imports; the tasks barrel kept as named re-exports (95 importers). | Remaining `*-storage.ts` facades and the 2,000-line components. |

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
