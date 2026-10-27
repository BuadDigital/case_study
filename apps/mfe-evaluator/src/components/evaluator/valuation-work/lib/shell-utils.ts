export { apiConfig } from "../../../../lib/evaluator/api-config";

// Shared number formatter moved to the shared package — re-export so existing imports keep working.
export { fmt } from "@platform/app-shared/format/number";

/** non-blank justification — matches JustificationRules.MinLength on the server. */
export const JUSTIFICATION_MIN_LENGTH = 1;
