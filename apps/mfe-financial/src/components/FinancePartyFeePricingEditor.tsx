"use client";

import { Fragment } from "react";
import {
  Button,
  FormGroup,
  MobileRecordCard,
  Spinner,
  cn,
  opsBtnGhost,
  opsBtnPrimary,
  opsFldControl,
  opsPpBadge,
  opsTfActions,
  opsTfLbl,
  opsTfNote,
  opsTfSeg,
  opsTfSegActive,
  opsTfSegRow,
} from "@platform/ui-kit";

import { num, tierFromValue } from "../lib/party-fee-pricing-state";
import { MoneyInput } from "./FinancePartyFeePricingParts";
import type { FinancePartyFeePricingWorkflow } from "./useFinancePartyFeePricingWorkflow";

type TierKind = "from" | "max" | "fee";

/**
 * One tier control — «من» (locked on the first tier), «حتى» («فأكثر» on the
 * last) or «أتعاب». Shared by the desktop tier row and the phone tier card;
 * `idSuffix` keeps ids unique while both are mounted.
 */
function TierControl({
  workflow,
  index,
  kind,
  idSuffix = "",
}: {
  workflow: FinancePartyFeePricingWorkflow;
  index: number;
  kind: TierKind;
  idSuffix?: string;
}) {
  const { draft, locked, updateTier, updateTierFrom } = workflow;
  const tier = draft.areaTiers[index]!;
  const isLast = index === draft.areaTiers.length - 1;
  if (kind === "from") {
    return (
      <MoneyInput
        id={`tier-from-${index}${idSuffix}`}
        value={tierFromValue(draft.areaTiers, index)}
        locked={locked || index === 0}
        onChange={(n) => updateTierFrom(index, n)}
      />
    );
  }
  if (kind === "max") {
    return isLast ? (
      <div className="flex h-10 items-center text-[13px] font-medium text-text-2">
        فأكثر
      </div>
    ) : (
      <MoneyInput
        id={`tier-max-${index}${idSuffix}`}
        value={tier.maxAreaM2 ?? 0}
        locked={locked}
        onChange={(n) => updateTier(index, { maxAreaM2: n })}
      />
    );
  }
  return (
    <MoneyInput
      id={`tier-fee-${index}${idSuffix}`}
      value={tier.feeSar}
      locked={locked}
      onChange={(n) => updateTier(index, { feeSar: n })}
    />
  );
}

const TIER_LABELS: Record<TierKind, string> = {
  from: "من",
  max: "حتى",
  fee: "أتعاب",
};

/**
 * The pricing table editor — identity, tiers and the per-party rates, plus the
 * explicit save row. All state lives in the party fee pricing workflow.
 */
export function FinancePartyFeePricingEditor({
  workflow,
}: {
  workflow: FinancePartyFeePricingWorkflow;
}) {
  const {
    draft,
    setDraft,
    saving,
    busy,
    locked,
    canEdit,
    panelEpoch,
    holdingPrevious,
    contentCategory,
    tables,
    hasAssignments,
    assignedNames,
    activate,
    openAssign,
    removeTable,
    save,
    addTier,
    removeTier,
  } = workflow;

  return (
      <div
        key={`${draft.id}-${panelEpoch}`}
        className={cn(
          "transition-opacity duration-200 ease-out",
          holdingPrevious
            ? "pointer-events-none select-none opacity-45"
            : "animate-[pricing-panel-in_0.28s_ease-out] opacity-100",
        )}
      >
        {/* Table identity */}
        <div className="space-y-5">
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="pricing-name" className={opsTfLbl}>
              اسم الجدول
            </label>
            <input
              id="pricing-name"
              className={cn(
                opsFldControl,
                "text-[15px] disabled:cursor-not-allowed disabled:opacity-60",
              )}
              value={draft.name}
              readOnly={locked}
              disabled={locked}
              onChange={(e) =>
                setDraft((d) => ({ ...d, name: e.target.value }))
              }
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {draft.isActive ? (
              <span className={opsPpBadge}>★ الافتراضي للفئة</span>
            ) : canEdit ? (
              <button
                type="button"
                disabled={locked}
                onClick={() => void activate()}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-[9px] border border-border-md bg-surface px-3.5 py-2 font-[inherit] text-[12.5px] font-semibold text-text-2 transition-colors enabled:hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                اجعله الافتراضي
              </button>
            ) : null}

            {canEdit ? (
              <button
                type="button"
                disabled={locked}
                onClick={openAssign}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-[9px] border border-border-md bg-surface px-3.5 py-2 font-[inherit] text-[12.5px] font-semibold text-text-2 transition-colors enabled:hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                من يخصّه الجدول
                {hasAssignments ? ` (${draft.assignedCount})` : ""}
              </button>
            ) : null}

            {canEdit ? (
              <button
                type="button"
                disabled={
                  locked || tables.length <= 1 || hasAssignments
                }
                onClick={() => void removeTable()}
                className="ms-auto inline-flex cursor-pointer items-center rounded-[9px] border border-transparent bg-transparent px-3.5 py-2 font-[inherit] text-[12.5px] font-semibold text-[#d9694f] transition-colors enabled:hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-40"
              >
                حذف الجدول
              </button>
            ) : null}
          </div>

          {assignedNames.length > 0 ? (
            <p className={cn(opsTfNote, "m-0")}>
              مسند إلى:{" "}
              <span className="font-semibold text-heading">
                {assignedNames.map((p) => p.name).join("، ")}
              </span>
            </p>
          ) : contentCategory === "engineering-survey" ? (
            <p className="m-0 rounded-[10px] border border-dashed border-amber/50 bg-amber/10 px-3.5 py-3 text-[12.5px] leading-relaxed text-amber">
              لم يُسند لأي مكتب — لن يُستخدم حتى تسنده من «من يخصّه الجدول».
            </p>
          ) : (
            <p className="m-0 text-[12px] leading-relaxed text-text-3">
              بلا إسناد — يُستخدم الافتراضي عند الاحتساب.
            </p>
          )}
        </div>

        {/* Prices */}
        <div className="mt-6 space-y-5 border-t border-border pt-6">
          {hasAssignments ? (
            <p className={cn(opsTfNote, "m-0")}>
              مرتبط بمستحقين: الحفظ ينشئ{" "}
              <strong className="font-semibold text-heading">نسخة جديدة</strong>{" "}
              وينقل الإسناد إليها (بدون كسر الأرقام السابقة).
            </p>
          ) : null}

          {contentCategory === "engineering-survey" ? (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="m-0 text-[13.5px] font-extrabold text-heading">
                    شرائح المساحة
                  </h2>
                  {canEdit ? (
                    <button
                      type="button"
                      disabled={locked}
                      onClick={addTier}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-[9px] border border-border-md bg-surface px-3.5 py-2 font-[inherit] text-[12.5px] font-semibold text-text-2 transition-colors enabled:hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      ＋ شريحة
                    </button>
                  ) : null}
                </div>
                <p className="m-0 text-[11.5px] leading-relaxed text-text-3">
                  من / حتى بالمتر، والسعر بالريال. الأخير = فأكثر.
                </p>
              </div>

              <div className="space-y-2.5">
                {draft.areaTiers.map((tier, index) => {
                  const removeButton = canEdit ? (
                    <button
                      type="button"
                      title="حذف الشريحة"
                      disabled={locked || draft.areaTiers.length <= 1}
                      onClick={() => removeTier(index)}
                      className="flex h-10 w-9 items-center justify-center rounded-md text-text-3 hover:bg-danger-bg hover:text-danger-text disabled:opacity-30"
                    >
                      ×
                    </button>
                  ) : null;
                  return (
                    <Fragment key={`${tier.sortOrder}-${index}`}>
                      {/* Phones: one editable card per tier — من / حتى side by side, أتعاب full width. */}
                      <MobileRecordCard
                        className="lg:hidden"
                        title={`شريحة ${index + 1}`}
                        actions={
                          canEdit ? (
                            <button
                              type="button"
                              disabled={locked || draft.areaTiers.length <= 1}
                              onClick={() => removeTier(index)}
                              className="inline-flex items-center rounded-[9px] border border-border-md bg-surface px-3.5 text-[12.5px] font-semibold text-[#d9694f] enabled:active:bg-danger-bg disabled:opacity-40"
                            >
                              حذف الشريحة
                            </button>
                          ) : undefined
                        }
                      >
                        <div className="grid grid-cols-2 gap-2.5">
                          {(["from", "max", "fee"] as const).map((kind) => (
                            <div
                              key={kind}
                              className={cn("min-w-0", kind === "fee" && "col-span-2")}
                            >
                              <span className={cn(opsTfLbl, "mb-1.5")}>
                                {TIER_LABELS[kind]}
                              </span>
                              <TierControl
                                workflow={workflow}
                                index={index}
                                kind={kind}
                                idSuffix="-m"
                              />
                            </div>
                          ))}
                        </div>
                      </MobileRecordCard>
                      <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2.5 rounded-[10px] border border-border bg-surface px-3.5 py-3.5 max-lg:hidden sm:gap-3.5 sm:px-4">
                        {(["from", "max", "fee"] as const).map((kind) => (
                          <div key={kind}>
                            <span className={cn(opsTfLbl, "mb-1.5")}>
                              {TIER_LABELS[kind]}
                            </span>
                            <TierControl workflow={workflow} index={index} kind={kind} />
                          </div>
                        ))}
                        <div className="pb-0.5">
                          {removeButton ?? <span className="inline-block w-9" />}
                        </div>
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            </>
          ) : null}

          {contentCategory === "court-visit" ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <h2 className="m-0 text-[13.5px] font-extrabold text-heading">
                  أتعاب زيارة المحكمة
                </h2>
                <p className="m-0 max-w-xl text-[11.5px] leading-relaxed text-text-3">
                  للمراجع المتعاون عند إكمال الزيارة. الموظف بلا أتعاب زيارة
                  هنا.
                </p>
              </div>
              <FormGroup className="max-w-sm">
                <label htmlFor="fee-court-visit" className={opsTfLbl}>
                  المبلغ (ر.س)
                </label>
                <MoneyInput
                  id="fee-court-visit"
                  value={draft.courtVisitFeeSar}
                  locked={locked}
                  onChange={(n) =>
                    setDraft((d) => ({ ...d, courtVisitFeeSar: n }))
                  }
                />
              </FormGroup>
            </div>
          ) : null}

          {contentCategory === "field-inspector" &&
          draft.pricingKind === "flat" ? (
            <div className="space-y-4">
              <h2 className="m-0 text-[13.5px] font-extrabold text-heading">
                حافز موظف (مقطوع)
              </h2>
              <FormGroup className="max-w-sm">
                <label htmlFor="fee-flat" className={opsTfLbl}>
                  المبلغ (ر.س)
                </label>
                <MoneyInput
                  id="fee-flat"
                  value={draft.flatAmountSar ?? 0}
                  locked={locked}
                  onChange={(n) =>
                    setDraft((d) => ({ ...d, flatAmountSar: n }))
                  }
                />
              </FormGroup>
            </div>
          ) : null}

          {contentCategory === "field-inspector" &&
          draft.pricingKind !== "flat" ? (
            <div className="space-y-4">
              <h2 className="m-0 text-[13.5px] font-extrabold text-heading">
                أتعاب المعاين
              </h2>
              <div className="grid max-w-lg grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
                <FormGroup>
                  <label htmlFor="fee-insp-ind" className={opsTfLbl}>
                    متعاون فرد (ر.س)
                  </label>
                  <MoneyInput
                    id="fee-insp-ind"
                    value={draft.fieldInspectorIndividualFeeSar}
                    locked={locked}
                    onChange={(n) =>
                      setDraft((d) => ({
                        ...d,
                        fieldInspectorIndividualFeeSar: n,
                      }))
                    }
                  />
                </FormGroup>
                <FormGroup>
                  <label htmlFor="fee-insp-org" className={opsTfLbl}>
                    منشأة (ر.س)
                  </label>
                  <MoneyInput
                    id="fee-insp-org"
                    value={draft.fieldInspectorOrganizationFeeSar}
                    locked={locked}
                    onChange={(n) =>
                      setDraft((d) => ({
                        ...d,
                        fieldInspectorOrganizationFeeSar: n,
                      }))
                    }
                  />
                </FormGroup>
              </div>
            </div>
          ) : null}
        </div>

        {/* Explicit save */}
        {canEdit ? (
          <div className={opsTfActions}>
            <button
              type="button"
              className={opsBtnPrimary}
              disabled={locked || !draft.id}
              aria-busy={saving || undefined}
              data-no-action-toast
              onClick={() => void save()}
            >
              {saving ? <Spinner /> : null}
              <span>
                {saving
                  ? "جاري الحفظ…"
                  : hasAssignments
                    ? "✓ حفظ كنسخة جديدة"
                    : "✓ حفظ"}
              </span>
            </button>
          </div>
        ) : null}
      </div>
  );
}
