/**
 * App-wide browser event names — the one registry.
 *
 * What: every `window.dispatchEvent` / `window.addEventListener` name the apps use to tell each
 * other "something changed" lives here as an exported constant. Screens import the constant;
 * nobody types the string by hand.
 *
 * How it works: plain string constants, grouped by the area that fires them. The value is the
 * wire name — changing one breaks every listener that still has the old name in a running tab,
 * so values are never renamed in place.
 *
 * Edge cases:
 * - Fixed (2026-11-04): the same names were typed in several files (e.g.
 *   "field-inspection-submission-changed" in five, "evaluator-submission-changed" in three),
 *   and tiny one-line files existed only to share a name between apps. All of them now import
 *   from here; tests/architecture/app-event-registry.test.ts keeps it that way.
 * - Not here, on purpose: names owned by packages below app-shared in the dependency graph,
 *   which cannot import it — `@platform/auth-client` (`AUTH_CHANGED_EVENT`, `AUTH_EXPIRED_EVENT`,
 *   in src/session.ts) and `@platform/offline-client`
 *   (`OFFLINE_PENDING_EVENT`, `OFFLINE_SYNC_EVENT`, `OFFLINE_LEASE_EVENT`, `OFFLINE_PURGED_EVENT`,
 *   `OFFLINE_ATTACHMENT_MAP_EVENT`, in src/types.ts). Import those from their package.
 * - No emit/listen helpers on purpose: the dispatch sites differ (`Event` vs `CustomEvent`, with
 *   or without `detail`) and `useWindowEvents` (hooks/useWindowEvents.ts) already covers the
 *   listener side, so a constant import is all the call sites need.
 * - Notification `sourceEvent` keys (e.g. "distribution-assigned:<id>") are inbox record keys,
 *   not window events, and stay with the notification code.
 */

// ── Workflow tasks, work orders, PO intake ────────────────────────────────────────────────

/** Workflow tasks were written (create, assign, phase change). */
export const TASKS_CHANGED_EVENT = "eval-workflow-tasks-changed";

/** Operations tasks list changed (case-study operations screen). */
export const OPERATIONS_TASKS_CHANGED_EVENT = "eval-operations-tasks-changed";

/** Any work order (PO) changed. */
export const WORK_ORDERS_CHANGED_EVENT = "work-orders-changed";

/** One property of a work order changed; `detail` names the PO. */
export const WORK_ORDER_PROPERTY_CHANGED_EVENT = "work-order-property-changed";

/** Saving the PO intake draft failed; `detail` carries the error text. */
export const PO_INTAKE_DRAFT_SAVE_FAILED_EVENT = "po-intake-draft-save-failed";

/** The viewer's favourite properties changed (this tab). */
export const FAVORITE_PROPERTIES_CHANGED_EVENT = "favorite-properties-changed";

/** A transaction was suspended or released. */
export const SUSPENDED_TRANSACTIONS_CHANGED_EVENT = "suspended-transactions-changed";

// ── Case study ────────────────────────────────────────────────────────────────────────────

/** Switch the case-study workspace to تبويب مدخلات المعاين (deed↔nature match). */
export const CASE_STUDY_WORKSPACE_OPEN_APPRAISAL_EVENT = "case-study-workspace-open-appraisal";

/**
 * The case-study question catalog changed. Edge case: the wire name is the older
 * "field-dictionary-changed"; nothing in the apps fires it today, the query still listens.
 */
export const CASE_STUDY_QUESTION_CATALOG_CHANGED_EVENT = "field-dictionary-changed";

/**
 * The deed ↔ nature match was saved from «مدخلات المعاين» — the report editor holds its own copy of the
 * report and kept the issue button on the old outcome until a reload (A→Z test 2026-10-29).
 */
export const CASE_STUDY_DEED_MATCH_CHANGED_EVENT = "case-study-deed-match-changed";

/** A party's case-study report changed; `detail` names the task. */
export const PARTY_CASE_STUDY_REPORT_CHANGED_EVENT = "party-case-study-report-changed";

/** The case-study info roles matrix (settings) changed. */
export const CASE_STUDY_INFO_ROLES_CHANGED_EVENT = "case-study-info-roles-changed";

// ── Party submissions (inspector, engineering office, appraiser) ──────────────────────────

/** The field inspector's submission (draft or sent) changed. */
export const FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT = "field-inspection-submission-changed";

/** The engineering office's survey submission changed. */
export const ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT = "engineering-survey-submission-changed";

/** The appraiser's submission (local draft or sent) changed. */
export const EVALUATOR_SUBMISSION_CHANGED_EVENT = "evaluator-submission-changed";

/**
 * Appraiser recall changed / loaded. Edge case: nothing fires these today (recalls moved to the
 * party-task recall events below); the page-situation hook still listens, so they are kept.
 */
export const EVALUATOR_RECALL_CHANGED_EVENT = "evaluator-recall-changed";
export const EVALUATOR_RECALL_HYDRATED_EVENT = "evaluator-recall-hydrated";

/** A party task recall was requested, decided or withdrawn. */
export const PARTY_TASK_RECALL_CHANGED_EVENT = "party-task-recall-changed";

/** Party task recalls were loaded from the server into the cache. */
export const PARTY_TASK_RECALL_HYDRATED_EVENT = "party-task-recall-hydrated";

/** A party asked to recall a task (inbox + toast rule). */
export const PARTY_TASK_RECALL_REQUESTED_EVENT = "party-task-recall-requested";

/** Fired only after an explicit user submit action (e.g. save and send survey). */
export const ENGINEERING_SURVEY_SUBMITTED_EVENT = "engineering-survey-submitted";

/** Specialist returned survey outputs for correction. */
export const ENGINEERING_SURVEY_RETURNED_EVENT = "engineering-survey-returned";

/** Specialist accepted survey outputs (fee accrual). */
export const ENGINEERING_SURVEY_ACCEPTED_EVENT = "engineering-survey-accepted";

/** Fired only after the appraiser submits their report. */
export const EVALUATOR_SUBMITTED_EVENT = "evaluator-submitted";

// ── Valuation (appraiser + specialist) ────────────────────────────────────────────────────

/**
 * Fired with the gates every fresh hand-over check read, so the «المراجعة النهائية» list shows what
 * the refusal just said (not the gates the screen loaded earlier).
 */
export const HANDOVER_GATES_READ_EVENT = "evaluator:handover-gates-read";

/** The specialist's finishing level for the valuation report changed. */
export const VALUATION_SPECIALIST_FINISHING_CHANGED_EVENT =
  "ejadah-valuation-specialist-finishing-changed";

/** Fired when confirm is blocked because finishing was left empty. */
export const VALUATION_SPECIALIST_FINISHING_REQUIRED_EVENT =
  "ejadah-valuation-specialist-finishing-required";

// ── Failures ──────────────────────────────────────────────────────────────────────────────

/** A failure (تعذّر) was raised or resolved in this browser. */
export const FAILURES_CHANGED_EVENT = "failures-changed";

/** The failure types list (settings) changed. */
export const FAILURE_TYPES_CHANGED_EVENT = "failure-types-changed";

// ── Notifications and toasts ──────────────────────────────────────────────────────────────

/** The stored notification list changed. */
export const NOTIFICATIONS_CHANGED_EVENT = "ree-notifications-changed";

/** A new notification was pushed into the store; `detail` is the notification. */
export const NOTIFICATION_PUSHED_EVENT = "ree-notification-pushed";

/** Toast only — does not sync to server (e.g. inbox pull from API). */
export const NOTIFICATION_TOAST_EVENT = "ree-notification-toast";

/**
 * Plain toast message (`detail: { message }`) from the shell's session / offline watchers.
 * Edge case: no listener handles it today; kept so the dispatch sites behave as before.
 */
export const APP_TOAST_EVENT = "ejada-toast";
