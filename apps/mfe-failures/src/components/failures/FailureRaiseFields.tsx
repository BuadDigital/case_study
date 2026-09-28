"use client";

import { useMemo } from "react";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { filterFailureCategoriesForRole, filterFailureProblemTypesForRole } from "../../lib/failure-category-role-visibility";
import {
  FAILURE_PROBLEM_TYPES,
  FAILURE_TYPE_CATEGORIES,
  type FailureProblemType,
} from "../../lib/failure-types-data";
import { useFailureTypesQuery } from "../../query/failure-types-queries";
import { FailureTypeMenuSelect } from "./FailureTypeMenuSelect";

const labelClassName =
  "mb-[7px] block text-[12px] font-semibold text-text-2";

/**
 * Catalog dropdown — failure type from `/failure-types`, filtered by role.
 */
export function FailureRaiseFields({
  problemTypeId,
  onProblemTypeChange,
  idPrefix = "fail",
  invalid = false,
  disabled = false,
  autoFocus = false,
}: {
  problemTypeId: string;
  onProblemTypeChange: (value: string) => void;
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
      <label htmlFor={`${idPrefix}_problem_type`} className={labelClassName}>
        نوع التعذر{" "}
        <span className="font-bold text-[#c0553d]" aria-hidden>
          *
        </span>
      </label>
      <FailureTypeMenuSelect
        id={`${idPrefix}_problem_type`}
        value={problemTypeId}
        onChange={onProblemTypeChange}
        groups={groups}
        placeholder={waiting ? "جاري تحميل الأنواع…" : "اختر نوع التعذر…"}
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
          لا توجد أنواع تعذر متاحة لدورك. راجع صفحة أنواع التعذرات.
        </p>
      ) : null}
    </div>
  );
}

export function failurePayloadFromProblemType(
  problemTypeId: string,
  types: FailureProblemType[],
): {
  problemTypeId: string;
  title: string;
  severity: "internal";
  internalNote: string;
} | null {
  const type = types.find((t) => t.id === problemTypeId);
  if (!type) return null;
  return {
    problemTypeId: type.id,
    title: type.label,
    severity: "internal",
    internalNote: type.description?.trim() ?? "",
  };
}
