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
import {
  FAILURE_DEGREE_LABELS,
  defaultRaiseSeverity,
  failureReasonRequired,
  raiseSeveritiesForRole,
  type FailureDegree,
} from "../../lib/failure-degrees";
import { FailureChoiceCards } from "./FailureChoiceCards";
import { FailureTypeMenuSelect } from "./FailureTypeMenuSelect";
import { FailureReasonField } from "./FinalFailureParts";

const labelClassName =
  "mb-[7px] block text-[12px] font-semibold text-text-2";

/**
 * The raise fields: the failure's degree when `onSeverityChange` is passed, the catalog dropdown
 * (failure type from `/failure-types`, filtered by role), and the reason when `onReasonChange` is
 * passed.
 *
 * How it works: «درجة التعذّر» offers `degrees` — by default the severities the viewer's role may
 * raise (`raiseSeveritiesForRole`: possible and internal for the case specialist and the
 * supervisor, possible only for everyone else); a host that also records the final failure passes
 * the three. Several degrees are option cards (`FailureChoiceCards`); a single one is a line of
 * text, there being nothing to choose. The dropdown groups the role's problem types under their
 * categories. The reason carries its required mark for «تعذّر داخلي» and «تعذّر نهائي», and for the
 * type «أخرى» at any degree (`failureReasonRequired`).
 *
 * Edge cases: every raise used to be recorded internal — the server accepted «تعذّر محتمل» but
 * no screen let anyone choose it; since 2026-11-11 the parties (inspector, engineering office,
 * appraiser) are offered «تعذّر محتمل» only, and the server lowers anything else they send. The
 * degree is opt-in per caller, so the final-failure dialog reuses only the dropdown. It is
 * labelled «درجة التعذّر» because «نوع التعذّر» already names the dropdown. `showProblemType`
 * hides the dropdown when a final failure lands on a deed whose open failure already names it.
 */
export function FailureRaiseFields<D extends FailureDegree = FailureSeverity>({
  problemTypeId,
  onProblemTypeChange,
  severity,
  onSeverityChange,
  degrees,
  reason = "",
  onReasonChange,
  reasonError,
  showProblemType = true,
  idPrefix = "fail",
  invalid = false,
  disabled = false,
  autoFocus = false,
}: {
  problemTypeId: string;
  onProblemTypeChange: (value: string) => void;
  severity?: D;
  onSeverityChange?: (value: D) => void;
  /** The degrees to offer; default: the severities the viewer's role may raise. */
  degrees?: readonly D[];
  reason?: string;
  onReasonChange?: (value: string) => void;
  reasonError?: string;
  showProblemType?: boolean;
  idPrefix?: string;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const { role } = useAppAccess();
  const { data: catalog, isPending, isError } = useFailureTypesQuery();
  const offered = (degrees ?? raiseSeveritiesForRole(role)) as readonly D[];
  const degree = severity ?? (defaultRaiseSeverity(role) as D);

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
      {onSeverityChange && offered.length > 1 ? (
        <FailureChoiceCards
          id={`${idPrefix}_severity`}
          label="درجة التعذّر"
          options={offered.map((value) => ({ value, ...FAILURE_DEGREE_LABELS[value] }))}
          value={degree}
          onChange={onSeverityChange}
          disabled={disabled}
        />
      ) : null}
      {onSeverityChange && offered.length === 1 ? (
        <p className="mb-3 mt-0 text-[12px] leading-relaxed text-text-2">
          <span className="font-semibold">درجة التعذّر:</span>{" "}
          {FAILURE_DEGREE_LABELS[offered[0]!].label} — {FAILURE_DEGREE_LABELS[offered[0]!].hint}
        </p>
      ) : null}
      {showProblemType ? (
        <>
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
        </>
      ) : null}
      {onReasonChange ? (
        <div className={showProblemType ? "mt-3" : undefined}>
          <FailureReasonField
            id={`${idPrefix}_reason`}
            label="سبب التعذّر"
            required={failureReasonRequired(degree, problemTypeId)}
            value={reason}
            onChange={onReasonChange}
            error={reasonError}
            disabled={disabled}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * The create payload of a raise: the chosen type, its label as the title, the written reason as
 * the note (the type's description when none was written), and the chosen degree.
 *
 * How it works: looks the id up in the given catalog; null when it is not there.
 *
 * Edge cases: `severity` defaults to internal so a caller without the degree choice behaves as
 * before (the server lowers it for a role that may not raise internal); the return type was the
 * literal `"internal"`, which is why «تعذّر محتمل» could never be sent. A blank reason keeps the
 * description as the note, as every raise did before the reason field existed.
 */
export function failurePayloadFromProblemType(
  problemTypeId: string,
  types: FailureProblemType[],
  severity: FailureSeverity = "internal",
  reason = "",
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
    internalNote: reason.trim() || (type.description?.trim() ?? ""),
  };
}
