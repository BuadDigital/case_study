"use client";

import { useEffect, useState } from "react";
import {
  saveValuationReconciliation,
  type ValuationIssuanceGatesDto,
  type ValuationMethodologyAlertItemDto,
  type ValuationReconciliationDto,
} from "@platform/api-client";
import { cn, useToast } from "@platform/ui-kit";

import { Card, CardPad, PrimaryBtn } from "./atoms";
import {
  alertOverridesFromRecon,
  reconciliationSaveRequest,
  type AlertOverrideRecord,
} from "./lib/final-opinion-state";
import { isMarketMethodologyAlert } from "./lib/methodology-alerts";
import { JUSTIFICATION_MIN_LENGTH, apiConfig } from "./lib/shell-utils";

function draftFromRecon(recon: ValuationReconciliationDto | null) {
  return {
    reconMethods: recon?.methods ?? [],
    methodsRationale: recon?.methodsRationale ?? "",
    finalRoundDecimals: String(recon?.finalRoundDecimals ?? 0),
    basisOfValueKey: recon?.basisOfValueKey ?? "market",
    valuePremiseKey: recon?.valuePremiseKey ?? "",
    liquidationDiscountPct: String(recon?.liquidationDiscountPct ?? 0),
    liquidationDiscountRationale: recon?.liquidationDiscountRationale ?? "",
    alertOverrides: alertOverridesFromRecon(recon),
  };
}

/** Market-approach methodology alerts — disposition on طريقة المقارنة. */
export function MethodologyAlertsPanel({
  gates,
  recon,
  valuationRequestId,
  saving,
  onSavingChange,
  onReconSaved,
}: {
  gates: ValuationIssuanceGatesDto;
  recon: ValuationReconciliationDto | null;
  valuationRequestId: string | null;
  saving: boolean;
  onSavingChange: (saving: boolean) => void;
  onReconSaved: (dto: ValuationReconciliationDto) => void;
}) {
  const { showToast } = useToast();
  const [alertOverrides, setAlertOverrides] = useState<AlertOverrideRecord>(
    () => alertOverridesFromRecon(recon),
  );

  useEffect(() => {
    setAlertOverrides(alertOverridesFromRecon(recon));
  }, [recon]);

  const triggeredAlerts = gates.methodologyAlerts.filter(
    (a) => a.triggered && isMarketMethodologyAlert(a.number),
  );

  async function saveOverrides(next: AlertOverrideRecord) {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    onSavingChange(true);
    const draft = draftFromRecon(recon);
    const res = await saveValuationReconciliation(
      config,
      valuationRequestId,
      reconciliationSaveRequest(
        { ...draft, alertOverrides: next },
        draft.methodsRationale,
      ),
    );
    onSavingChange(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ معالجة التنبيه", "error");
      return;
    }
    setAlertOverrides(alertOverridesFromRecon(res.data));
    showToast("تم حفظ معالجة التنبيهات المنهجية", "success");
    onReconSaved(res.data);
  }

  function patchOverride(
    code: string,
    patch: Partial<AlertOverrideRecord[string]>,
  ) {
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
        <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2.5">
          <span className="text-[13.5px] font-extrabold text-heading">
            التنبيهات المنهجية
          </span>
          <span className="text-[11px] text-text-3">
            تنبيهات أسلوب السوق (المقارنات والأوزان وتسوية الزمن). تُحفَظ
            المعالجات من هذا التبويب.
          </span>
        </div>
        {triggeredAlerts.length === 0 ? (
          <div className="text-[12.5px] font-bold text-[#2f7a4d]">
            ✓ لا تنبيهات منهجية مفعّلة على أسلوب السوق
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
  onPatch,
}: {
  alert: ValuationMethodologyAlertItemDto;
  override: { overrideRationale: string; acknowledged: boolean };
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
        {a.detailAr ? (
          <span className="text-[11.5px] text-text-2">{a.detailAr}</span>
        ) : null}
      </div>
      {needsRationale ? (
        <>
          <input
            value={ov.overrideRationale}
            placeholder={`المبرر النصي لتجاوز التنبيه (${JUSTIFICATION_MIN_LENGTH} أحرف فأكثر)…`}
            onChange={(e) => onPatch({ overrideRationale: e.target.value })}
            className={cn(
              "rounded-[7px] border border-dashed bg-surface px-2.5 py-[7px] text-xs",
              ov.overrideRationale.trim().length > 0 &&
                ov.overrideRationale.trim().length < JUSTIFICATION_MIN_LENGTH
                ? "border-danger"
                : "border-border-md",
            )}
          />
          {ov.overrideRationale.trim().length > 0 &&
          ov.overrideRationale.trim().length < JUSTIFICATION_MIN_LENGTH ? (
            <span className="text-[10.5px] font-semibold text-danger">
              المبرر الصوري لا يفك التنبيه — الحد الأدنى{" "}
              {JUSTIFICATION_MIN_LENGTH} أحرف (ق-8)
            </span>
          ) : null}
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
