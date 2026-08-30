/**
 * Storage facade — prefer these paths for new code.
 * Implementations still live under `lib/prototype/*` until fully relocated.
 */

export {
  loadInfathDeposit,
  saveInfathDeposit,
  type InfathDepositDraft,
} from "../prototype/infath-deposit-storage";
export {
  loadSpecialistEsgInputs,
  saveSpecialistEsgInputs,
  emptySpecialistEsgInputs,
  type SpecialistEsgInputs,
  type SpecialistEsgGroup,
  VALUATION_SPECIALIST_ESG_CHANGED_EVENT,
} from "../prototype/valuation-report-specialist-esg";
export {
  loadSpecialistFinishingLevel,
  saveSpecialistFinishingLevel,
  type SpecialistFinishingLevel,
  VALUATION_SPECIALIST_FINISHING_CHANGED_EVENT,
} from "../prototype/valuation-report-specialist-finishing";
export {
  loadSpecialistSearchScopeNotes,
  saveSpecialistSearchScopeNotes,
  VALUATION_SPECIALIST_SEARCH_SCOPE_CHANGED_EVENT,
} from "../prototype/valuation-report-specialist-search-scope";
export {
  loadSpecialistPrintAttachmentKeys,
  saveSpecialistPrintAttachmentKeys,
  printKeyForPropertyDocument,
  VALUATION_PRINT_KEYS_CHANGED_EVENT,
} from "../prototype/valuation-print-attachment-keys";
