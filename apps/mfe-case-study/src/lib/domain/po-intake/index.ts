/** Domain aliases for PO intake — re-exports prototype data + local validation. */

export * from "../../prototype/po-intake-data";
export * from "./property-validation";
export * from "./property-bourse-validation";
export * from "./po-field-error-targets";
export {
  validatePropertyEnfathFields,
  mergePropertyEnfathValidation,
  firstEnfathValidationMessage,
} from "./property-enfath-validation";
