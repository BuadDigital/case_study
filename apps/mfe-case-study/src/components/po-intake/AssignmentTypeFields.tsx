"use client";

import { RegSelect } from "@platform/app-shared/registration/FormFields";
import {
  ASSIGNMENT_PRIMARY_OPTIONS,
  assignmentCompositeTag,
  assignmentPrimary,
  assignmentSecondary,
  assignmentTypeFromParts,
  secondaryOptionsForPrimary,
  type AssignmentPrimary,
  type AssignmentSecondary,
  type AssignmentType,
} from "../../lib/app-data/po-intake-data";

type Props = {
  value: AssignmentType | "";
  onChange: (value: AssignmentType) => void;
  error?: string;
  /** When empty, primary/secondary start blank until chosen. */
  allowEmpty?: boolean;
};

export function AssignmentTypeFields({
  value,
  onChange,
  error,
  allowEmpty = false,
}: Props) {
  const primary: AssignmentPrimary | "" = value
    ? assignmentPrimary(value)
    : "";
  const secondary: AssignmentSecondary | "" = value
    ? assignmentSecondary(value)
    : "";
  const secondaryOptions = primary
    ? secondaryOptionsForPrimary(primary)
    : [];

  return (
    <>
      <RegSelect
        id="assignment_primary"
        label="التصنيف الأساسي"
        required
        options={[...ASSIGNMENT_PRIMARY_OPTIONS]}
        value={primary}
        error={error}
        placeholder={allowEmpty ? "اختر…" : undefined}
        onChange={(v) => {
          const nextPrimary = v as AssignmentPrimary;
          if (!nextPrimary) return;
          const options = secondaryOptionsForPrimary(nextPrimary);
          const keepSecondary =
            secondary && options.includes(secondary as AssignmentSecondary)
              ? (secondary as AssignmentSecondary)
              : options[0];
          onChange(assignmentTypeFromParts(nextPrimary, keepSecondary));
        }}
      />
      <RegSelect
        id="assignment_secondary"
        label="التصنيف الفرعي"
        required
        options={[...secondaryOptions]}
        value={secondary}
        disabled={!primary}
        placeholder={!primary ? "اختر الأساسي أولاً" : "اختر…"}
        hint={value ? `الوسم: ${assignmentCompositeTag(value)}` : undefined}
        onChange={(v) => {
          if (!primary || !v) return;
          onChange(
            assignmentTypeFromParts(primary, v as AssignmentSecondary),
          );
        }}
      />
    </>
  );
}
