// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • D6   The panel takes a group (market / cost / income / general) and shows that screen's triggered
//         alerts with its own heading and empty text (GROUP_COPY) — cost and income alerts get a panel.
//  • Alerts  Dispositions save on their own through saveValuationAlertOverrides (alertOverridesForCodes),
//            not the full reconciliation, so they no longer wait on «مبرر استخدام طرق التقييم» (problem 20).
// Round 2 (1b19bedc)
//  • B    A require-rationale override under 10 characters is refused before saving and named under its
//         field (also the server's per-alert field errors); the box gets an id and aria-label.
//  • R2-20  Alert details go through KeepCodesTogether so CMP-… codes never break across lines.
// ──────────────────────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useState } from "react";
import {
  saveValuationAlertOverrides,
  type ValuationIssuanceGatesDto,
  type ValuationMethodologyAlertItemDto,
  type ValuationReconciliationDto,
} from "@platform/api-client";
import { cn, useToast } from "@platform/ui-kit";
import { invalidControlClass } from "@platform/app-shared/form-ux";

import { Card, CardPad, PrimaryBtn } from "./atoms";
import { KeepCodesTogether } from "./KeepCodesTogether";
import { useValuationWorkErrors } from "./ValuationWorkErrors";
import {
  alertOverridesFromRecon,
  alertOverridesForCodes,
  type AlertOverrideRecord,
} from "./lib/final-opinion-state";
import { methodologyAlertGroup, type MethodologyAlertGroup } from "./lib/methodology-alerts";
import { rationaleMinimumError } from "./lib/rationale-minimum";
import { apiConfig } from "./lib/shell-utils";

const GROUP_COPY: Record<MethodologyAlertGroup, { note: string; none: string }> = {
  market: {
    note: "تنبيهات أسلوب السوق (المقارنات والأوزان). تُحفَظ المعالجات من هذا التبويب.",
    none: "✓ لا تنبيهات منهجية مفعّلة على أسلوب السوق",
  },
  cost: {
    note: "تنبيهات أسلوب التكلفة (الأعمار والتكاليف والأرباح). تُحفَظ المعالجات من هذا التبويب.",
    none: "✓ لا تنبيهات منهجية مفعّلة على أسلوب التكلفة",
  },
  income: {
    note: "تنبيهات أسلوب الدخل (معدل الرسملة والمصروفات وصافي الدخل). تُحفَظ المعالجات من هذا التبويب.",
    none: "✓ لا تنبيهات منهجية مفعّلة على أسلوب الدخل",
  },
  general: {
    note: "تنبيهات عامة على الطلب (المعاينة وقيود الاستخدام). تُحفَظ المعالجات من هذا التبويب.",
    none: "✓ لا تنبيهات منهجية عامة مفعّلة",
  },
};

/** Methodology alerts of one screen's group — disposition where the appraiser works on them. */
export function MethodologyAlertsPanel({
  group,
  gates,
  recon,
  valuationRequestId,
  saving,
  onSavingChange,
  onReconSaved,
}: {
  group: MethodologyAlertGroup;
  gates: ValuationIssuanceGatesDto;
  recon: ValuationReconciliationDto | null;
  valuationRequestId: string | null;
  saving: boolean;
  onSavingChange: (saving: boolean) => void;
  onReconSaved: (dto: ValuationReconciliationDto) => void;
}) {
  const { showToast } = useToast();
  const { reportSaveFailure, clearSaveErrors, fieldErrors } = useValuationWorkErrors();
  const [alertOverrides, setAlertOverrides] = useState<AlertOverrideRecord>(
    () => alertOverridesFromRecon(recon),
  );
  /** Decision B — a written override rationale shorter than 10 characters, per alert code. */
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  // A reloaded reconciliation replaces the local overrides.
  const [syncedRecon, setSyncedRecon] = useState(recon);
  if (syncedRecon !== recon) {
    setSyncedRecon(recon);
    setAlertOverrides(alertOverridesFromRecon(recon));
  }

  const triggeredAlerts = gates.methodologyAlerts.filter(
    (a) => a.triggered && methodologyAlertGroup(a.number) === group,
  );

  async function saveOverrides(next: AlertOverrideRecord) {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    const short: Record<string, string> = {};
    for (const a of triggeredAlerts) {
      if (a.severityKind !== "require_rationale") continue;
      const message = rationaleMinimumError("مبرر تجاوز التنبيه", next[a.code]?.overrideRationale);
      if (message) short[a.code] = message;
    }
    setRowErrors(short);
    const firstShort = Object.values(short)[0];
    if (firstShort) {
      showToast(firstShort, "error");
      return;
    }
    // Problem 20: the dispositions save on their own (only this screen's alerts) — never through the
    // full reconciliation, which would wait on «مبرر استخدام طرق التقييم».
    onSavingChange(true);
    const res = await saveValuationAlertOverrides(
      config,
      valuationRequestId,
      alertOverridesForCodes(
        next,
        triggeredAlerts.map((a) => a.code),
      ),
    );
    onSavingChange(false);
    if (!res.ok) {
      reportSaveFailure(res, "تعذّر حفظ معالجة التنبيه");
      return;
    }
    clearSaveErrors();
    setAlertOverrides(alertOverridesFromRecon(res.data));
    showToast("تم حفظ معالجة التنبيهات المنهجية", "success");
    onReconSaved(res.data);
  }

  function patchOverride(
    code: string,
    patch: Partial<AlertOverrideRecord[string]>,
  ) {
    if (rowErrors[code]) setRowErrors((prev) => ({ ...prev, [code]: "" }));
    setAlertOverrides((prev) => ({
      ...prev,
      [code]: {
        overrideRationale: prev[code]?.overrideRationale ?? "",
        acknowledged: prev[code]?.acknowledged ?? false,
        ...patch,
      },
    }));
  }

  return (
    <Card>
      <CardPad>
        <div className="mb-2.5">
          <span className="block text-[13.5px] font-extrabold text-heading">
            التنبيهات المنهجية
          </span>
          <p className="mt-0.5 text-[11px] leading-5 text-text-3">{GROUP_COPY[group].note}</p>
        </div>
        {triggeredAlerts.length === 0 ? (
          <div className="text-[12.5px] font-bold text-[#2f7a4d]">
            {GROUP_COPY[group].none}
          </div>
        ) : (
          triggeredAlerts.map((a) => (
            <MethodologyAlertRow
              key={a.code}
              alert={a}
              override={
                alertOverrides[a.code] ?? {
                  overrideRationale: "",
                  acknowledged: false,
                }
              }
              error={rowErrors[a.code] || fieldErrors[`methodologyAlertOverrides.${a.code}`]}
              onPatch={(patch) => patchOverride(a.code, patch)}
            />
          ))
        )}
        {triggeredAlerts.length > 0 ? (
          <div className="mt-3">
            <PrimaryBtn
              disabled={saving || !valuationRequestId}
              onClick={() => void saveOverrides(alertOverrides)}
            >
              حفظ معالجة التنبيهات
            </PrimaryBtn>
          </div>
        ) : null}
      </CardPad>
    </Card>
  );
}

function MethodologyAlertRow({
  alert: a,
  override: ov,
  error,
  onPatch,
}: {
  alert: ValuationMethodologyAlertItemDto;
  override: { overrideRationale: string; acknowledged: boolean };
  /** The rationale's refusal (too short), shown under the field. */
  error?: string;
  onPatch: (patch: Partial<{ overrideRationale: string; acknowledged: boolean }>) => void;
}) {
  const needsRationale = a.severityKind === "require_rationale";
  const needsAck = a.severityKind === "require_ack";
  return (
    <div
      className={cn(
        "mb-2 flex flex-col gap-1.5 rounded-[9px] border px-3 py-2.5",
        a.blocksIssuance
          ? "border-red bg-[var(--red-light)]"
          : "border-border bg-surface-2",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "size-[9px] shrink-0 rounded-full",
            a.isHard
              ? "bg-red"
              : a.blocksIssuance
                ? "bg-[#d9a441]"
                : "bg-[#3f8f5f]",
          )}
        />
        <span className="text-[12.5px] font-bold text-heading">
          {a.number}. {a.labelAr}
        </span>
        <span
          className={cn(
            "rounded-full border border-border bg-surface px-2 py-0.5 text-[10.5px] font-bold",
            a.isHard ? "text-red-text" : "text-gold-d",
          )}
        >
          {a.isHard
            ? "حاجب"
            : needsRationale
              ? "يتطلب مبرراً نصياً"
              : "يتطلب إقراراً"}
        </span>
      </div>
      {a.detailAr ? (
        <p className="text-[11.5px] leading-5 text-text-2">
          <KeepCodesTogether text={a.detailAr} />
        </p>
      ) : null}
      {needsRationale ? (
        <>
          <input
            id={`alert-override-${a.code}`}
            value={ov.overrideRationale}
            placeholder="المبرر النصي لتجاوز التنبيه…"
            aria-label={`مبرر تجاوز التنبيه ${a.number}`}
            aria-invalid={error ? true : undefined}
            onChange={(e) => onPatch({ overrideRationale: e.target.value })}
            className={cn(
              "rounded-[7px] border border-dashed border-border-md bg-surface px-2.5 py-[7px] text-xs",
              error && invalidControlClass,
            )}
          />
          {error ? <p className="m-0 text-[11px] text-danger-text">{error}</p> : null}
        </>
      ) : null}
      {needsAck ? (
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-text">
          <input
            type="checkbox"
            checked={ov.acknowledged}
            onChange={(e) => onPatch({ acknowledged: e.target.checked })}
            className="size-[15px]"
          />
          أقرّ بالاطلاع على هذا التنبيه والوعي بأثره
        </label>
      ) : null}
      {a.isHard ? (
        <span className="text-[11px] text-red-text">
          تنبيه حاجب — يُعالَج بتصحيح المدخلات نفسها لا بالتجاوز.
        </span>
      ) : null}
    </div>
  );
}
