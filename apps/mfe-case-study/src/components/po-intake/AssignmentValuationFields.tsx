"use client";

import { RegSelect } from "@platform/app-shared/registration/FormFields";
import {
  VALUATION_PURPOSE_OPTIONS,
  VALUE_BASIS_OPTIONS,
  VALUE_PREMISE_OPTIONS,
  assignmentValuationDefaults,
  basisKeyForPremise,
  coercePremiseForBasis,
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
  const resolvedBasis = basisKey || defaults.basisKey;
  const resolvedPremise = coercePremiseForBasis(
    resolvedBasis,
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
        value={resolvedBasis}
        options={VALUE_BASIS_OPTIONS}
        hint={
          resolvedBasis === defaults.basisKey ? DEFAULT_HINT : undefined
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
        options={VALUE_PREMISE_OPTIONS}
        hint={resolvedPremise === defaults.premiseKey ? DEFAULT_HINT : undefined}
        onChange={(next) => {
          const nextBasis = basisKeyForPremise(next, resolvedBasis);
          if (nextBasis !== resolvedBasis) onBasisChange(nextBasis);
          onPremiseChange(next);
        }}
      />
    </>
  );
}
