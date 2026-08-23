"use client";

import { RegSelect } from "@platform/app-shared/registration/FormFields";
import {
  VALUATION_PURPOSE_OPTIONS,
  VALUE_BASIS_OPTIONS,
  VALUE_PREMISE_OPTIONS,
} from "@platform/app-shared/prototype/assignment-valuation-defaults";
import {
  basisOfValueForAssignment,
  defaultSubClientId,
  valuationPurposeForAssignment,
  valuePremiseForAssignment,
  type AssignmentType,
} from "../../lib/prototype/po-intake-data";

export function AssignmentValuationFields({
  assignmentType,
  subClientId,
  idPrefix,
}: {
  assignmentType: AssignmentType | "";
  subClientId?: string;
  idPrefix: string;
}) {
  if (!assignmentType) return null;

  const nabrId = subClientId || defaultSubClientId();
  const purpose = valuationPurposeForAssignment(assignmentType, nabrId);
  const basis = basisOfValueForAssignment(assignmentType, nabrId);
  const premise = valuePremiseForAssignment(assignmentType, nabrId);

  return (
    <>
      <RegSelect
        id={`${idPrefix}_valuation_purpose`}
        label="الغرض من التقييم"
        required
        value={purpose.key}
        options={VALUATION_PURPOSE_OPTIONS}
        hint="افتراضي"
        onChange={() => undefined}
      />
      <RegSelect
        id={`${idPrefix}_value_basis`}
        label="أساس القيمة"
        required
        value={basis.key}
        options={VALUE_BASIS_OPTIONS}
        hint="افتراضي"
        onChange={() => undefined}
      />
      <RegSelect
        id={`${idPrefix}_value_premise`}
        label="فرضية القيمة"
        required
        value={premise.key}
        options={VALUE_PREMISE_OPTIONS}
        hint="افتراضي"
        onChange={() => undefined}
      />
    </>
  );
}
