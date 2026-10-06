"use client";

/**
 * «هل في الأرض مبانٍ أو ملاحق تستحق التقييم (سور، غرفة حارس، سكن عمال…)؟» — the inspector's
 * explicit yes/no for an asset typed «أرض» (two pills, none selected by default). «نعم» makes the
 * inventory table «جدول الحصر» mandatory even though the asset is land; «لا» exempts it — the
 * annexes are then just described in the property description. Shown only when the inspected
 * asset is land; the element id `ins-land-structures` is the validation scroll target.
 */
import { cn } from "@platform/ui-kit";
import type { InspectorWorkspaceDraft } from "../../lib/app-data/inspector-workspace-data";
import { MobileFieldLabel, MobilePills } from "./InspectMobileControls";

export const LAND_STRUCTURES_QUESTION =
  "هل في الأرض مبانٍ أو ملاحق تستحق التقييم (سور، غرفة حارس، سكن عمال…)؟";
export const LAND_STRUCTURES_HINT = "إن لم تكن للتقييم فصفها في حقل وصف العقار";

type Answer = Exclude<InspectorWorkspaceDraft["landHasValuableStructures"], "">;

const ANSWER_LABELS: Record<Answer, string> = { yes: "نعم", no: "لا" };

export function InspectorLandStructuresQuestion({
  value,
  mobile,
  disabled = false,
  errorMessage,
  onChange,
}: {
  value: InspectorWorkspaceDraft["landHasValuableStructures"];
  mobile: boolean;
  disabled?: boolean;
  /** Validation / server message; also marks the unselected pills invalid. */
  errorMessage?: string;
  onChange: (next: Answer) => void;
}) {
  return (
    <div id="ins-land-structures" className="mb-1">
      {mobile ? (
        <>
          <MobileFieldLabel>{LAND_STRUCTURES_QUESTION}</MobileFieldLabel>
          <MobilePills
            options={[ANSWER_LABELS.yes, ANSWER_LABELS.no]}
            value={value ? ANSWER_LABELS[value] : ""}
            disabled={disabled}
            onChange={(next) => onChange(next === ANSWER_LABELS.yes ? "yes" : "no")}
          />
        </>
      ) : (
        <>
          <div className="mb-1.5 text-xs font-semibold text-text-2">{LAND_STRUCTURES_QUESTION}</div>
          <div className="inline-flex gap-1.5" role="radiogroup" aria-label="مبانٍ أو ملاحق تستحق التقييم">
            {(["yes", "no"] as const).map((answer) => {
              const on = value === answer;
              return (
                <button
                  key={answer}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={disabled}
                  className={cn(
                    "rounded-full border px-3.5 py-1 text-[12px] font-semibold",
                    on &&
                      "border-[color-mix(in_srgb,var(--heading)_35%,var(--border))] bg-success-bg text-heading",
                    !on && "border-border bg-surface-2 text-text-3",
                    !on && errorMessage && "border-danger-text",
                  )}
                  onClick={() => onChange(answer)}
                >
                  {ANSWER_LABELS[answer]}
                </button>
              );
            })}
          </div>
        </>
      )}
      <p className="m-0 mt-1.5 text-[11px] leading-relaxed text-text-3">{LAND_STRUCTURES_HINT}</p>
      {errorMessage ? (
        <p role="alert" className="mb-0 mt-1.5 text-[11.5px] text-danger-text">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
