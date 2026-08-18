# 30-Day Risk Reduction Backlog

Date: 2026-08-18
Scope: Convert the 71-item risk list into an execution plan after A6 completion.

## Operating model

- Priority order: Security -> Reliability/Data consistency -> Delivery guardrails -> Architecture cleanup.
- Cadence: 4 weekly waves (W1-W4).
- Definition of done for each item: code merged, test added/updated, runbook updated, observable metric added.

## Owners

- **SEC**: Security/Auth owner
- **PLT**: Platform/API owner
- **DATA**: Persistence/DB owner
- **OPS**: DevOps/SRE owner
- **QA**: Test/quality owner

---

## Wave 1 (Days 1-7): Critical security containment

### A. Authentication and token safety

1. Remove username-only login from non-local environments.  
   - Risks: #1, #5  
   - Owner: SEC  
   - Acceptance:
     - Dev-login endpoints hard-disabled unless explicit local flag is true.
     - Startup fails fast if dev-login is enabled in non-development.

2. Rotate JWT signing keys and remove in-repo placeholder secrets.  
   - Risks: #2, #4, #47  
   - Owner: SEC + OPS  
   - Acceptance:
     - All services read signing key only from secret store/env.
     - No default placeholder fallback in production config.
     - Key rotation runbook created and tested once in staging.

3. Add refresh token + revocation path.  
   - Risks: #6  
   - Owner: SEC + PLT  
   - Acceptance:
     - Refresh token issuance, storage, revoke-all, revoke-single.
     - Role/disable changes invalidate refresh flow immediately.

### B. Access control and exposure

4. Add ownership/assignee authorization on all authenticated reads (close IDOR).  
   - Risks: #3  
   - Owner: PLT + QA  
   - Acceptance:
     - Policy tests for every read endpoint listed in audit.
     - Cross-user access returns 403/404 consistently.

5. Remove seeded production credentials and API-leaked temporary passwords.  
   - Risks: #31, #32  
   - Owner: SEC  
   - Acceptance:
     - Seeder credentials moved to one-time bootstrap path.
     - Create-user APIs no longer return raw passwords.

---

## Wave 2 (Days 8-14): Data consistency and messaging correctness

### A. Transactional correctness

6. Wrap multi-step state transitions in explicit transactions.  
   - Risks: #15  
   - Owner: DATA  
   - Acceptance:
     - Reopen/patch and pricing toggle paths are atomic.
     - Integration tests verify rollback semantics on induced failure.

7. Add optimistic concurrency to critical aggregates.  
   - Risks: #14, #39  
   - Owner: DATA  
   - Acceptance:
     - RowVersion/xmin configured on high-contention entities.
     - Conflict path returns deterministic 409 shape.

### B. Outbox/inbox and poison handling

8. Harden outbox delivery and consumer idempotency.  
   - Risks: #16, #53  
   - Owner: DATA + PLT  
   - Acceptance:
     - Lease/claim semantics prevent double-processing.
     - Consumer inbox table/idempotency checks in place for all event consumers.

9. Add bounded retries + DLQ for Rabbit consumers.  
   - Risks: #17  
   - Owner: OPS + PLT  
   - Acceptance:
     - Retry count and terminal DLQ policy configured.
     - Poison message alerting wired.

10. Fail fast when Rabbit publishing is disabled in environments that require events.  
    - Risks: #18  
    - Owner: PLT + OPS  
    - Acceptance:
      - Publish path returns failure, does not mark outbox processed.
      - Alert fires on dispatcher failure rate threshold.

---

## Wave 3 (Days 15-21): Ops and deploy safety

### A. Deployment hygiene

11. Move migrations/seed out of app startup in production (deploy-job only).  
    - Risks: #19  
    - Owner: OPS + DATA  
    - Acceptance:
      - Production startup has no DDL/seed path.
      - DbMigrate job is required and documented in release pipeline.

12. Add post-deploy smoke + rollback checklist.  
    - Risks: #23  
    - Owner: OPS + QA  
    - Acceptance:
      - Automated smoke: `/health`, `/ready`, key business flows.
      - Rollback script references previous immutable image tag.

13. Add PR-gated CI and branch protection.  
    - Risks: #22, #68  
    - Owner: OPS + QA  
    - Acceptance:
      - Tests run on PR.
      - Coverage artifact collected and minimum threshold enforced.

### B. Observability completeness

14. Production telemetry stack completion.  
    - Risks: #20, #46, #61  
    - Owner: OPS  
    - Acceptance:
      - Real service scraping (not Prometheus self-only).
      - Dashboards for latency, errors, outbox lag, consumer lag.
      - Structured logs with correlation ID propagation.

15. Reporting resiliency policies for upstream HTTP calls.  
    - Risks: #21  
    - Owner: PLT  
    - Acceptance:
      - Timeouts, retries with jitter, and circuit breaker.
      - Fallback behavior + metrics on open circuit.

---

## Wave 4 (Days 22-30): Performance + architecture debt burn-down

### A. Query and indexing risks

16. Add pagination limits and default caps for list/report endpoints.  
    - Risks: #11  
    - Owner: PLT + DATA  
    - Acceptance:
      - Non-zero default cap and max cap globally enforced.

17. Fix in-memory heavy aggregations and N+1 fan-out paths.  
    - Risks: #12, #13, #40  
    - Owner: PLT + DATA  
    - Acceptance:
      - Server-side aggregation for financial summaries.
      - Batched notification recipient resolution.

18. Add missing hot-path indexes and validate query plans.  
    - Risks: #38  
    - Owner: DATA  
    - Acceptance:
      - Index migrations merged and benchmarked.
      - p95 latency reduced on targeted endpoints.

### B. A6.1 compatibility cleanup

19. Remove transitional legacy shims after proving no callers.  
    - Risks: residual from A6 notes  
    - Owner: PLT + DATA  
    - Targets:
      - `PersonLabelResolver` legacy overload cleanup
      - `UserLabelLookup` legacy fallback path cleanup
      - Any remaining host/runtime dependency on legacy behavior

---

## Cross-cutting acceptance checklist

- Security:
  - No hardcoded secrets in tracked files.
  - No dev-auth endpoints reachable in staging/prod.
  - JWT/refresh revocation tested.

- Reliability:
  - At-least-once event flow with idempotent consumers proven.
  - No known partial-write transition paths.

- Ops:
  - PR CI required before merge.
  - Post-deploy smoke and rollback rehearsed once.

- Quality:
  - API integration coverage expanded for high-risk controllers.
  - Add real infra tests (Postgres/Rabbit/Redis) for critical paths.

---

## Mapping table (highest-risk first)

- Week 1 covers: #1, #2, #3, #4, #5, #6, #31, #32, #47
- Week 2 covers: #14, #15, #16, #17, #18, #39, #53
- Week 3 covers: #19, #20, #21, #22, #23, #46, #61, #68
- Week 4 covers: #11, #12, #13, #38, #40 + A6.1 residual cleanup

Remaining medium/low hygiene items (#24-#71 not listed above) should be batched into a
separate 60-90 day engineering quality program after this 30-day stabilization window.
