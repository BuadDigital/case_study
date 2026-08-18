# ADR 0006: Apply database migrations at deploy time

- **Status:** Proposed — implementation in flight
- **Date:** 2026-07-29
- **Progress last reviewed:** 2026-08-18

## Context

The repository's effective behavior on this date is that only the Case Study API calls
`ApplicationDbContext.Database.MigrateAsync()` during startup, before optional demo-data
seeding (`backend/services/case-study/RealEstateEval.CaseStudy.Api/Program.cs:35-56`).
The other eight APIs register the same context but do not migrate.

This makes one runtime service the implicit owner of the shared schema. Startup can race
across Case Study replicas, application credentials require DDL rights, migration duration
affects readiness, and an incompatible schema change is coupled to process rollout. A
concurrent implementation effort is moving migrations to deployment automation. This ADR
describes the target; it does not claim that work is complete.

The current single stream contains every schema and one model snapshot. ADR 0003 will
eventually replace it with context-specific streams, but migration execution must be made
explicit before that split.

## Decision

Run EF migrations as a distinct, single-writer deploy-time job before application rollout.
Use a reviewed migration bundle or dedicated migrator built from the same revision being
deployed. Give that job DDL credentials; application services receive runtime DML
credentials only.

The deployment gate is:

1. back up or confirm point-in-time recovery;
2. acquire a deployment-level lock so only one migrator runs;
3. apply idempotently and record migration history;
4. run schema/readiness verification;
5. deploy application instances only after success.

Use expand-and-contract changes across releases: add compatible structures, deploy code
that can use old and new forms, backfill and verify, switch reads/writes, then remove old
structures in a later release. A failed migration stops rollout; application startup never
attempts a fallback migration.

While ADR 0003 is implemented, the migrator first applies the frozen legacy stream through
its cutover migration, then each context-specific stream in a fixed, documented order.

## Consequences

- Schema change becomes observable, serialized, and independently retryable.
- Runtime processes lose DDL permissions and start faster.
- Deployment automation becomes mandatory; local development needs an explicit migrate
  command or profile.
- Database rollback is not assumed. Roll forward is preferred; destructive migrations
  need a tested restore or reverse-data plan.
- Migration SQL must be tested against both an empty database and a production-like
  upgraded database. This is especially important for
  `20260729104156_AddOptimisticConcurrencyTokens`, which emits `AddColumn("xmin", ...,
  type: "xid", rowVersion: true)` for PostgreSQL system columns; compatibility must be
  proven against the deployed Npgsql/PostgreSQL versions before release.

## Implementation progress (2026-08-18)

The decision above is unchanged; this section records only how far it has been carried out.

- `backend/tools/DbMigrate` applies each bounded-context stream in
  `BoundedContextMigrations.ApplyOrder` to that owner's dedicated database. Production
  compose does not set the unsuffixed leftover variable. If
  `REAL_ESTATE_EVAL_PG_CONNECTION_STRING` is set, the migrator applies the frozen legacy
  `ApplicationDbContext` stream first (this ADR, including `xmin`), then the context
  streams. `list` and `rollback` are per-stream. An architecture test fails if a catalogued
  stream is missing from that order.
- Blank-database half: done (2026-07-29). Production-like upgrade half: done (2026-08-18)
  against a copy of the idle leftover shared database `realestate_eval_dev` on host
  Postgres 17.9 (`realestate_eval_a7_scratch`). `20260729104156_AddOptimisticConcurrencyTokens`
  applied; Npgsql/PostgreSQL 17 treat `xmin` as DDL-neutral (no user column; system `xmin`
  readable on preserved rows).
- The development-only Case Study startup path applies bounded-context streams only.
  Production still refuses `Database:MigrateOnStartup`.

## Alternatives considered

- **Keep Case Study startup migration.** Rejected as a target: service availability,
  schema ownership, and DDL privilege remain coupled.
- **Let every API migrate on startup.** Rejected: increases race and compatibility risk
  and still grants DDL rights to runtime identities.
- **Apply handwritten SQL manually.** Rejected as the normal path: difficult to reproduce,
  audit, and align with EF snapshots. Reviewed SQL remains useful for exceptional data
  migrations.
- **Require zero-downtime for every change immediately.** Rejected as an absolute rule;
  expand-and-contract is the default, while explicitly approved maintenance windows remain
  valid for exceptional changes.
