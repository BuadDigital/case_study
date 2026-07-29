# ADR 0003: Split ApplicationDbContext before splitting databases

- **Status:** Accepted
- **Date:** 2026-07-29

## Context

`ApplicationDbContext` is an ASP.NET Identity context with 53 declared `DbSet`s and maps
tables across all nine schemas
(`backend/RealEstateEval.Infrastructure/Data/ApplicationDbContext.cs:8-64,66-860`).
The audit's 51-`DbSet` count predates the additions of `RefreshTokens` and
`ProcessedIntegrationEvents`. The current distribution is:

| Schema | Declared `DbSet`s |
| --- | ---: |
| `identity` | 4, plus the ASP.NET Identity sets inherited from `IdentityDbContext` |
| `case_study` | 16 |
| `platform` | 8 |
| `failures` | 2 |
| `operations` | 7 |
| `valuation` | 2 |
| `attachments` | 1 |
| `financial` | 10 |
| `messaging` | 3 |
| **Total** | **53** |

All APIs call `AddPersistence`, which registers that complete context model
(`backend/RealEstateEval.Infrastructure/DependencyInjection.cs:31-53`). All schema
changes share `backend/RealEstateEval.Infrastructure/Data/Migrations/` and
`ApplicationDbContextModelSnapshot`. This couples unrelated changes and prevents a service
from receiving a database role limited to its own tables.

Schema and business ownership are not identical. `case_study` contains
`OperationsTasks`, `InspectorFeeLedgers`, and `DisbursementBatches`; financial services
operate on some case-study tables; notifications are in `messaging`. Moving tables before
settling these owners would turn an EF refactor into a data migration.

## Decision

Introduce one EF Core context per bounded context while retaining the existing physical
database and current table/schema locations initially:

`IdentityDbContext`, `CaseStudyDbContext`, `PlatformDbContext`, `FailuresDbContext`,
`OperationsDbContext`, `ValuationDbContext`, `AttachmentsDbContext`,
`FinancialDbContext`, and service-local messaging contexts where events are produced or
consumed.

Each table has exactly one write context. Cross-boundary reads move to an owner API,
integration event plus local projection, or a reporting/read-model context with read-only
credentials. Do not recreate a god context under a different name.

Give each context its own migrations assembly, model snapshot, and migrations-history
table. The existing migration stream remains the immutable baseline: a deploy-time
migrator applies it through an agreed cutover migration, then applies the context-specific
streams. Baseline migrations must be tested against both an existing database and a blank
database before cutover.

Use a strangler transition. A vertical slice moves only when its tables, transactions,
queries, and tests can use the new context. The legacy context remains for unmoved slices
and is removed after the final slice; it must not receive new mappings.

## Consequences

- Model construction, migrations, credentials, and tests become context-scoped before
  data is moved.
- The first step changes code ownership without changing table names or network topology,
  keeping rollback practical.
- Cross-schema joins become visible migration work rather than silently available.
- Transactions spanning contexts require redesign. Sharing a connection/transaction is a
  short-lived compatibility technique only while the database is shared.
- ASP.NET Identity stores remain in the identity context; other services should validate
  claims and use identity contracts instead of registering Identity stores everywhere.

## Alternatives considered

- **Split the physical databases first.** Rejected: current queries and transactions span
  schemas and would fail immediately.
- **One context per API with overlapping entity mappings.** Rejected: multiple services
  would still believe they own the same rows and migrations.
- **One read/write god context plus smaller facade contexts.** Rejected as a target:
  compile-time and migration coupling remain. A facade is acceptable only as a measured,
  temporary adapter.
- **Move tables to conceptually cleaner schemas during context extraction.** Rejected for
  the first pass: simultaneous code and data movement enlarges rollback scope.
