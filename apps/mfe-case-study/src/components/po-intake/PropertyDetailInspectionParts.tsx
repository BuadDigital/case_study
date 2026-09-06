"use client";

/**
 * Property-detail inspection-tab parts — the stable import surface for the
 * inspection tab and the field-inspection wizard. Each part lives in its own
 * module; the pure rules sit in `property-detail-inspection-state.ts`.
 */

export {
  EDIT_CONTROL_CLASS,
  INS_LABEL_CLASS,
  INS_TH_CLASS,
  INS_TD_CLASS,
} from "../field-inspection/FieldInspectionWorkParts";
export { formatAcceptedDate } from "./property-detail-inspection-state";
export {
  InsField,
  InsEditField,
  InsEditSelect,
  InsEditTextarea,
  InsFieldsGrid,
} from "./PropertyDetailInspectionFields";
export { InsDualCalendarDateField } from "./PropertyDetailInspectionDateField";
export { SharedBadge, InsCard, ChipRow } from "./PropertyDetailInspectionCards";
export {
  PhotoTile,
  EditableFeaturePhotoCell,
  ComponentCountWithPhotoField,
} from "./PropertyDetailInspectionPhotos";
