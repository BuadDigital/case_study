# Backend architecture split plan

This plan decomposes the shared persistence and code core without changing network or data
boundaries in one release. It deliberately does **not** assume that nine API processes are
already nine autonomous services.

## Verified baseline (2026-07-29)

- There are nine API projects under `backend/services`: identity, case-study, platform,
  failures, operations, valuation, attachments, financial, and reporting.
- Every API references both `RealEstateEval.Application` and
  `RealEstateEval.Infrastructure`. Application has 88 C# files; Infrastructure has 45
  service implementation files in `Services/` plus shared persistence, messaging,
  migrations, storage, and seed code. The gateway references `Shared.Web`, which itself
  references the global Application project.
- Every API calls `AddPersistence`; it registers the same pooled `ApplicationDbContext`.
  The context has 53 declared `DbSet`s, not the audit's earlier count of 51. The two recent
  additions are `RefreshTokens` and `ProcessedIntegrationEvents`
  (`backend/RealEstateEval.Infrastructure/Data/ApplicationDbContext.cs:11-64`).
- The 53 sets map to `identity` (4 plus inherited Identity sets), `case_study` (16),
  `platform` (8), `failures` (2), `operations` (7), `valuation` (2), `attachments` (1),
  `financial` (10), and `messaging` (3).
- All schemas share one model snapshot and migration directory. Case Study is the only API
  that currently calls `Database.MigrateAsync()` at startup
  (`backend/services/case-study/RealEstateEval.CaseStudy.Api/Program.cs:50-56`).
- Service-specific connection-string names exist, but resolution falls back to a common
  environment variable/default connection. All nine development settings use
  `realestate_eval_dev`. Separate credentials or databases therefore are possible
  configuration shapes, not enforced ownership.
- Outbox claiming is lease-based (`BatchSize = 25`, two-minute lease), uses
  `FOR UPDATE SKIP LOCKED`, and dead-letters after 10 handler failures. Inbox dedupe uses
  `(Consumer, EventId)` in `messaging.ProcessedIntegrationEvents`. Only Case Study
  registers the outbox dispatcher.
- `xmin` concurrency is configured on 19 mutable entity types; the shared exception
  middleware returns HTTP 409.

## Implementation status (2026-07-30)

Ownership is approved, so Phase 0's ownership gate is closed and Phase 1 has started.
Artifacts and guardrails live in
[`docs/architecture/table-ownership-catalog.md`](architecture/table-ownership-catalog.md),
[`docs/architecture/table-ownership.json`](architecture/table-ownership.json), and
[`docs/architecture/boundary-baseline.json`](architecture/boundary-baseline.json), enforced by
`backend/RealEstateEval.Architecture.Tests`. Current build and test results are in
[`docs/status/architecture-split-status.md`](status/architecture-split-status.md).

| Phase | State |
| --- | --- |
| 0 — freeze and measure | Repository work complete: 60-table ownership catalog (53 `DbSet`s plus seven inherited Identity tables), cross-boundary classification, and boundary tests. All 60 rows are approved and D1–D6 are recorded with outcomes and rationale; D6 is accepted with residual risk rather than answered. Owner nomination, the production-consumer inventory, and the captured production metrics are still outstanding and now block Phase 3/4 rather than Phase 1. |
| 1 — split EF contexts | **In progress.** Extraction steps 1–2 are done: `AttachmentsDbContext`, `PlatformDbContext`, `ValuationDbContext`, and `IdentityDbContext` hold the write path for their tables, each with an empty baseline migration, model snapshot, migration stream, and migrations-history schema, against the same physical database. Non-Identity APIs resolve permissions from JWT claims. Steps 3–5 (Failures/Operations, Financial/Case Study, Messaging) are not started, so the phase exit criteria are not met — `ApplicationDbContext` still has runtime registrations and write paths for the unmoved slices. ADR 0006's deploy path is still validated only against a blank database, not a restored production-like one. |
| 2–5 | Not started. |

Findings that refine the baseline above, all now covered by tests:

- The model contains **no cross-schema foreign keys and no cross-schema navigations**;
  cross-boundary coupling is entirely in queries, transactions, and registrations.
- Several persistence services are registered by more than one API, so several tables have
  more than one writing process today (for example `FailureService` in Case Study and
  Failures, `KeyEnvelopesService` in Case Study and Operations, and the Identity stores in all
  eight database APIs). Rule 1 is therefore not satisfied at process level even before contexts
  are split.
- Reporting registers no persistence at all; it is already an HTTP read model.
- `ApplicationDbContextModelSnapshot` had drifted from the model (the concurrent
  race-guard/index migration's snapshot update was missing). The snapshot was regenerated so
  the frozen legacy baseline stays trustworthy; no schema or data change was made.

## Boundary facts that block an immediate database split

The following are code references, not inferred future dependencies:

| Owning behavior | Cross-boundary data used today | Evidence |
| --- | --- | --- |
| Case Study work orders | `financial.PoEnfazInvoices`, `failures.PropertyFailures` | `WorkOrderService.cs:102-121,205-235` |
| Case Study workflow | `failures.PropertyFailures` | `WorkflowTaskService.cs:190-220` |
| Failure lifecycle | Case Study workflow tasks, properties, and work orders | `FailureService.cs:94-166,464-536` |
| Financial reports | Financial fees/invoices plus Case Study ledgers, tasks and work orders, and Identity users/profiles | `FinancialReportService.cs:85-101,159-204,267-292` |
| Engineering billing | Financial statements plus Case Study ledgers, tasks, properties and document counters, and Attachments | `EngineeringBillingStatementService.cs:37-38,127-298,344-417,513-680` |
| Operations tasks | `case_study.OperationsTasks` and workflow tasks, Identity profiles, Financial court-visit charges, Operations key envelopes | `OperationsTaskService.cs:74-1178` |
| Party submissions | Case Study data plus Failures and Attachments | `PartyTaskSubmissionService.cs:573-690` |
| Inspector fees | Case Study ledgers/tasks/properties plus Identity profiles/users | `InspectorFeeService.cs:93-343,1004-1044,1314-1432` |
| Notifications | Case Study and Failures write `messaging.UserNotifications`; Platform lists and mutates them | `DependencyInjection.cs:148-173,210-222`; `NotificationsController.cs` |

Some rows are also in schemas that do not match their likely long-term owner:
`OperationsTasks`, `OperationsTaskSequences`, inspector-fee ledgers/transitions, and
disbursement batches are in `case_study`; notification rows, all producers' outbox rows,
and all consumers' inbox rows share `messaging`. Ownership must be decided from behavior
and transaction invariants, not inferred from the current schema name.

## Rules for the migration

1. One table has one write owner at every stage.
2. No new cross-schema joins, foreign keys, or multi-owner transactions.
3. Separate code and context first; move data only after the boundary works in production.
4. Prefer owner APIs for synchronous invariants and events plus projections for
   asynchronous/read-model needs.
5. Every compatibility adapter has an owner, metric, and removal criterion.
6. Migrations use expand-and-contract and the deploy-time migrator in ADR 0006.
7. A phase starts only when the preceding phase's exit criteria are met.

## Phase 0 — Freeze and measure the boundary

**Why first:** current schema labels and API names do not reliably identify table ownership.
Splitting contexts before settling write ownership would duplicate mappings or move the
wrong tables.

**Before starting**

- Nominate owners for each API and the deploy-time migrator.
- Inventory production-only SQL, BI jobs, database roles, backup/restore procedures, and
  direct database clients. These are not discoverable from this repository and remain an
  explicit uncertainty.
- Capture p95 latency/error rate, database connection counts, outbox backlog age,
  dead-letter count, consumer redeliveries, and key row counts.

**Work**

- Create a table ownership catalog for all 53 sets and inherited Identity tables:
  writer, readers, schema, transaction group, API endpoints, and migration owner.
- Classify each cross-boundary use as synchronous invariant, command, reference lookup, or
  reporting projection.
- Add architecture tests that prohibit new service references to the global assemblies
  once a replacement exists, and static checks that flag new cross-schema SQL/DbSets.
- Decide the ambiguous ownership groups: inspector fees/disbursement, operations tasks and
  court-visit fees, notification inbox, and document-reference counters.

**Exit criteria**

- Every table and write path has exactly one approved owner.
- Every verified cross-boundary query has a replacement pattern and acceptance test.
- Production-only consumers are inventoried; unknown direct database clients are a stop
  condition for later database movement.

**Status:** catalog, classification, and guardrails exist; all 60 rows are approved and D1–D6
are recorded (2026-07-30); acceptance tests exist for the replacements made in Phase 1
extraction step 1 and not for the rest; the production consumer inventory and metrics are
outstanding. See
[`docs/architecture/table-ownership-catalog.md`](architecture/table-ownership-catalog.md).

**Rollback:** documentation and guardrails only; remove a faulty guard without runtime
impact.

## Phase 1 — Split EF contexts, keep one physical database

**Why now:** this is the lowest-risk enforceable boundary. It reduces model and migration
coupling without changing hostnames, table locations, or data.

**Status:** in progress. Extraction steps 1–2 (Attachments, Platform catalogs, Valuation,
Identity) are complete; steps 3–5 are not, so the exit criteria below are not yet met.

**Before starting**

- Phase 0 ownership catalog is approved. **Met** (2026-07-30).
- ADR 0006's deploy-time migration path works against a restored production-like database.
  **Not met.** Step 1 proceeded anyway on the recorded judgment that it moves no data, emits
  no DDL beyond empty baselines, and can be rolled back by re-pointing services at the legacy
  context. This prerequisite still gates steps 2–5.
- Current legacy migrations can build a blank database and upgrade a representative
  existing database. Explicitly validate the generated `xmin` migration SQL. **Half met:**
  the blank-database half passes and shows the `xmin` migration is DDL-neutral on this
  PostgreSQL/Npgsql pair; the upgrade half needs a restore that is not available here.

**Work**

1. Add `IdentityDbContext`, `CaseStudyDbContext`, `PlatformDbContext`,
   `FailuresDbContext`, `OperationsDbContext`, `ValuationDbContext`,
   `AttachmentsDbContext`, and `FinancialDbContext`. Initially map existing table and
   schema names; do not relocate ambiguous tables.
2. Add service-local messaging contexts. While all services share one database, these may
   map the current `messaging` tables, but each outbox row and inbox claim must have a
   defined service owner. Do not make one context that exposes all messaging rows forever.
3. Move one vertical slice at a time. Its new context is the only writer. Unmoved slices
   remain on `ApplicationDbContext`; do not add new mappings to it.
4. Move model configuration beside its owner. Keep PostgreSQL integration tests for
   schema mapping, `xmin`, transactions, and migrations.
5. Give each context a migrations assembly, model snapshot, and schema-specific migrations
   history table. Freeze the legacy stream at a named cutover. The deploy migrator applies
   legacy-through-cutover, then context streams in a fixed order.
6. Replace cross-context LINQ. Use an owner interface/API, event-fed local projection, or
   explicitly read-only reporting context. Shared `DbConnection`/`DbTransaction` is allowed
   only as a time-boxed bridge for a transaction already inside the shared database.

**Suggested extraction order**

1. Attachments, Platform catalogs, and Valuation: small contexts with relatively few sets.
   **Done (2026-07-30).**
2. Identity: isolate Identity stores; other APIs validate JWT claims and stop registering
   `AddIdentityInfrastructure`. **Done (2026-07-30)** — `IdentityDbContext` owns writes;
   non-Identity APIs use `AddClaimsPermissionService` / JWT claims. Transitional Identity
   *reads* remain on the legacy context until Phase 3.
3. Failures and Operations: replace their known Case Study/Identity/Financial reads. Not
   started.
4. Financial and Case Study: largest and most entangled; move after contracts/projections
   exist. Not started.
5. Messaging: final service-local shape depends on producer/consumer ownership established
   above. Not started; the per-producer outbox mapping from D5 is in place for Valuation as a
   forward-compatible step.

**Exit criteria** (state after extraction step 1)

- Each API resolves only its owned write contexts. **Partially met** — Identity stores are
  Identity-only; every API still registers `AddPersistence` for the legacy context. The
  extracted contexts are additional, not exclusive, except Identity writes.
- Every table is writable through exactly one context. **Met for the extracted tables** and
  enforced by `BoundedContextBoundaryTests`; the unmoved slices still share the legacy
  context, which is one context per table but not one context per owner.
- No new migration touches another context's schema. **Met and enforced**; the legacy stream
  is frozen at the catalogued cutover.
- Blank-build and upgrade tests pass for the legacy baseline plus every context stream.
  **Partially met** — blank build passes; the production-like upgrade test is outstanding.
- `ApplicationDbContext` has no runtime registrations or remaining write path. **Not met**,
  and cannot be until step 5.

**Rollback:** route the current vertical slice back to the legacy context while tables are
still unchanged. Do not delete the legacy stream or context until the exit criteria hold
for a full release window.

## Phase 2 — Split Domain, Application, and Infrastructure libraries

**Why after context ownership:** project boundaries should encode proven data and behavior
ownership, not guesses based on folders.

**Before starting**

- The target slice has a single context and no unclassified cross-boundary transaction.
- Public API and integration contracts for that slice have compatibility tests.

**Work**

- Create bounded-context Domain/Application/Infrastructure projects and move a complete
  slice: entities and rules, interfaces/use cases/DTOs, persistence and adapters, then API
  registration.
- Replace the global `DependencyInjection` class with context-local registration.
- Keep `Shared.Contracts` restricted to versioned integration events. Keep
  `Shared.Web` restricted to hosting concerns. Move `PlatformCapabilities` out of the
  global Application dependency into a small stable authorization contract or claims
  representation so `Shared.Web` can stand alone.
- Keep DTOs local unless another process consumes them as a versioned contract.
- Give Reporting its own read-model application/infrastructure; do not reference all
  operational domain libraries to recreate current joins.
- Remove each API's references to global Application, Infrastructure, and Domain as its
  last slice moves.

**Exit criteria**

- A change in one bounded-context library does not rebuild unrelated APIs.
- Dependency tests enforce: API -> own Application/Infrastructure; Infrastructure -> own
  Application/Domain; shared libraries -> no domain implementation.
- No service-local code is moved into `Shared.*` merely to break a cycle.
- The three global projects have no runtime consumers and can be archived/removed.

**Rollback:** retain forwarding adapters/type shims for one compatibility window. Revert a
single slice's project references; database state is unchanged.

## Phase 3 — Remove cross-boundary database access

**Why before moving data:** database separation should be a connection-string change plus
data cutover, not the moment behavioral coupling is discovered.

**Before starting**

- Per-context libraries and ownership metrics are stable.
- Event consumers have inbox dedupe, replay tests, lag alerts, and reconciliation jobs.
- Synchronous owner APIs have timeouts, circuit behavior, authorization, and versioned
  contracts.

**Replacement work**

- **Notifications:** Platform owns notification rows and list/mutation endpoints. Case
  Study, Failures, Financial, and Operations publish notification-request events; Platform
  resolves recipients and writes its local rows. If recipient resolution requires Identity
  or Case Study data, maintain a Platform projection or call the owner—do not read their
  tables. Decide whether real-time push is emitted from the same Platform transaction via
  its outbox.
- **Failures/workflow:** Failures owns failure lifecycle. Publish failure-status projections
  to Case Study, or call Failures synchronously only where task progression requires
  current authoritative status.
- **Financial/reporting:** Financial owns invoices, charges, pricing, and statements.
  Case Study consumes invoice/charge status projections. Reporting builds denormalized
  projections from events and reconciliation, replacing joins across financial,
  case-study, and identity.
- **Operations:** resolve ownership of `OperationsTasks`. Move court-visit charge creation
  behind Financial commands/events and user labels behind Identity contracts/projections.
- **Attachments:** other contexts store attachment IDs and query the Attachments API;
  eliminate direct `FileAttachments` checks from billing and party-submission services.
- **Reference data:** Platform owns courts/regions/configuration and publishes versioned
  snapshots or serves cacheable APIs.

For each replacement, run shadow reads and compare old/new results before switching. Keep
reconciliation keyed by stable IDs; never use display names as cross-service keys.

**Exit criteria**

- Schema-limited database roles pass integration and end-to-end tests for every API.
- Runtime query logs show no service reading another owner's schema for one full release
  window.
- No transaction writes more than one owner's schema.
- Reporting and notification projections meet documented freshness and reconciliation
  tolerances.

**Rollback:** switch reads to the old path while the shared database remains available.
Keep event publication active and replayable so projections catch up; never dual-write two
authoritative stores without deterministic reconciliation.

## Phase 4 — Split databases one service at a time

**Why last:** by this point physical separation enforces an already-operating contract.
Start with a low-coupling context, not Case Study or Financial.

**Before each service**

- Phase 3 criteria hold for that service.
- Restore, copy, change-data-capture or bounded-downtime plan, checksums, row counts,
  sequence values, grants, and rollback thresholds are tested on production-scale data.
- Its deploy migrator, outbox dispatcher, inbox, monitoring, backup, and on-call runbook
  are independent.
- No cross-database foreign key or distributed transaction is required.

**Work per service**

1. Provision the target database and least-privilege runtime/migrator identities.
2. Apply the service's migrations and bulk-copy only owned tables.
3. Catch up changes with CDC or a bounded write pause. Validate counts, checksums, sampled
   aggregates, and business invariants.
4. Shadow-read the target, then canary one instance.
5. Switch all service instances and its dispatcher/consumers.
6. Monitor errors, latency, event lag, reconciliation, and old-database writes.
7. Revoke old write access after the rollback window; remove old tables only in a later,
   separately approved release.

**Suggested order:** Attachments or Platform catalogs first, then Valuation, Identity,
Failures, Operations, Financial, and Case Study. This is a hypothesis to validate with
Phase 0 production traffic and data-volume evidence; it is not fixed by repository
structure. Reporting may use its own projection database once event coverage is adequate.

**Exit criteria per service**

- All traffic and background work use the target database.
- Zero writes hit the old schema for the agreed window.
- Reconciliation is clean and restore has been demonstrated.
- Runtime credentials cannot access another service database.

**Rollback:** stop/canary rollback before revoking old writes; reverse catch-up any writes
accepted by the new database using the tested change log, then restore the old connection.
After destructive cleanup, rollback means restore and is a new incident procedure, which
is why cleanup is delayed.

## Phase 5 — Remove transitional compatibility

**Before starting:** every service has passed its rollback window and reconciliation is
clean.

Remove the legacy context/migration bootstrap, cross-schema grants, forwarding adapters,
dual-read flags, shared-default connection fallback in deployed environments, and copied
tables. Archive ownership maps and supersede transitional ADRs with the final topology.

**Exit criteria:** build and deployment graphs, credentials, migrations, backups,
dashboards, and on-call ownership are service-scoped; no central dispatcher or shared
database is required for an unrelated service to operate.

## Principal risks and controls

- **Boundary chosen incorrectly:** ownership catalog, vertical slices, and shared-database
  trial period before data movement.
- **Lost/duplicated events:** transactional outbox, per-consumer inbox, stable event IDs,
  replay and reconciliation. At-least-once delivery remains explicit.
- **Stale projections:** lag SLOs, age metrics, owner API for invariants that cannot accept
  eventual consistency.
- **Migration divergence:** frozen baseline, per-context history tables, single deploy
  migrator, blank and upgrade tests.
- **Partial dual-write:** avoid it; use one authority plus CDC/events. Where unavoidable,
  record an idempotent change log and reconciliation owner.
- **Connection growth after context/database split:** measure pool counts per process and
  set budgets before adding databases.
- **Large rebuild with little operational gain:** stop after any phase if measured coupling
  and deployment pain do not justify the next physical split. Context and assembly
  boundaries are useful even if selected schemas remain in one database.

## Open decisions

- Long-term owner of inspector-fee ledgers, disbursement batches, operations tasks, and
  document-reference counters.
- Freshness tolerance for financial/management reports and notification recipient data.
- Whether Identity user display data is served synchronously or projected.
- Production-only direct SQL/BI consumers and cross-schema PostgreSQL objects; repository
  inspection cannot verify them.
- Cutover order after production traffic, table sizes, and recovery objectives are known.
