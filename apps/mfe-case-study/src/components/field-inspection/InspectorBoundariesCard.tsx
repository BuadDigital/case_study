"use client";

/**
 * Step-2 card «الحدود والأطوال»: deed text/length (inspector can fill),
 * then facade type, match verdict, and mismatch note.
 * Lifted out of `FieldInspectionWorkBody` — same markup, state stays with
 * the workflow hook.
 */
import { cn, formControlClassName, Input, Select, Textarea } from "@platform/ui-kit";
import { invalidControlClass } from "@platform/app-shared/form-ux";
import type { InspectorWorkspaceDraft } from "../../lib/app-data/inspector-workspace-data";
import type { PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import {
  BOUNDARY_KEYS,
  BOUNDARY_ROW_MAP,
  InsBadge,
  InspectorCard,
} from "./FieldInspectionWorkParts";
import {
  MobileFieldLabel,
  MobilePills,
  mobileControlClassName,
} from "./InspectMobileControls";
import {
  boundaryDeedDisplay,
  boundaryMatchPatch,
  resolvedBoundaryDeedField,
} from "./field-inspection-work-state";
import type { FieldInspectionWorkflow } from "./useFieldInspectionWorkflow";

export function InspectorBoundariesCard({
  activeStep,
  draft,
  facadeTypeOptions,
  fieldErrors = {},
  layout,
  locked,
  mobile,
  persist,
  property,
}: Pick<FieldInspectionWorkflow, "activeStep" | "facadeTypeOptions" | "fieldErrors" | "locked" | "persist"> & {
  draft: InspectorWorkspaceDraft;
  layout: "desktop" | "mobile";
  mobile: boolean;
  property: PoPropertyIntake;
}) {
  return (
    <div id="ins-boundaries-section">
    <InspectorCard
      title="الحدود والأطوال"
      hidden={activeStep !== 2}
      icon="ti-vector"
      badge={
        mobile ? undefined : (
          <InsBadge
            label="أدخل الحدود ثم طابقها مع الواقع"
            tone="info"
          />
        )
      }
      layout={layout}
      step={4}
      subtitle={mobile ? "مطابقة الصك" : undefined}
    >
      {mobile ? null : (
        <p className="mb-3 text-[11px] text-text-3">
          أدخل الحد حسب الصك وطوله إن لم تُعبأ من البورصة، ثم أكّد المطابقة أو
          علّق بعدم المطابقة. ويطابقها أيضاً المكتب الهندسي.
        </p>
      )}
      {BOUNDARY_KEYS.map((key) => {
        const row = BOUNDARY_ROW_MAP[key];
        const match = draft.boundaryMatches[key];
        const deedDesc = resolvedBoundaryDeedField(
          match?.deedDesc,
          property[row.descKey],
        );
        const deedLength = resolvedBoundaryDeedField(
          match?.deedLength,
          property[row.lenKey],
        );
        const deed = boundaryDeedDisplay(deedDesc, deedLength);
        const mismatchInvalid = fieldErrors.missingBoundaryKey === key;
        if (mobile) {
          return (
            <div
              key={key}
              id={`ins-boundary-${key}`}
              className="border-b border-border py-3.5 last:border-b-0"
            >
              <div className="mb-2.5 flex items-start justify-between gap-2">
                <span className="text-[14px] font-bold text-heading">
                  {row.label}
                </span>
                {locked ? (
                  <span className="shrink-0 text-[13px] text-text-3">
                    {deed.desc} · {deed.length}
                  </span>
                ) : null}
              </div>
              <MobileFieldLabel>الحد حسب الصك</MobileFieldLabel>
              <Input
                aria-label={`الحد حسب الصك — ${row.label}`}
                placeholder="مثال: شارع عرض 15م"
                value={deedDesc}
                disabled={locked}
                className={cn(mobileControlClassName, "mb-2.5")}
                onChange={(e) =>
                  persist(
                    boundaryMatchPatch(draft, key, { deedDesc: e.target.value }),
                  )
                }
              />
              <MobileFieldLabel>الطول (م)</MobileFieldLabel>
              <Input
                aria-label={`الطول (م) — ${row.label}`}
                placeholder="25.00"
                inputMode="decimal"
                value={deedLength}
                disabled={locked}
                className={cn(mobileControlClassName, "mb-2.5")}
                onChange={(e) =>
                  persist(
                    boundaryMatchPatch(draft, key, {
                      deedLength: e.target.value,
                    }),
                  )
                }
              />
              <MobileFieldLabel>نوع الواجهة</MobileFieldLabel>
              <Select
                aria-label={`نوع الواجهة — ${row.label}`}
                value={match.facade}
                disabled={locked}
                className={cn(mobileControlClassName, "mb-2.5")}
                onChange={(e) =>
                  persist(boundaryMatchPatch(draft, key, { facade: e.target.value }))
                }
              >
                <option value="">— اختر —</option>
                {facadeTypeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </Select>
              <MobilePills
                options={["مطابق", "عدم تطابق"]}
                value={match.matches ? "مطابق" : "عدم تطابق"}
                disabled={locked}
                onChange={(next) =>
                  persist(boundaryMatchPatch(draft, key, { matches: next === "مطابق" }))
                }
              />
              {!match.matches ? (
                <Input
                  placeholder="ملاحظة عدم التطابق"
                  value={match.mismatchNote}
                  disabled={locked}
                  aria-invalid={mismatchInvalid || undefined}
                  onChange={(e) =>
                    persist(
                      boundaryMatchPatch(draft, key, { mismatchNote: e.target.value }),
                    )
                  }
                  className={cn(
                    mobileControlClassName,
                    "mt-2",
                    mismatchInvalid && invalidControlClass,
                  )}
                />
              ) : null}
            </div>
          );
        }
        return (
          <div
            key={key}
            id={`ins-boundary-${key}`}
            className="grid grid-cols-1 items-start gap-3 border-b border-border py-2.5 last:border-b-0 md:grid-cols-[90px_150px_1fr_90px_minmax(200px,250px)]"
          >
            <span className="text-xs font-semibold text-text-2">
              {row.label}
            </span>
            <Select
              aria-label={`نوع الواجهة — ${row.label}`}
              value={match.facade}
              disabled={locked}
              className="text-[11.5px]"
              onChange={(e) =>
                persist(boundaryMatchPatch(draft, key, { facade: e.target.value }))
              }
            >
              <option value="">— اختر —</option>
              {facadeTypeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </Select>
            {locked ? (
              <span className="text-xs">{deed.desc}</span>
            ) : (
              <Input
                aria-label={`الحد حسب الصك — ${row.label}`}
                placeholder="مثال: شارع عرض 15م"
                value={deedDesc}
                className="text-[11.5px]"
                onChange={(e) =>
                  persist(
                    boundaryMatchPatch(draft, key, { deedDesc: e.target.value }),
                  )
                }
              />
            )}
            {locked ? (
              <span className="text-xs font-semibold">{deed.length}</span>
            ) : (
              <Input
                aria-label={`الطول (م) — ${row.label}`}
                placeholder="25.00"
                inputMode="decimal"
                value={deedLength}
                className="text-[11.5px]"
                onChange={(e) =>
                  persist(
                    boundaryMatchPatch(draft, key, {
                      deedLength: e.target.value,
                    }),
                  )
                }
              />
            )}
            <div>
              <label className="flex min-h-9 cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={match.matches}
                  onChange={(e) =>
                    persist(boundaryMatchPatch(draft, key, { matches: e.target.checked }))
                  }
                />
                <span
                  className={cn(
                    "text-xs font-bold",
                    match.matches ? "text-teal-text" : "text-danger-text",
                  )}
                >
                  {match.matches ? "مطابق" : "عدم تطابق"}
                </span>
              </label>
              {!match.matches ? (
                <Textarea
                  rows={2}
                  placeholder="ملاحظة عدم التطابق..."
                  value={match.mismatchNote}
                  aria-invalid={mismatchInvalid || undefined}
                  onChange={(e) =>
                    persist(
                      boundaryMatchPatch(draft, key, { mismatchNote: e.target.value }),
                    )
                  }
                  className={cn(
                    formControlClassName,
                    "mt-2 min-h-12 text-xs",
                    mismatchInvalid && invalidControlClass,
                  )}
                />
              ) : null}
            </div>
          </div>
        );
      })}
    </InspectorCard>
    </div>
  );
}
