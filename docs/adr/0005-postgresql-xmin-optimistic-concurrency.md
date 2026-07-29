# ADR 0005: PostgreSQL xmin optimistic concurrency

- **Status:** Accepted
- **Date:** 2026-07-29

## Context

Several workflow records are read, changed, and saved by concurrent API requests and
background work. Last-write-wins updates can silently undo a transition made by another
actor.

`ApplicationDbContext.UseOptimisticConcurrency` maps a shadow `uint` property named
`Version` as `IsRowVersion()`. Npgsql maps that token to PostgreSQL's system `xmin`
column (`backend/RealEstateEval.Infrastructure/Data/ApplicationDbContext.cs:863-871`).
The helper is applied to 19 mutable entity types across identity, case-study, failures,
operations, valuation, and financial schemas. EF includes the loaded token in update and
delete predicates and raises `DbUpdateConcurrencyException` when no row matches.

`GlobalExceptionHandlerMiddleware` maps that exception to HTTP 409 Problem Details with
the instruction to reload and retry
(`backend/shared/RealEstateEval.Shared.Web/Middleware/GlobalExceptionHandlerMiddleware.cs:42-67`).

## Decision

Use PostgreSQL `xmin` as the EF Core optimistic-concurrency token for mutable aggregate
roots and workflow records where a stale write could overwrite a valid transition.
Expose a detected conflict as HTTP 409. Clients must reload current state, reapply an
intent only if still valid, and submit again; servers must not blindly retry business
updates.

Keep the token shadow-only unless an endpoint needs an explicit precondition contract. If
offline or detached updates become common, expose a stable version/ETag and require
`If-Match`; do not ask clients to understand PostgreSQL transaction IDs.

## Consequences

- No application-managed version column or trigger is required.
- Stale tracked writes are detected consistently by EF.
- `xmin` is PostgreSQL-specific and couples persistence behavior to Npgsql.
- HTTP 409 identifies the conflict but does not merge competing edits.
- Bulk SQL and `ExecuteUpdate` paths must supply equivalent concurrency predicates or be
  reviewed as deliberate exceptions.
- Tests must exercise two independent contexts against PostgreSQL; EF's in-memory provider
  cannot validate `xmin` behavior.

## Alternatives considered

- **Last write wins.** Rejected for workflow and financial records because valid
  transitions can be silently lost.
- **Application-managed integer/UUID version.** Viable and portable, but adds update
  discipline and schema columns. Reconsider if PostgreSQL portability becomes a goal.
- **Pessimistic row locks for all edits.** Rejected as the default: requests would hold
  locks while doing work and increase contention. Use narrow locks only for allocation or
  sequencing that optimistic checks cannot protect.
- **Return HTTP 500 on concurrency exceptions.** Rejected: a stale write is a client-visible
  state conflict, not an unknown server failure.
