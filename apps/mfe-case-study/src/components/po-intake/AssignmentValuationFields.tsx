"use client";

import { RegSelect } from "@platform/app-shared/registration/FormFields";
import {
  VALUATION_PURPOSE_OPTIONS,
  VALUE_BASIS_OPTIONS,
  assignmentValuationDefaults,
  coercePremiseForBasis,
  premiseOptionsForBasis,
} from "@platform/app-shared/app-data/assignment-valuation-defaults";
import { type AssignmentType } from "../../lib/app-data/po-intake-data";

const DEFAULT_HINT = "افتراضي";

export function AssignmentValuationFields({
  assignmentType,
  subClientId,
  idPrefix,
  purposeKey,
  basisKey,
  premiseKey,
  onPurposeChange,
  onBasisChange,
  onPremiseChange,
}: {
  assignmentType: AssignmentType | "";
  subClientId?: string;
  idPrefix: string;
  purposeKey: string;
  basisKey: string;
  premiseKey: string;
  onPurposeChange: (key: string) => void;
  onBasisChange: (key: string) => void;
  onPremiseChange: (key: string) => void;
}) {
  if (!assignmentType) return null;

  const defaults = assignmentValuationDefaults(assignmentType, subClientId);
  const premiseOptions = premiseOptionsForBasis(basisKey || defaults.basisKey);
  const resolvedPremise = coercePremiseForBasis(
    basisKey || defaults.basisKey,
    premiseKey || defaults.premiseKey,
  );

  return (
    <>
      <RegSelect
        id={`${idPrefix}_valuation_purpose`}
        label="الغرض من التقييم"
        required
        value={purposeKey || defaults.purposeKey}
        options={VALUATION_PURPOSE_OPTIONS}
        hint={
          (purposeKey || defaults.purposeKey) === defaults.purposeKey
            ? DEFAULT_HINT
            : undefined
        }
        onChange={onPurposeChange}
      />
      <RegSelect
        id={`${idPrefix}_value_basis`}
        label="أساس القيمة"
        required
        value={basisKey || defaults.basisKey}
        options={VALUE_BASIS_OPTIONS}
        hint={
          (basisKey || defaults.basisKey) === defaults.basisKey
            ? DEFAULT_HINT
            : undefined
        }
        onChange={(next) => {
          onBasisChange(next);
          onPremiseChange(coercePremiseForBasis(next, premiseKey));
        }}
      />
      <RegSelect
        id={`${idPrefix}_value_premise`}
        label="فرضية القيمة"
        required
        value={resolvedPremise}
        options={premiseOptions}
        hint={resolvedPremise === defaults.premiseKey ? DEFAULT_HINT : undefined}
        onChange={onPremiseChange}
      />
    </>
  );
}
