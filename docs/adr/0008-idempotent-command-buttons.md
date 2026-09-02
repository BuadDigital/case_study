# ADR 0008: Idempotent command buttons

**Status:** Accepted  
**Date:** 2026-09-02  
**Updated:** 2026-09-02

## Context

Command buttons (save, submit, approve, create user, register key, …) must not create
duplicate side effects when the user double-clicks, when the network retries, or when the
offline write queue replays a mutation.

The UI already has partial protection:

- `@platform/ui-kit` `Button` supports `loading` → `disabled` + `aria-busy`
- The global action-toast listener treats busy buttons as in-flight work

That only covers **one browser tab** and does not help **retries** or **multi-tab** submits.
Backend commands that create money, tasks, or identities need a stronger contract.

## Decision

Use three cooperating layers for mutating actions:

| Layer | Responsibility | Implementation |
| --- | --- | --- |
| **UI guard** | Ignore duplicate clicks while a call is in flight | `Button loading={…}` + `useCommandMutation` / `useIdempotentAction` |
| **Client key** | Stable key per user intent; reuse on retry, rotate on success | `createIdempotencyKey()` + `Idempotency-Key` request header |
| **Server dedupe** | Same key + same actor + same route → same outcome, no second write | Domain uniqueness first; optional header replay via `CommandIdempotencyMiddleware` |

### Frontend rules

1. Prefer **`useCommandMutation(mutate)`** for new command screens (binds payload + key).
2. Use **`useIdempotentAction`** when there is no args object to bind.
3. Every **command** button must wire `loading` from the hook.
4. Pass the hook's key to the API client via optional `idempotencyKey` / `withIdempotencyKey`.
5. On **success**, clear the key so the next click is a new intent (hooks do this).
6. On **failure**, keep the key so an explicit retry is idempotent.
7. Offline outbox items that represent a command **must store `idempotencyKey`** and replay it on flush.

### Backend rules

1. Prefer **domain idempotency** first (unique index, “already exists → return existing”).
2. Services using `UseRealEstateEvalServicePipeline` run **`CommandIdempotencyMiddleware`**:
   when `Idempotency-Key` is present on POST/PUT/PATCH/DELETE, successful (and 400/409)
   responses are replayed for the same actor + path + key (24h TTL).
3. **Store:** hosts with `AddMessagingPersistence` use durable
   `messaging.CommandIdempotencyRecords` (`EfCommandIdempotencyStore`). Other hosts fall back to
   process-local `MemoryCommandIdempotencyStore`.
4. Do not rely on UI-only disables for money-moving or identity-changing commands.

### Endpoint catalog (high-value commands)

| Command | Domain uniqueness | Client `Idempotency-Key` |
| --- | --- | --- |
| PO intake create | Work-order / PO constraints | Yes (`useCommandMutation`) |
| Distribution confirm / redistribute | Workflow task state | Yes |
| Bourse / Enfath complete | Task advance rules | Yes |
| Field inspection / evaluator / engineering submit | Party submission uniqueness | Yes |
| Specialist accept | Assignment state | Yes |
| Keys register / assignment / handoff | Envelope uniqueness | Yes |
| Failures raise | Case linkage | Yes |
| Case-study form submit | Form version / task | Yes |
| Enfaz issue + **collect** invoice | Invoice status transitions | Yes |
| Party billing close / disbursement | Settlement state | Yes |

New money-moving or identity-changing POST/PUT endpoints must either enforce domain
idempotency **or** document why the middleware header alone is sufficient.

## Consequences

- Shared hooks: `useCommandMutation`, `useIdempotentAction` in `@platform/app-shared`.
- API helper: `createIdempotencyKey` / `withIdempotencyKey` in `@platform/api-client`.
- Offline: `OfflineOutboxItem.idempotencyKey` replayed by shell sync.
- Durable store: `ICommandIdempotencyStore` + messaging migration `AddCommandIdempotencyRecords`.
- Cursor rule: `.cursor/rules/idempotent-command-buttons.mdc`.
- Existing screens migrate opportunistically; new command flows must use the hook from day one.

## Non-goals

- Idempotency for read-only buttons, navigation links, or tab switches.
- Replacing PostgreSQL `xmin` optimistic concurrency (ADR 0005) — that solves edit conflicts,
  not duplicate creates.
- Replacing domain unique constraints with header-only dedupe.
- Automatic purge job for expired `CommandIdempotencyRecords` (index exists; cleanup is follow-up).
