"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Spinner, cn, confirmAction, opsFldControl, promptAction, useToast } from "@platform/ui-kit";
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

/** Which action is in flight — each button spins on its own, the others stay disabled. */
type BusyAction = "approve" | "withdraw" | "deposit" | "code" | null;

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

/** The step the long actions are on — approval builds and uploads the printed report, the deposit renders the final PDF. */
function PhaseNote({ phase, hint }: { phase: string | null; hint?: string }) {
  if (!phase) return null;
  return (
    <p className="m-0 flex items-center gap-2 text-[12px] text-text-2" role="status" aria-live="polite">
      <Spinner />
      <span>
        {phase}
        {hint ? <span className="text-text-3"> — {hint}</span> : null}
      </span>
    </p>
  );
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
  /** Builds the printed report with the approval date (the browser's own print HTML); reports its steps. */
  buildApprovedHtml: (reportDate: string, onPhase: (phase: string) => void) => Promise<string>;
}) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const setDraft = useSetReportDraft(propertyId);
  const [depositCode, setDepositCode] = useState("");
  const [certificate, setCertificate] = useState<File | null>(null);
  const [editingCode, setEditingCode] = useState(false);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [phase, setPhase] = useState<string | null>(null);

  // Approval and deposit take tens of seconds (report build, PDF render): leaving the page mid-way loses them.
  const guardUnload = busy === "approve" || busy === "deposit";
  useEffect(() => {
    if (!guardUnload) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [guardUnload]);

  if (draft.status !== "sent" && draft.status !== "approved") return null;

  const finalIssued = draft.reportStage === "final_issued";
  const anyBusy = busy !== null;

  async function approve() {
    const config = apiConfig();
    if (!config || anyBusy) return;
    const confirmed = await confirmAction({
      title: "اعتماد تقرير التقييم",
      message: "يُثبَّت تاريخ اليوم تاريخاً للتقرير ويُجمَّد، ثم ترفعه على «قيمة» وتسجّل رمز الإيداع.",
      confirmLabel: "اعتماد التقرير",
    });
    if (!confirmed) return;
    // The report date is the approval date, taken once so the printed copy and the record agree.
    const reportDate = todayIso();
    setBusy("approve");
    setPhase("تجهيز نسخة التقرير…");
    try {
      const html = await buildApprovedHtml(reportDate, setPhase);
      setPhase("رفع نسخة التقرير المعتمدة…");
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
      setBusy(null);
      setPhase(null);
    }
  }

  async function withdrawApproval() {
    const config = apiConfig();
    if (!config || anyBusy) return;
    const note = await promptAction({
      title: "سحب الاعتماد",
      label: "ملاحظة للأخصائي عن سبب سحب الاعتماد (اختياري)",
      confirmLabel: "سحب الاعتماد",
    });
    if (note === null) return;
    setBusy("withdraw");
    try {
      const res = await withdrawReportDraftApproval(config, draft.valuationRequestId, note.trim() || undefined);
      if (!res.ok) {
        showToast(res.message ?? "تعذّر سحب الاعتماد", "error");
        return;
      }
      setDraft(res.data);
      showToast("سُحب الاعتماد — عدّل ثم اعتمد من جديد", "success");
    } finally {
      setBusy(null);
    }
  }

  /** Records the deposit code and the certificate (final copy), or only corrects the code afterwards. */
  async function recordDeposit(codeOnly: boolean) {
    const config = apiConfig();
    if (!config || anyBusy) return;
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
    setBusy(codeOnly ? "code" : "deposit");
    // The server renders the final PDF (report + code + certificate) inside this call; it is the slow part.
    setPhase(codeOnly ? "حفظ الرمز وتحديث ملف التقرير النهائي…" : "قراءة الشهادة…");
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
      if (!codeOnly) setPhase("تسجيل الرمز وتوليد ملف التقرير النهائي (PDF)…");
      const res = await registerDepositCertificate(config, draft.valuationRequestId, body);
      if (!res.ok) {
        showToast(res.message ?? "تعذّر تسجيل رمز الإيداع", "error");
        return;
      }
      setCertificate(null);
      setEditingCode(false);
      setPhase("تحديث حالة التقرير…");
      await queryClient.invalidateQueries({ queryKey: reportDraftKey(propertyId) });
      notifyTasksChanged();
      showToast(codeOnly ? "عُدِّل رمز الإيداع" : "صدر التقرير النهائي", "success");
    } catch {
      showToast("تعذّر تسجيل رمز الإيداع", "error");
    } finally {
      setBusy(null);
      setPhase(null);
    }
  }

  return (
    <div
      className="mb-3 flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-surface-2 px-3.5 py-3"
      data-testid="report-draft-approval-bar"
      aria-busy={anyBusy || undefined}
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
            <Button
              type="button"
              variant="accent"
              size="sm"
              loading={busy === "approve"}
              disabled={anyBusy}
              onClick={() => void approve()}
            >
              {busy === "approve" ? "جاري الاعتماد…" : "اعتماد التقرير"}
            </Button>
          </div>
          <PhaseNote phase={busy === "approve" ? phase : null} hint="قد يستغرق نحو دقيقة، لا تغلق الصفحة" />
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
                disabled={anyBusy}
                onChange={(e) => setDepositCode(e.target.value)}
              />
              <Button
                type="button"
                variant="accent"
                size="sm"
                loading={busy === "code"}
                disabled={anyBusy}
                onClick={() => void recordDeposit(true)}
              >
                {busy === "code" ? "جاري الحفظ…" : "حفظ الرمز"}
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={anyBusy} onClick={() => setEditingCode(false)}>
                إلغاء
              </Button>
            </div>
          ) : (
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={anyBusy}
                onClick={() => {
                  setDepositCode(draft.depositCode ?? "");
                  setEditingCode(true);
                }}
              >
                تعديل رمز الإيداع
              </Button>
            </div>
          )}
          <PhaseNote phase={busy === "code" ? phase : null} />
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
              disabled={anyBusy}
              onChange={(e) => setDepositCode(e.target.value)}
            />
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="text-[12px]"
              disabled={anyBusy}
              onChange={(e) => setCertificate(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="accent"
              size="sm"
              loading={busy === "deposit"}
              disabled={anyBusy}
              onClick={() => void recordDeposit(false)}
            >
              {busy === "deposit" ? "جاري التسجيل…" : "تسجيل رمز الإيداع وإصدار التقرير النهائي"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={busy === "withdraw"}
              disabled={anyBusy}
              onClick={() => void withdrawApproval()}
            >
              {busy === "withdraw" ? "جاري السحب…" : "سحب الاعتماد"}
            </Button>
          </div>
          <PhaseNote
            phase={busy === "deposit" ? phase : null}
            hint="يُولَّد ملف التقرير النهائي على الخادم، قد يستغرق نحو دقيقة، لا تغلق الصفحة"
          />
        </div>
      )}
    </div>
  );
}
