"use client";

/**
 * «هل حدود الصك مطابقة للطبيعة؟» — the inspector's explicit verdict (two pills, none selected
 * by default). «مطابق» sets all four sides in one patch; the per-side toggles + notes of the
 * hosting card appear only under «غير مطابق». Read-only views show the headline
 * «المعاين: مطابق / غير مطابق / لم يحدد» instead of the pills.
 */
import { cn } from "@platform/ui-kit";
import type { InspectorWorkspaceDraft } from "../../lib/app-data/inspector-workspace-data";
import { MobileFieldLabel, MobilePills } from "./InspectMobileControls";
import {
  deedVerdictHeadline,
  deedVerdictPatch,
  type DeedMatchVerdict,
} from "./field-inspection-work-state";

const VERDICT_LABELS: Record<Exclude<DeedMatchVerdict, "">, string> = {
  yes: "مطابق",
  no: "غير مطابق",
};

export function InspectorDeedVerdict({
  draft,
  mobile,
  readOnly,
  errorMessage,
  onPatch,
}: {
  draft: Pick<InspectorWorkspaceDraft, "deedMatchesNature" | "boundaryMatches">;
  mobile: boolean;
  readOnly: boolean;
  /** Validation / server message for the verdict; also marks the pills invalid. */
  errorMessage?: string;
  onPatch: (
    patch: Pick<InspectorWorkspaceDraft, "deedMatchesNature" | "boundaryMatches">,
  ) => void;
}) {
  const pick = (verdict: Exclude<DeedMatchVerdict, "">) =>
    onPatch(deedVerdictPatch(draft, verdict));

  if (readOnly) {
    return (
      <div id="ins-deed-match" className="mb-3 text-[13px] font-bold text-heading">
        {deedVerdictHeadline(draft)}
      </div>
    );
  }

  const selected = draft.deedMatchesNature;
  return (
    <div id="ins-deed-match" className="mb-3">
      {mobile ? (
        <>
          <MobileFieldLabel>هل حدود الصك مطابقة للطبيعة؟</MobileFieldLabel>
          <MobilePills
            options={[VERDICT_LABELS.yes, VERDICT_LABELS.no]}
            value={selected ? VERDICT_LABELS[selected] : ""}
            onChange={(next) => pick(next === VERDICT_LABELS.yes ? "yes" : "no")}
          />
        </>
      ) : (
        <>
          <div className="mb-1.5 text-xs font-semibold text-text-2">
            هل حدود الصك مطابقة للطبيعة؟
          </div>
          <div className="inline-flex gap-1.5" role="radiogroup" aria-label="مطابقة حدود الصك للطبيعة">
            {(["yes", "no"] as const).map((verdict) => {
              const on = selected === verdict;
              return (
                <button
                  key={verdict}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={cn(
                    "rounded-full border px-3.5 py-1 text-[12px] font-semibold",
                    on && verdict === "yes" &&
                      "border-[color-mix(in_srgb,var(--heading)_35%,var(--border))] bg-success-bg text-heading",
                    on && verdict === "no" &&
                      "border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-danger-bg text-danger-text",
                    !on && "border-border bg-surface-2 text-text-3",
                    !on && errorMessage && "border-danger-text",
                  )}
                  onClick={() => pick(verdict)}
                >
                  {VERDICT_LABELS[verdict]}
                </button>
              );
            })}
          </div>
        </>
      )}
      {errorMessage ? (
        <p role="alert" className="mb-0 mt-1.5 text-[11.5px] text-danger-text">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
