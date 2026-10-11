/**
 * Storage facade — prefer these paths for new code.
 * Implementations still live under `lib/app-data/*` until fully relocated.
 */

export {
  type SpecialistEsgInputs,
  type SpecialistEsgGroup,
} from "../app-data/valuation-report-specialist-esg";
export {
  loadSpecialistFinishingLevel,
  saveSpecialistFinishingLevel,
  type SpecialistFinishingLevel,
  VALUATION_SPECIALIST_FINISHING_CHANGED_EVENT,
} from "../app-data/valuation-report-specialist-finishing";
