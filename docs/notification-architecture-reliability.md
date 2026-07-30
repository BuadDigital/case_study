# Notification architecture and remaining gaps

## Current stepping stone

- Platform owns notification inbox persistence and the list/read/delete API.
- Case Study and Failures resolve recipients, then publish
  `notification.users.requested.v1`; Platform consumes it idempotently and writes
  `UserNotifications`.
- A committed inbox row produces `notification.user.created.v1`. Each Platform process has
  an exclusive RabbitMQ queue for that event and forwards it only to SSE clients connected
  to that process. Browser polling remains the recovery path while RabbitMQ or SSE is down.
- The durable Platform notification consumer is a shared work queue. Realtime fan-out uses
  separate per-process queues, so persistence happens once while every Platform replica can
  serve its own live connections.

This is logical ownership, not physical database separation. All service connection names
still point to the shared database in the current deployment. Notification requests from
Failures and Case Study are therefore written to the same `messaging.OutboxMessages` table.
The **single Case Study `OutboxDispatcherHostedService`** drains that shared table using
leases and `FOR UPDATE SKIP LOCKED`. Failures intentionally must not register a competing
dispatcher while this topology remains shared.

Before any service receives a separate database, it needs its own outbox dispatcher and
broker credentials as part of that service's database cutover. Moving a connection string
without that dispatcher would strand events. No dual write or cross-database notification
claim is implemented here.

The notification uniqueness/index race is intentionally not changed in
`ApplicationDbContext`; that work is owned separately. Current source-event dedupe and
consumer inbox guarantees remain, but concurrent notification-row uniqueness still depends
on that pending index work.

## Canonical contract

- Tones: `info`, `success`, `warn`. Stored/wire `warning` remains readable as `warn`.
- Categories: `workflow`, `financial`, `failures`, `system`.
- Entity types: `property`, `task`, `operations-task`, `failure`, `work-order`.

Unknown legacy values are returned as no tone/category/entity type rather than breaking the
inbox. New backend writes are normalized to the canonical values.

## Billing negotiation deadline gap

Deadline notifications are not implemented because the product requirements explicitly say
there is currently no time limit or escalation for `disputed` pricing items. The implemented
workflow is state-based (`office-review` → `disputed` → `at-finance`) and has no negotiation
entity or deadline timestamp.

Product must define all of the following before implementation:

1. Deadline duration, start event, timezone, and whether business days/holidays apply.
2. Reminder offsets and whether reminders repeat.
3. Recipients for the engineering office, supervisor, and any escalation role.
4. Resolution/cancellation rules when the discount changes or the dispute is resolved.
5. Required escalation action after expiry (notification only, task creation, or state
   transition).
6. Stable dedupe key and audit wording for each reminder/escalation.

Once defined, add an explicit dispute deadline field (or a negotiation entity), a single
scheduled producer, idempotent source-event keys, and persistence/replay tests. Deriving an
arbitrary deadline from `UpdatedAtUtc` would invent policy and is deliberately avoided.
