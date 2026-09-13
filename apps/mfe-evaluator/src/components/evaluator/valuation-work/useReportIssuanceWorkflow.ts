"use client";

import { useEffect, useState } from "react";
import {
  getIssuancePdf,
  getReportIssuanceState,
  issueDepositVersion,
  registerDepositCertificate,
  reopenReportIssuance,
  type ValuationReportIssuanceStateDto,
} from "@platform/api-client";
import { useToast } from "@platform/ui-kit";
import { fileToBase64 } from "@platform/app-shared/media/file-encoding";

import { JUSTIFICATION_MIN_LENGTH, apiConfig } from "./lib/shell-utils";

/**
 * Rule Q-6 two-stage issuance — deposit freeze, certificate register, reopen.
 * Lives on المراجعة النهائية, not on the final-opinion screen.
 */
export function useReportIssuanceWorkflow({
  valuationRequestId,
  allowsIssuance,
}: {
  valuationRequestId: string | null;
  allowsIssuance?: boolean;
}) {
  const { showToast } = useToast();
  const [issuance, setIssuance] =
    useState<ValuationReportIssuanceStateDto | null>(null);
  const [issuanceBusy, setIssuanceBusy] = useState(false);
  const [depositCodeDraft, setDepositCodeDraft] = useState("");
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuationRequestId, allowsIssuance]);

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

  const reopenIssuance = async () => {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    const reason = reopenReason.trim();
    if (reason.length < JUSTIFICATION_MIN_LENGTH) {
      showToast("سبب إعادة الفتح مطلوب (ق-8)", "error");
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
    showToast(
      "أُعيد فتح دور التقييم — النسخة السابقة ملغاة وتبقى بالملف (ر2)",
      "success",
    );
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

  return {
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
  };
}

export type ReportIssuanceWorkflow = ReturnType<typeof useReportIssuanceWorkflow>;
