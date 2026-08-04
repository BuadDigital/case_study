# Architecture split — status

Honest running status of [`docs/architecture-split-plan.md`](../architecture-split-plan.md).
Update this file with every slice; do not summarise a partial slice as a finished phase.

## Where the split is (2026-08-03)

| Phase | State | Evidence |
| --- | --- | --- |
| 0 — freeze and measure | Ownership gate **closed**. All 60 table rows are `approved`; D1–D5 have recorded outcomes and rationale; D6 is `accepted-with-residual-risk`, not answered. Owner nomination, the production-consumer inventory, and production metrics are still outstanding and now gate Phase 3/4. | [`table-ownership.json`](../architecture/table-ownership.json), [`table-ownership-catalog.md`](../architecture/table-ownership-catalog.md) |
| 1 — split EF contexts | **In progress — extraction steps 1–5 of 5 complete.** Attachments, Platform, Valuation, Identity, Failures, Operations, Financial, Case Study, and Messaging have contexts and migration streams. | `backend/RealEstateEval.Infrastructure/Data/Contexts` |
| 2–5 | Phase 1 extraction complete; **A6 partial**: pure hosts dropped `AddPersistence`; residual dual-write hosts keep App pool. | — |

Phase 1's **context-extraction** steps are done. Full Phase 1 exit still needs residual hosts to
stop calling `AddPersistence` (case-study residual writers,
outbox drain). Pure extracted APIs (`attachments`, `identity`, `platform`, `valuation`,
`financial`, `operations`, `failures`) no longer register the legacy pool; readiness probes owned/residual-read
context streams instead.


## What extraction step 5 changed

- `MessagingDbContext` maps outbox / inbox / `UserNotifications` / push tables for the messaging
  migration stream (`messaging.__EFMigrationsHistory`) with an empty baseline.
- Platform: `AddMessagingPersistence` + `MessagingOutboxPublisher` (notif + outbox one UoW);
  `NotificationService` / `PushSubscriptionService` / web-push delivery use Messaging only;
  Platform `IIntegrationEventInbox` resolved onto Messaging.
- Valuation still maps its own outbox (D5). Case Study residual produces outbox via App;
  the outbox dispatcher still claims rows through `ApplicationDbContext` against the same table.
- Catalog / architecture: Messaging extracted; owning-service guard covers notification + push
  services (no `ApplicationDbContext`).

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

## What extraction step 4 changed

- `FinancialDbContext` / `CaseStudyDbContext` + empty baselines (`financial` / `case_study`
  history schemas). D1 inspector-fee tables stay physically in `case_study` mapped by Financial;
  D2 ops tasks stay on Operations (not Case Study).
- Legacy cutover advanced to `20260802093148_SyncLocationCatalogModelOnLegacy` so post-cutover
  fee/pricing migrations already applied on the legacy stream stay valid after extraction.
- Hosts register `AddFinancialPersistence` / `AddCaseStudyPersistence` (Case Study + Failures +
  Financial API + DbMigrate).
- **Residual:** most Financial/Case Study business writers still inject `ApplicationDbContext`
  (dual transitional path). Pure service rewire is a follow-up; ownership catalog write contexts
  already name the extracted DbContexts.

## Verification (2026-08-03, step 5)

| Check | Result |
| --- | --- |
| `RealEstateEval.Architecture.Tests` | **Passed** — 39/39. |
| `RealEstateEval.Application.Tests` | **Passed** — 536/536. |
| ADR 0006 against a restored production-like database | **Not done** — still a residual gate. |

## Gates before Phase 1 exit (A6) / Phase 2

| Gate | Owner | Why |
| --- | --- | --- |
| Drop or minimize legacy `AddPersistence` write registration (A6) | API owners | **Partial** — pure hosts include financial + operations + **failures**; residual dual-write: **case-study** only |
| Nominate a service owner per API and a deploy-migrator owner | engineering management | Formal sign-off |
| Validate ADR 0006's deploy path against a restored production-like database | migrator owner | Plan prerequisite for later phases |
| Inventory production-only SQL/BI consumers (D6) | operations / data platform | Phase 3/4 |
| Capture production metrics baseline | operations | Comparison baseline |
| Measure pooled-connection counts with multiple contexts | operations | Connection-growth risk |
| Replace remaining Identity *reads* on ApplicationDbContext (fees, notifications, labels) | Phase 3 | Still cross-boundary LINQ |
