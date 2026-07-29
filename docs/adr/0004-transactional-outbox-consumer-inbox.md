# ADR 0004: Transactional outbox and consumer inbox

- **Status:** Accepted
- **Date:** 2026-07-29

## Context

Domain changes and RabbitMQ publication cannot share an atomic transaction. Publishing
directly before commit can announce rolled-back data; publishing after commit can lose an
event if the process stops between the two operations.

The current implementation writes `messaging.OutboxMessages` through
`OutboxIntegrationEventPublisher`. `OutboxDispatcherHostedService` claims batches of 25
with a two-minute lease and PostgreSQL `FOR UPDATE SKIP LOCKED`, increments attempts in
the claim, retries up to 10 handler failures, and records `DeadLetteredAtUtc`
(`backend/RealEstateEval.Infrastructure/Integration/OutboxDispatcherHostedService.cs:9-22,77-194`).
Broker unavailability releases the lease and refunds the attempt so infrastructure
outages do not poison healthy messages (lines 95-120).

Consumers deduplicate through `messaging.ProcessedIntegrationEvents`, whose primary key is
`(Consumer, EventId)`. `IntegrationEventInbox.TryBeginAsync` handles racing deliveries by
letting that key reject the loser, and consumers release the claim after handler failure
so RabbitMQ redelivery can retry
(`backend/RealEstateEval.Infrastructure/Integration/IntegrationEventInbox.cs`;
`backend/services/case-study/RealEstateEval.CaseStudy.Api/Integration/ValuationIntegrationEventConsumer.cs:123-163`;
`backend/services/platform/RealEstateEval.Platform.Api/Integration/NotificationIntegrationEventConsumer.cs:129-172`).
The current inbox catches every `DbUpdateException` as though it were that duplicate-key
race (`IntegrationEventInbox.cs:36-47`). It must be narrowed to the expected PostgreSQL
unique-violation/key before this mechanism is treated as loss-safe; a different constraint
failure must reject/retry the delivery.

## Decision

Use at-least-once integration-event delivery:

1. Save the domain mutation and its outbox row in the same local database transaction.
2. Dispatchers claim rows with a lease and `FOR UPDATE SKIP LOCKED`; a crashed worker's
   lease expires.
3. Mark successful publication with `ProcessedAtUtc`.
4. Retry handler/payload failures within a budget of 10 attempts, then dead-letter the
   outbox row for explicit operational inspection and replay.
5. Each consumer inserts `(Consumer, EventId)` into its local inbox before handling.
   Duplicate insertion means the delivery is skipped. On handler failure, remove the
   claim before negatively acknowledging the message.

Handlers must be idempotent beyond inbox dedupe where they call external systems. Event
IDs and event types are stable contract fields. Dead-letter replay must preserve the
original event ID.

When databases are separated, each producing service owns an outbox and dispatcher in
its database, and each consumer owns its inbox in its database. The current shared
`messaging` schema and Case-Study-only dispatcher are transitional, not the target.

## Consequences

- A committed domain change is not silently separated from its event.
- Duplicate delivery remains possible by design; consumers explicitly absorb it.
- Publication order is creation order within a claimed batch, not a global ordering
  guarantee across workers or services.
- Lease duration, retry count, backlog age, dead-letter count, and replay require metrics
  and runbooks.
- `TryBeginAsync` records the claim before handler work, so every failure path must release
  it. A future atomic inbox-and-side-effect transaction is preferable when both use the
  same consumer database.
- Inbox persistence errors other than the known duplicate key must not be acknowledged as
  duplicates.

## Alternatives considered

- **Publish directly from request handlers.** Rejected: creates commit/publication gaps.
- **Exactly-once messaging.** Rejected: RabbitMQ and arbitrary side effects do not provide
  an end-to-end exactly-once guarantee; idempotent at-least-once handling is explicit.
- **In-memory dedupe.** Rejected: it is lost on restart and does not coordinate replicas.
- **One permanent central outbox.** Rejected: it couples all producers to one database and
  cannot be atomic with domain writes after database separation.
