"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  activeValuationListOptions,
  getIssuancePdf,
  getReportIssuanceState,
  getValuationReportDocument,
  issueDepositVersion,
  registerDepositCertificate,
  reopenReportIssuance,
  saveValuationReconciliation,
  type ValuationCostApproachDto,
  type ValuationIssuanceGatesDto,
  type ValuationReconciliationDto,
  type ValuationReconciliationMethodDto,
  type ValuationReportIssuanceStateDto,
} from "@platform/api-client";
import { useToast } from "@platform/ui-kit";
import { useValuationListsQuery } from "@platform/app-shared/query/valuation-lists-query";
import { fileToBase64 } from "@platform/app-shared/media/file-encoding";
import {
  VALUE_BASIS_OPTIONS,
  basisOfValueKeyForAssignment,
} from "@platform/app-shared/app-data/assignment-valuation-defaults";

import {
  finalOpinionComputed,
  mergeReconMethods,
  reconciliationSaveRequest,
} from "./lib/final-opinion-state";
import { JUSTIFICATION_MIN_LENGTH, apiConfig } from "./lib/shell-utils";

export type FinalOpinionWorkflowArgs = {
  valuationRequestId: string | null;
  recon: ValuationReconciliationDto | null;
  gates: ValuationIssuanceGatesDto | null;
  cost: ValuationCostApproachDto | null;
  hydrateKey: number;
  buildingOnly: boolean;
  hasAdoptedMarket: boolean;
  assignmentType?: string;
  onSavingChange: (saving: boolean) => void;
  onReconSaved: (dto: ValuationReconciliationDto) => void;
};

/**
 * Owns the final-opinion screen: the reconciliation drafts and their
 * hydration, the live value calc, the reconciliation save, the report preview
 * and the whole Rule Q-6 two-stage issuance cycle.
 */
export function useFinalOpinionWorkflow({
  valuationRequestId,
  recon,
  gates,
  cost,
  hydrateKey,
  buildingOnly,
  hasAdoptedMarket,
  assignmentType,
  onSavingChange,
  onReconSaved,
}: FinalOpinionWorkflowArgs) {
  const { showToast } = useToast();
  const [reconMethods, setReconMethods] = useState<ValuationReconciliationMethodDto[]>(
    [],
  );
  const [methodsRationale, setMethodsRationale] = useState("");
  const [finalRoundDecimals, setFinalRoundDecimals] = useState("0");
  // Pure derivation from assignment type — not user-controlled and not overwritten by saved state
  // (rerender-derived-state-no-effect; was state written from five places with the same value).
  const basisOfValueKey = useMemo(
    () =>
      assignmentType?.trim()
        ? basisOfValueKeyForAssignment(assignmentType)
        : "market",
    [assignmentType],
  );
  const [valuePremiseKey, setValuePremiseKey] = useState("");
  const [liquidationDiscountPct, setLiquidationDiscountPct] = useState("0");
  const [liquidationDiscountRationale, setLiquidationDiscountRationale] =
    useState("");
  const [alertOverrides, setAlertOverrides] = useState<
    Record<string, { overrideRationale: string; acknowledged: boolean }>
  >({});

  /* ─── Rule Q-6: two-stage issuance + deposit certificate ─── */
  const [issuance, setIssuance] = useState<ValuationReportIssuanceStateDto | null>(null);
  const [issuanceBusy, setIssuanceBusy] = useState(false);
  const [depositCodeDraft, setDepositCodeDraft] = useState("");
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  // Supplement Rule Q-9 (R2): reason for reopening the valuation cycle after deposit.
  const [reopenReason, setReopenReason] = useState("");

  const refreshIssuance = async () => {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    const res = await getReportIssuanceState(config, valuationRequestId);
    if (res.ok) {
      setIssuance(res.data);
      if (res.data.depositCode) setDepositCodeDraft(res.data.depositCode);
    }
  };

  useEffect(() => {
    void refreshIssuance();
    // State is also refreshed after reconciliation save (gates may change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuationRequestId, gates?.allowsIssuance]);

  const issueDeposit = async () => {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    setIssuanceBusy(true);
    const res = await issueDepositVersion(config, valuationRequestId);
    setIssuanceBusy(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر إصدار نسخة الإيداع", "error");
      return;
    }
    setIssuance(res.data);
    showToast("صدرت نسخة الإيداع — التقرير مجمّد (ق-6)", "success");
  };

  const registerCertificate = async () => {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    const code = depositCodeDraft.trim();
    if (!code) {
      showToast("أدخل رمز الإيداع من شهادة منصة قيمة", "error");
      return;
    }
    setIssuanceBusy(true);
    let certificateContentBase64: string | null = null;
    if (certificateFile) {
      // Chunked encoding via the shared helper — a char-by-char loop used to freeze
      // the tab for seconds on large certificate images (js-perf).
      certificateContentBase64 = await fileToBase64(certificateFile);
    }
    const res = await registerDepositCertificate(config, valuationRequestId, {
      depositCode: code,
      certificateFileName: certificateFile?.name ?? null,
      certificateContentType: certificateFile?.type ?? null,
      certificateContentBase64,
    });
    setIssuanceBusy(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر تسجيل الشهادة", "error");
      return;
    }
    setIssuance(res.data);
    showToast("سُجِّلت الشهادة وصدرت النسخة النهائية (ق-6)", "success");
  };

  // R2: deposited version is not edited — marked “superseded — replaced by a newer version” and kept
  // on file; a new valuation cycle opens ending in deposit version N+1 (section-supervisor approval is a server rule).
  const reopenIssuance = async () => {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    const reason = reopenReason.trim();
    if (reason.length < JUSTIFICATION_MIN_LENGTH) {
      showToast(
        `سبب إعادة الفتح لا يقل عن ${JUSTIFICATION_MIN_LENGTH} أحرف (ق-8)`,
        "error",
      );
      return;
    }
    setIssuanceBusy(true);
    const res = await reopenReportIssuance(config, valuationRequestId, reason);
    setIssuanceBusy(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر إعادة فتح دور التقييم", "error");
      return;
    }
    setIssuance(res.data);
    setReopenReason("");
    setDepositCodeDraft("");
    setCertificateFile(null);
    showToast("أُعيد فتح دور التقييم — النسخة السابقة ملغاة وتبقى بالملف (ر2)", "success");
  };

  const downloadIssuancePdf = async (kind: "deposit" | "final") => {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    const res = await getIssuancePdf(config, valuationRequestId, kind);
    if (!res.ok) {
      showToast("تعذّر تنزيل النسخة", "error");
      return;
    }
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      kind === "deposit" ? "نسخة-الإيداع.pdf" : "النسخة-النهائية.pdf";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Valuation lists from the shared query — used to duplicate a GET with the final-review tab.
  const { data: valuationLists } = useValuationListsQuery();
  const basisOptions = useMemo(() => {
    const bases = valuationLists
      ? activeValuationListOptions(valuationLists.lists, "valueBases")
      : [];
    return bases.length ? bases : VALUE_BASIS_OPTIONS;
  }, [valuationLists]);
  const premiseOptions = useMemo<{ value: string; label: string }[]>(() => {
    return valuationLists
      ? activeValuationListOptions(valuationLists.lists, "premises")
      : [];
  }, [valuationLists]);

  // Value basis always comes from the work order (PO) — do not force liquidation when type is absent.
  useEffect(() => {
    if (!assignmentType?.trim()) return;
    const next = basisOfValueKeyForAssignment(assignmentType);
    if (next === "liquidation") {
      setValuePremiseKey((prev) =>
        prev === "orderly" || prev === "forced" ? prev : "orderly",
      );
    } else {
      setLiquidationDiscountPct("0");
      setValuePremiseKey((prev) =>
        prev === "orderly" || prev === "forced" ? "current" : prev,
      );
    }
  }, [assignmentType]);

  // Hydration: new key = full load (full reseed); same key with a new batch = silent
  // reload that merges computed approach values and keeps user weights/rationales.
  const hydratedKeyRef = useRef<number | null>(null);
  useEffect(() => {
    if (hydratedKeyRef.current === hydrateKey) {
      if (recon) {
        setReconMethods((prev) => mergeReconMethods(recon.methods, prev));
      }
      return;
    }
    hydratedKeyRef.current = hydrateKey;
    if (!recon) {
      setReconMethods([]);
      setMethodsRationale("");
      setFinalRoundDecimals("0");
      if (assignmentType?.trim()) {
        setValuePremiseKey(
          basisOfValueKeyForAssignment(assignmentType) === "liquidation"
            ? "orderly"
            : "",
        );
      }
      setLiquidationDiscountPct("0");
      setLiquidationDiscountRationale("");
      setAlertOverrides({});
      return;
    }
    setReconMethods(recon.methods);
    setMethodsRationale(recon.methodsRationale ?? "");
    setFinalRoundDecimals(String(recon.finalRoundDecimals ?? 0));
    // Value basis from the work order (PO) only — not overwritten by previously saved reconciliation.
    if (assignmentType?.trim()) {
      const nextBasis = basisOfValueKeyForAssignment(assignmentType);
      let nextPremise = recon.valuePremiseKey || "";
      if (nextBasis === "liquidation") {
        if (nextPremise !== "orderly" && nextPremise !== "forced") {
          nextPremise = "orderly";
        }
      }
      setValuePremiseKey(nextPremise);
    } else {
      setValuePremiseKey(recon.valuePremiseKey || "");
    }
    setLiquidationDiscountPct(String(recon.liquidationDiscountPct ?? 0));
    setLiquidationDiscountRationale(recon.liquidationDiscountRationale ?? "");
    const ovMap: Record<
      string,
      { overrideRationale: string; acknowledged: boolean }
    > = {};
    for (const o of recon.methodologyAlertOverrides ?? []) {
      ovMap[o.code] = {
        overrideRationale: o.overrideRationale ?? "",
        acknowledged: o.acknowledged ?? false,
      };
    }
    setAlertOverrides(ovMap);
  }, [hydrateKey, recon, assignmentType]);

  /* ─── Live value-opinion calc (interactive-form spec) ─── */
  /* ─── Live value-opinion calc (interactive-form spec) ─── */
  const finalComputed = useMemo(
    () =>
      finalOpinionComputed({
        reconMethods,
        basisOfValueKey,
        basisOptions,
        liquidationDiscountPct,
        finalRoundDecimals,
        cost,
        buildingOnly,
        hasAdoptedMarket,
      }),
    [
      buildingOnly,
      reconMethods,
      basisOfValueKey,
      liquidationDiscountPct,
      finalRoundDecimals,
      basisOptions,
      cost,
      hasAdoptedMarket,
    ],
  );

  async function saveReconciliation() {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    onSavingChange(true);
    const res = await saveValuationReconciliation(
      config,
      valuationRequestId,
      reconciliationSaveRequest(
        {
          reconMethods,
          methodsRationale,
          finalRoundDecimals,
          basisOfValueKey,
          valuePremiseKey,
          liquidationDiscountPct,
          liquidationDiscountRationale,
          alertOverrides,
        },
        finalComputed.opinionAuto,
      ),
    );
    onSavingChange(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ الترجيح", "error");
      return;
    }
    setReconMethods(res.data.methods);
    setMethodsRationale(res.data.methodsRationale ?? "");
    setFinalRoundDecimals(String(res.data.finalRoundDecimals ?? 0));
    setValuePremiseKey(res.data.valuePremiseKey || "");
    setLiquidationDiscountPct(String(res.data.liquidationDiscountPct ?? 0));
    setLiquidationDiscountRationale(res.data.liquidationDiscountRationale ?? "");
    showToast(
      res.data.liquidationDiscountApplied
        ? "تم حفظ رأي القيمة مع خصم التصفية"
        : "تم حفظ رأي القيمة النهائي",
      "success",
    );
    // Refresh issuance gates and alerts after save (dispositions apply to evaluation immediately).
    onReconSaved(res.data);
  }

  async function openReportPreview() {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    onSavingChange(true);
    const res = await getValuationReportDocument(config, valuationRequestId);
    onSavingChange(false);
    if (!res.ok) {
      showToast("تعذّر تحميل استعراض تقرير التقييم", "error");
      return;
    }
    try {
      // Lazy load — preview builder is fetched on first click, not with the screen bundle.
      const { openValuationReportPreview } = await import(
        "../../../lib/evaluator/valuation-report-preview"
      );
      await openValuationReportPreview(res.data);
    } catch {
      showToast("تعذّر فتح استعراض تقرير التقييم", "error");
    }
  }

  const sole = recon && !recon.meetsMultiMethodGate;
  const {
    weightSumLocal,
    reconWeightsBad,
    weightedLocal,
    isLiquidation,
    forcedCut,
    finalLocal,
    roundNote,
    soleCost,
    methodComplete,
    opinionAuto,
  } = finalComputed;
  // Treated as manually edited only when it differs from auto text (save pins auto without counting as an edit).
  const opinionDirty =
    methodsRationale.trim().length > 0 &&
    methodsRationale.trim() !== opinionAuto.trim();

  // Single pass instead of filtering twice in the same render (js-combine-iterations).
  const triggeredAlerts = gates
    ? gates.methodologyAlerts.filter((a) => a.triggered)
    : [];
  return {
    // Reconciliation drafts.
    reconMethods,
    setReconMethods,
    methodsRationale,
    setMethodsRationale,
    finalRoundDecimals,
    setFinalRoundDecimals,
    basisOfValueKey,
    basisOptions,
    premiseOptions,
    valuePremiseKey,
    setValuePremiseKey,
    liquidationDiscountPct,
    setLiquidationDiscountPct,
    liquidationDiscountRationale,
    setLiquidationDiscountRationale,
    alertOverrides,
    setAlertOverrides,
    // Derived.
    sole,
    finalComputed,
    weightSumLocal,
    reconWeightsBad,
    weightedLocal,
    isLiquidation,
    forcedCut,
    finalLocal,
    roundNote,
    soleCost,
    methodComplete,
    opinionAuto,
    opinionDirty,
    triggeredAlerts,
    // Issuance (Rule Q-6).
    issuance,
    issuanceBusy,
    depositCodeDraft,
    setDepositCodeDraft,
    certificateFile,
    setCertificateFile,
    reopenReason,
    setReopenReason,
    issueDeposit,
    registerCertificate,
    reopenIssuance,
    downloadIssuancePdf,
    // Commands.
    saveReconciliation,
    openReportPreview,
  };
}

export type FinalOpinionWorkflow = ReturnType<typeof useFinalOpinionWorkflow>;
