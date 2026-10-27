"use client";

import { useMemo } from "react";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import type { FailureSeverity } from "@platform/app-shared/failures/failures-types";
import { filterFailureCategoriesForRole, filterFailureProblemTypesForRole } from "../../lib/failure-category-role-visibility";
import {
  FAILURE_PROBLEM_TYPES,
  FAILURE_TYPE_CATEGORIES,
  type FailureProblemType,
} from "../../lib/failure-types-data";
import { useFailureTypesQuery } from "../../query/failure-types-queries";
import { FailureChoiceCards, type FailureChoice } from "./FailureChoiceCards";
import { FailureTypeMenuSelect } from "./FailureTypeMenuSelect";

const labelClassName =
  "mb-[7px] block text-[12px] font-semibold text-text-2";

const SEVERITY_OPTIONS: FailureChoice<FailureSeverity>[] = [
  { value: "internal", label: "تعذّر داخلي", hint: "يوقف العمل على العقار" },
  { value: "suspected", label: "احتمال تعذّر", hint: "العمل يستمر، ويتابعه الأخصائي" },
];

/**
 * The raise fields: the failure's degree (possible / internal) when `onSeverityChange` is
 * passed, then the catalog dropdown — failure type from `/failure-types`, filtered by role.
 *
 * How it works: «درجة التعذّر» is a two-card radio (`FailureChoiceCards`), internal by default;
 * the dropdown groups the role's problem types under their categories.
 *
 * Edge cases: every raise used to be recorded internal — the server accepted «احتمال تعذّر» but
 * no screen let anyone choose it. The degree is opt-in per caller, so the final-failure dialog
 * reuses only the dropdown. It is labelled «درجة التعذّر» because «نوع التعذّر» already names
 * the dropdown.
 */
export function FailureRaiseFields({
  problemTypeId,
  onProblemTypeChange,
  severity = "internal",
  onSeverityChange,
  idPrefix = "fail",
  invalid = false,
  disabled = false,
  autoFocus = false,
}: {
  problemTypeId: string;
  onProblemTypeChange: (value: string) => void;
  severity?: FailureSeverity;
  onSeverityChange?: (value: FailureSeverity) => void;
  idPrefix?: string;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const { role } = useAppAccess();
  const { data: catalog, isPending, isError } = useFailureTypesQuery();

  const catalogCategories =
    catalog?.categories?.length ? catalog.categories : FAILURE_TYPE_CATEGORIES;
  const catalogTypes =
    catalog?.problemTypes?.length ? catalog.problemTypes : FAILURE_PROBLEM_TYPES;

  const categories = useMemo(
    () =>
      filterFailureCategoriesForRole(role, catalogCategories).sort(
        (a, b) => a.order - b.order,
      ),
    [catalogCategories, role],
  );

  const problemTypes = useMemo(
    () =>
      filterFailureProblemTypesForRole(role, catalogTypes).sort(
        (a, b) => a.order - b.order,
      ),
    [catalogTypes, role],
  );

  const groups = useMemo(
    () =>
      categories
        .map((category) => ({
          category,
          types: problemTypes.filter((t) => t.categoryId === category.id),
        }))
        .filter((g) => g.types.length > 0),
    [categories, problemTypes],
  );

  const waiting = isPending && !isError && !catalog;

  const selected = problemTypes.find((t) => t.id === problemTypeId);

  return (
    <div className="min-w-0 w-full">
      {onSeverityChange ? (
        <FailureChoiceCards
          id={`${idPrefix}_severity`}
          label="درجة التعذّر"
          options={SEVERITY_OPTIONS}
          value={severity}
          onChange={onSeverityChange}
          disabled={disabled}
        />
      ) : null}
      <label htmlFor={`${idPrefix}_problem_type`} className={labelClassName}>
        نوع التعذّر{" "}
        <span className="font-bold text-[#c0553d]" aria-hidden>
          *
        </span>
      </label>
      <FailureTypeMenuSelect
        id={`${idPrefix}_problem_type`}
        value={problemTypeId}
        onChange={onProblemTypeChange}
        groups={groups}
        placeholder={waiting ? "جاري تحميل الأنواع…" : "اختر نوع التعذّر…"}
        disabled={disabled || waiting || problemTypes.length === 0}
        hasError={invalid}
        autoFocus={autoFocus}
      />
      {selected?.description ? (
        <p className="mt-1.5 m-0 text-[11.5px] leading-relaxed text-text-3">
          {selected.description}
        </p>
      ) : null}
      {!waiting && problemTypes.length === 0 ? (
        <p className="mt-1.5 m-0 text-[11.5px] leading-relaxed text-text-3">
          لا توجد أنواع تعذّر متاحة لدورك. راجع صفحة أنواع التعذّرات.
        </p>
      ) : null}
    </div>
  );
}

/**
 * The create payload of a raise: the chosen type, its label as the title, its description as
 * the note, and the chosen degree.
 *
 * How it works: looks the id up in the given catalog; null when it is not there.
 *
 * Edge cases: `severity` defaults to internal so a caller without the degree choice behaves as
 * before; the return type was the literal `"internal"`, which is why «احتمال تعذّر» could never
 * be sent.
 */
export function failurePayloadFromProblemType(
  problemTypeId: string,
  types: FailureProblemType[],
  severity: FailureSeverity = "internal",
): {
  problemTypeId: string;
  title: string;
  severity: FailureSeverity;
  internalNote: string;
} | null {
  const type = types.find((t) => t.id === problemTypeId);
  if (!type) return null;
  return {
    problemTypeId: type.id,
    title: type.label,
    severity,
    internalNote: type.description?.trim() ?? "",
  };
}
