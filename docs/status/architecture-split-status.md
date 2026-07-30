# Architecture split — status

Honest running status of [`docs/architecture-split-plan.md`](../architecture-split-plan.md).
Update this file with every slice; do not summarise a partial slice as a finished phase.

## Where the split is (2026-07-30)

| Phase | State | Evidence |
| --- | --- | --- |
| 0 — freeze and measure | Ownership gate **closed**. All 60 table rows are `approved`; D1–D5 have recorded outcomes and rationale; D6 is `accepted-with-residual-risk`, not answered. Owner nomination, the production-consumer inventory, and production metrics are still outstanding and now gate Phase 3/4. | [`table-ownership.json`](../architecture/table-ownership.json), [`table-ownership-catalog.md`](../architecture/table-ownership-catalog.md) |
| 1 — split EF contexts | **In progress — extraction steps 1–2 of 5 complete.** Attachments, Platform catalogs, Valuation, and Identity have their own contexts, empty baseline migrations, model snapshots, and migrations-history schemas, over the one existing database. | `backend/RealEstateEval.Infrastructure/Data/Contexts` |
| 2–5 | Not started (Failures/Operations, Financial/Case Study, Messaging). | — |

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

## Verification (2026-07-30, step 2)

| Check | Result |
| --- | --- |
| Full solution build | **Passed** (0 errors). |
| `RealEstateEval.Architecture.Tests` | **Passed** — 39/39 (baseline regenerated). |
| `RealEstateEval.Application.Tests` | **Passed** — 384/384. |
| `RealEstateEval.Api.IntegrationTests` | **Passed** — 150/150. |
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
