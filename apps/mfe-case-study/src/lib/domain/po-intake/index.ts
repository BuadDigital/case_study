/** Domain aliases for PO intake — re-exports app-data layer + local validation. */

export * from "../../app-data/po-intake-data";
export * from "./property-validation";
export * from "./property-bourse-validation";
export * from "./po-field-error-targets";
export {
  validatePropertyEnfathFields,
  mergePropertyEnfathValidation,
  firstEnfathValidationMessage,
} from "./property-enfath-validation";
