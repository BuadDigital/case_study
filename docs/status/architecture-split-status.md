# Architecture split — status

Honest running status of [`docs/architecture-split-plan.md`](../architecture-split-plan.md).
Update this file with every slice; do not summarise a partial slice as a finished phase.

## Where the split is (2026-08-03)

| Phase | State | Evidence |
| --- | --- | --- |
| 0 — freeze and measure | Ownership gate **closed**. All 60 table rows are `approved`; D1–D5 have recorded outcomes and rationale; D6 is `accepted-with-residual-risk`, not answered. Owner nomination, the production-consumer inventory, and production metrics are still outstanding and now gate Phase 3/4. | [`table-ownership.json`](../architecture/table-ownership.json), [`table-ownership-catalog.md`](../architecture/table-ownership-catalog.md) |
| 1 — split EF contexts | **In progress — extraction steps 1–3 of 5 complete.** Attachments, Platform, Valuation, Identity, Failures, and Operations have their own contexts and migration streams. Financial / Case Study and Messaging remain. | `backend/RealEstateEval.Infrastructure/Data/Contexts` |
| 2–5 | Steps 4–5 not started (Financial/Case Study, Messaging). | — |

Phase 1's own exit criteria are **not** met, and cannot be until step 5: every API still calls
`AddPersistence`, and `ApplicationDbContext` still holds the write path for the unextracted
slices. Identity stores are no longer registered on non-Identity APIs.

## What extraction step 2 changed

- `IdentityDbContext` maps the eleven `identity` tables (ASP.NET Identity stores plus profiles
  and refresh tokens). Empty baseline migration + `identity.__EFMigrationsHistory`.
- `AddEntityFrameworkStores<IdentityDbContext>()` — Identity is the only writer of those tables
  through UserManager / AuthSession / UserRegistration / database `PermissionService`.
- Non-Identity APIs register `AddClaimsPermissionService()` and resolve actor permissions from
  JWT claims (`capability`, `role`, `prototypeRole`, `distributionAssigneeId`, `page`) instead
  of opening Identity stores.
- Access tokens now carry prototype role, distribution assignee id, and pages so claim-based
  permission resolution matches the previous database-backed shape for the signed-in caller.
- Case Study demo seeding builds a short-lived Identity seed scope (`AddIdentitySeedStores`) so
  request paths stay claims-only while Development can still seed users.
- Legacy `ApplicationDbContext` still inherits Identity's store context and applies
  `ApplyIdentityModel` so transitional cross-boundary Identity *reads* keep compiling until
  Phase 3 replaces them.

## What extraction step 1 changed

- Three write contexts — `AttachmentsDbContext`, `PlatformDbContext`, `ValuationDbContext`.
- Eight services resolve their owner's context; Valuation outbox is per-producer (D5).
- Deploy migrator applies legacy first, then context streams in
  `BoundedContextMigrations.ApplyOrder` (now including Identity).

## Runtime and rollback

Nothing about the deployed topology changed. One database, same tables/schemas. Extracted
services open an additional pooled context against the same connection string.

Rollback for Identity: re-point Identity stores at `ApplicationDbContext` and restore
`AddIdentityInfrastructure` on other APIs; tables are untouched and the Identity stream is an
empty baseline.

## What extraction step 3 changed

- `FailuresDbContext` / `OperationsDbContext` + empty baseline migration streams (`failures` /
  `operations` history schemas). Ops tasks still live physically in `case_study`; ownership is
  Operations. Idempotent follow-up: key-envelope revenue entitlement on Operations.
- Writers use own context (or dual App + owned for financial / case-study cross-writes).
- Hosts: Failures / Operations APIs; Case Study registers both; Operations also registers Failures
  for access holds.

## Verification (2026-08-03, step 3)

| Check | Result |
| --- | --- |
| Full solution build | **Passed** (0 errors) for tested projects. |
| `RealEstateEval.Architecture.Tests` | **Passed** — 39/39. |
| `RealEstateEval.Application.Tests` | **Passed** — 536/536. |
| ADR 0006 against a restored production-like database | **Not done** — still a residual gate. |

## Gates before the next extraction step

| Gate | Owner | Why |
| --- | --- | --- |
| Nominate a service owner per API and a deploy-migrator owner | engineering management | Formal sign-off |
| Validate ADR 0006's deploy path against a restored production-like database | migrator owner | Plan prerequisite for remaining steps |
| Inventory production-only SQL/BI consumers (D6) | operations / data platform | Phase 3/4 |
| Capture production metrics baseline | operations | Comparison baseline |
| Measure pooled-connection counts with multiple contexts | operations | Connection-growth risk |
| Replace remaining Identity *reads* on ApplicationDbContext (fees, notifications, labels) | Phase 3 | Still cross-boundary LINQ |
