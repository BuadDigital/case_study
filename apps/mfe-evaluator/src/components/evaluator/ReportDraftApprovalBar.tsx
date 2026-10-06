"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, cn, confirmAction, opsFldControl, promptAction, useToast } from "@platform/ui-kit";
import {
  approveReportDraft,
  registerDepositCertificate,
  withdrawReportDraftApproval,
  type ValuationReportDraftDto,
} from "@platform/api-client";
import { notifyTasksChanged } from "@platform/app-shared/workflow/task-types";
import { FinalReportDownload } from "./FinalReportDownload";
import { reportDraftKey, useSetReportDraft } from "./useReportDraft";
import { apiConfig } from "./valuation-work/lib/shell-utils";

const MAX_CERTIFICATE_BYTES = 10 * 1024 * 1024;

/** The report date is the approval date: today's date on the appraiser's device (the server checks it). */
function todayIso(): string {
  return new Date().toLocaleDateString("en-CA");
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("تعذّر قراءة الملف"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * The appraiser's side of the report draft the specialist sent: he approves it (the printed report as he
 * sees it is kept, and the report date is fixed); after uploading it to Qeema he records the deposit code and
 * the one-page PDF certificate (both required), which issues the final report; he can take his approval back
 * before the code is recorded, and correct the code afterwards. Nothing shows while the specialist prepares.
 */
export function ReportDraftApprovalBar({
  propertyId,
  draft,
  buildApprovedHtml,
}: {
  propertyId: string;
  draft: ValuationReportDraftDto;
  /** Builds the printed report with the approval date (the browser's own print HTML). */
  buildApprovedHtml: (reportDate: string) => Promise<string>;
}) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const setDraft = useSetReportDraft(propertyId);
  const [depositCode, setDepositCode] = useState("");
  const [certificate, setCertificate] = useState<File | null>(null);
  const [editingCode, setEditingCode] = useState(false);
  const [busy, setBusy] = useState(false);

  if (draft.status !== "sent" && draft.status !== "approved") return null;

  const finalIssued = draft.reportStage === "final_issued";

  async function approve() {
    const config = apiConfig();
    if (!config || busy) return;
    const confirmed = await confirmAction({
      title: "اعتماد تقرير التقييم",
      message: "يُثبَّت تاريخ اليوم تاريخاً للتقرير ويُجمَّد، ثم ترفعه على «قيمة» وتسجّل رمز الإيداع.",
      confirmLabel: "اعتماد التقرير",
    });
    if (!confirmed) return;
    // The report date is the approval date, taken once so the printed copy and the record agree.
    const reportDate = todayIso();
    setBusy(true);
    try {
      const html = await buildApprovedHtml(reportDate);
      const res = await approveReportDraft(config, draft.valuationRequestId, { reportDate, html });
      if (!res.ok) {
        showToast(res.message ?? "تعذّر اعتماد التقرير", "error");
        return;
      }
      setDraft(res.data);
      showToast("اعتُمد تقرير التقييم", "success");
    } catch {
      showToast("تعذّر تجهيز نسخة التقرير للاعتماد", "error");
    } finally {
      setBusy(false);
    }
  }

  async function withdrawApproval() {
    const config = apiConfig();
    if (!config || busy) return;
    const note = await promptAction({
      title: "سحب الاعتماد",
      label: "ملاحظة للأخصائي عن سبب سحب الاعتماد (اختياري)",
      confirmLabel: "سحب الاعتماد",
    });
    if (note === null) return;
    setBusy(true);
    try {
      const res = await withdrawReportDraftApproval(config, draft.valuationRequestId, note.trim() || undefined);
      if (!res.ok) {
        showToast(res.message ?? "تعذّر سحب الاعتماد", "error");
        return;
      }
      setDraft(res.data);
      showToast("سُحب الاعتماد — عدّل ثم اعتمد من جديد", "success");
    } finally {
      setBusy(false);
    }
  }

  /** Records the deposit code and the certificate (final copy), or only corrects the code afterwards. */
  async function recordDeposit(codeOnly: boolean) {
    const config = apiConfig();
    if (!config || busy) return;
    const code = depositCode.trim();
    if (!code) {
      showToast("اكتب رمز الإيداع", "error");
      return;
    }
    if (!codeOnly) {
      if (!certificate) {
        showToast("أرفق شهادة الإيداع (PDF)", "error");
        return;
      }
      if (!/\.pdf$/i.test(certificate.name) && certificate.type !== "application/pdf") {
        showToast("شهادة الإيداع ملف PDF", "error");
        return;
      }
      if (certificate.size > MAX_CERTIFICATE_BYTES) {
        showToast("حجم شهادة الإيداع أكبر من 10 م.ب", "error");
        return;
      }
    }
    setBusy(true);
    try {
      const body =
        codeOnly || !certificate
          ? { depositCode: code }
          : {
              depositCode: code,
              certificateFileName: certificate.name,
              certificateContentType: "application/pdf",
              certificateContentBase64: await readFileAsBase64(certificate),
            };
      const res = await registerDepositCertificate(config, draft.valuationRequestId, body);
      if (!res.ok) {
        showToast(res.message ?? "تعذّر تسجيل رمز الإيداع", "error");
        return;
      }
      setCertificate(null);
      setEditingCode(false);
      await queryClient.invalidateQueries({ queryKey: reportDraftKey(propertyId) });
      notifyTasksChanged();
      showToast(codeOnly ? "عُدِّل رمز الإيداع" : "صدر التقرير النهائي", "success");
    } catch {
      showToast("تعذّر تسجيل رمز الإيداع", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="mb-3 flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-surface-2 px-3.5 py-3"
      data-testid="report-draft-approval-bar"
    >
      {draft.status === "sent" ? (
        <>
          <p className="m-0 text-[12.5px] font-semibold text-heading">
            أرسل الأخصائي مسودة تقرير التقييم — راجع التقرير أدناه ثم اعتمده.
          </p>
          {draft.specialistNote ? (
            <p className="m-0 text-[12px] text-text-2">ملاحظة الأخصائي: {draft.specialistNote}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[12px] font-semibold text-text-2">تاريخ التقرير: تاريخ الاعتماد (اليوم)</span>
            <Button type="button" variant="accent" size="sm" disabled={busy} onClick={() => void approve()}>
              {busy ? "جاري الاعتماد…" : "اعتماد التقرير"}
            </Button>
          </div>
        </>
      ) : finalIssued ? (
        <div className="flex flex-col gap-2" data-testid="report-final-issued">
          <p className="m-0 text-[12.5px] font-semibold text-heading">
            صدر التقرير النهائي — تاريخ التقرير {draft.reportDate ?? "—"}، رمز الإيداع{" "}
            <span dir="ltr">{draft.depositCode ?? "—"}</span>
            {draft.certificateFileName ? ` · الشهادة: ${draft.certificateFileName}` : ""}.
          </p>
          <FinalReportDownload propertyId={propertyId} draft={draft} />
          {editingCode ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={cn(opsFldControl, "!w-[220px] font-medium")}
                dir="ltr"
                placeholder="رمز الإيداع الصحيح"
                value={depositCode}
                disabled={busy}
                onChange={(e) => setDepositCode(e.target.value)}
              />
              <Button type="button" variant="accent" size="sm" disabled={busy} onClick={() => void recordDeposit(true)}>
                حفظ الرمز
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setEditingCode(false)}>
                إلغاء
              </Button>
            </div>
          ) : (
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setDepositCode(draft.depositCode ?? "");
                  setEditingCode(true);
                }}
              >
                تعديل رمز الإيداع
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2" data-testid="report-deposit-step">
          <p className="m-0 text-[12.5px] font-semibold text-heading">
            اعتُمد التقرير — تاريخ التقرير {draft.reportDate ?? "—"}. ارفعه على «قيمة» ثم سجّل رمز الإيداع وأرفق
            شهادة الإيداع (PDF من صفحة واحدة) ليصدر التقرير النهائي.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className={cn(opsFldControl, "!w-[220px] font-medium")}
              dir="ltr"
              placeholder="رمز الإيداع"
              value={depositCode}
              disabled={busy}
              onChange={(e) => setDepositCode(e.target.value)}
            />
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="text-[12px]"
              disabled={busy}
              onChange={(e) => setCertificate(e.target.files?.[0] ?? null)}
            />
            <Button type="button" variant="accent" size="sm" disabled={busy} onClick={() => void recordDeposit(false)}>
              {busy ? "جاري التسجيل…" : "تسجيل رمز الإيداع وإصدار التقرير النهائي"}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void withdrawApproval()}>
              سحب الاعتماد
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
