"use client";

/**
 * Generic settings-card body: the SLA + valuation thresholds form. It edits
 * the draft through the workflow's patch helpers.
 */

import type { ReactNode } from "react";
import {
  cn,
  opsFld,
  opsFldControl,
  opsFldFull,
  opsFormGrid,
  opsTfLbl,
  opsTfNote,
} from "@platform/ui-kit";
import {
  numberOr,
  SETTINGS_NUMBER_FALLBACKS as FALLBACK,
} from "./organization-settings-state";
import type { OrganizationSettingsWorkflow } from "./useOrganizationSettingsWorkflow";

function Field({
  id,
  label,
  full,
  children,
}: {
  id: string;
  label: ReactNode;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={full ? opsFldFull : opsFld}>
      <label htmlFor={id} className={opsTfLbl}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function OrganizationSlaForm({
  workflow,
}: {
  workflow: OrganizationSettingsWorkflow;
}) {
  const { canEdit, draft, patchSla, patchValuation } = workflow;
  const { sla, valuation } = draft;
  return (
    <>
      <p className={cn(opsTfNote, "m-0 mb-3.5")}>
        التعديل يسري على أوامر العمل الجديدة فقط. الجارية تحتفظ بمهلتها
        المحسوبة عند الاستلام. وأرقام التقييم تسري على التقييمات الجديدة فقط.
      </p>
      <div className={opsFormGrid}>
        <Field id="org-sla-default" label="أيام عمل — تنفيذ / تركات">
          <input
            id="org-sla-default"
            className={opsFldControl}
            type="number"
            min={1}
            max={60}
            dir="ltr"
            value={String(sla.defaultBusinessDays)}
            disabled={!canEdit}
            onChange={(e) =>
              patchSla({
                defaultBusinessDays: numberOr(e.target.value, FALLBACK.defaultBusinessDays),
              })
            }
          />
        </Field>
        <Field id="org-sla-private" label="أيام عمل — قطاع خاص">
          <input
            id="org-sla-private"
            className={opsFldControl}
            type="number"
            min={1}
            max={60}
            dir="ltr"
            value={String(sla.privateSectorBusinessDays)}
            disabled={!canEdit}
            onChange={(e) =>
              patchSla({
                privateSectorBusinessDays: numberOr(
                  e.target.value,
                  FALLBACK.privateSectorBusinessDays,
                ),
              })
            }
          />
        </Field>
        <Field id="org-max-adopted-comps" label="الحد الأقصى للمقارنات المعتمدة لكل تقييم">
          <input
            id="org-max-adopted-comps"
            className={opsFldControl}
            type="number"
            min={1}
            max={3}
            dir="ltr"
            value={String(valuation.maxAdoptedComparables)}
            disabled={!canEdit}
            onChange={(e) =>
              patchValuation({
                maxAdoptedComparables: numberOr(
                  e.target.value,
                  FALLBACK.maxAdoptedComparables,
                ),
              })
            }
          />
        </Field>
        <Field id="org-area-factor" label="معامل تسوية المساحة ٪ (areaFactor) — منطق التسويات">
          <input
            id="org-area-factor"
            className={opsFldControl}
            type="number"
            min={0.1}
            max={50}
            step={0.1}
            dir="ltr"
            value={String(valuation.areaFactorPct ?? FALLBACK.areaFactorPct)}
            disabled={!canEdit}
            onChange={(e) =>
              patchValuation({
                areaFactorPct: numberOr(e.target.value, FALLBACK.areaFactorPct),
              })
            }
          />
        </Field>
        <Field id="org-mkt-rate" label="معدل تغير السوق السنوي ٪ (mktRate) — اقتراح ظروف السوق">
          <input
            id="org-mkt-rate"
            className={opsFldControl}
            type="number"
            min={0}
            max={50}
            step={0.1}
            dir="ltr"
            value={String(valuation.annualMarketRatePct ?? 4)}
            disabled={!canEdit}
            onChange={(e) =>
              patchValuation({
                annualMarketRatePct: numberOr(e.target.value, FALLBACK.annualMarketRatePct),
              })
            }
          />
        </Field>
        <Field id="org-value-round" label="أسّ تقريب قيمة السوق (10^ن) — منطق التسويات">
          <input
            id="org-value-round"
            className={opsFldControl}
            type="number"
            min={0}
            max={6}
            dir="ltr"
            value={String(valuation.marketValueRoundDecimals ?? 4)}
            disabled={!canEdit}
            onChange={(e) =>
              patchValuation({
                marketValueRoundDecimals: numberOr(
                  e.target.value,
                  FALLBACK.marketValueRoundDecimals,
                ),
              })
            }
          />
        </Field>
      </div>
    </>
  );
}
