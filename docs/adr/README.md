# Architecture Decision Records

This directory records decisions that materially constrain the backend architecture. Dates
are decision-record dates, not necessarily the first date the code implemented the choice.

| ADR | Status | Decision |
| --- | --- | --- |
| [0001](0001-shared-database-schema-per-service.md) | Accepted (transitional) | Keep one PostgreSQL database with schema-per-service while ownership boundaries are established |
| [0002](0002-decompose-shared-application-infrastructure.md) | Accepted | Replace the shared `Application` and `Infrastructure` assemblies with bounded-context libraries |
| [0003](0003-split-application-db-context.md) | Accepted | Split the 53-`DbSet` context and its single migration stream before splitting databases |
| [0004](0004-transactional-outbox-consumer-inbox.md) | Accepted | Use transactional outbox delivery and a consumer inbox for integration events |
| [0005](0005-postgresql-xmin-optimistic-concurrency.md) | Accepted | Use PostgreSQL `xmin` optimistic-concurrency tokens and return HTTP 409 on conflicts |
| [0006](0006-deploy-time-database-migrations.md) | Proposed — implementation in flight | Move schema migration from Case Study process startup to a deploy-time step |

The decomposition sequence and gates are in
[`docs/architecture-split-plan.md`](../architecture-split-plan.md).

## Status meanings

- **Proposed:** agreed target, not yet the repository's effective behavior.
- **Accepted:** the governing decision.
- **Accepted (transitional):** intentional current state with explicit exit conditions.
- **Superseded:** retained for history; a later ADR governs.
