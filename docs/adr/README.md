# Architecture Decision Records

This directory records decisions that materially constrain the backend architecture. Dates
are decision-record dates, not necessarily the first date the code implemented the choice.

Statuses below are the **effective** state of the repository on 2026-09-20. The body of
each ADR keeps the original context; do not read a 2026-07 "not yet split" paragraph as
current fact.

| ADR | Status | Decision |
| --- | --- | --- |
| [0001](0001-shared-database-schema-per-service.md) | **Superseded** | One PostgreSQL database with schema-per-service while ownership was established. Exit: Phase 4 dedicated databases (2026-08). |
| [0002](0002-decompose-shared-application-infrastructure.md) | Accepted — remainder | Per-context libraries exist. Shared.Web does not reference Application. 2026-09-20: TimeProvider/cache/inbox + PermissionsDto in Shared.Contracts; identity/financial owner types in their Application libraries. Global Application still holds entity-shaped cross-service ports. |
| [0003](0003-split-application-db-context.md) | **Accepted — complete** | One EF context and migration stream per bounded context. `ApplicationDbContext` deleted (A10, tag `a10-legacy-stream-final`). |
| [0004](0004-transactional-outbox-consumer-inbox.md) | Accepted | Transactional outbox delivery and a consumer inbox for integration events. |
| [0005](0005-postgresql-xmin-optimistic-concurrency.md) | Accepted | PostgreSQL `xmin` optimistic-concurrency tokens; HTTP 409 on conflicts. |
| [0006](0006-deploy-time-database-migrations.md) | **Accepted** | Deploy-time `DbMigrate` job; production hosts do not migrate on startup. |
| [0007](0007-valuation-field-catalog.md) | Accepted | Valuation report field catalog ownership and injection rules. |
| [0008](0008-idempotent-command-buttons.md) | Accepted | Three-layer idempotency for command buttons (UI guard + client key + server dedupe). |

The decomposition sequence is in
[`docs/architecture-split-plan.md`](../architecture-split-plan.md). Phases 0–5 of that
plan are **done** (ownership catalog, context split, owner HTTP, dedicated databases,
legacy-context archival). D1/D2 tables relocated onto owner schema names on 2026-09-20.
Remaining tail: leftover entity-shaped ports in global Application (ADR 0002 remainder;
TimeProvider/cache/inbox + identity/financial owner types moved 2026-09-20). Metrics
instruments (HTTP p95, Npgsql pool, outbox backlog) ship over OTLP; live production
capture is an ops observation, not more code. Guardrails:
[`docs/architecture/table-ownership-catalog.md`](../architecture/table-ownership-catalog.md).
Current picture: [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md).

## Status meanings

- **Proposed:** agreed target, not yet the repository's effective behavior.
- **Accepted:** the governing decision, implemented.
- **Accepted — remainder:** the decision holds; a named leftover is still scheduled.
- **Accepted (transitional):** intentional current state with explicit exit conditions.
- **Superseded:** retained for history; a later ADR or completed phase governs.
