// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • O17  The «اعتماد التقرير» confirm goes through confirmIgnoringDoubleClick and the button ignores the
//         second click of a double-click (e.detail > 1) — a double-click no longer dismisses the confirm.
// Round 2 (1b19bedc)
//  • A refused report-number / approval / deposit-code call shows a RefusalPanel («إخفاء» closes it)
//          listing every reason (refusalLines: each error and message line, de-duplicated) instead of only a
//          toast; the toast still shows the first line. Retrying clears the panel.
// ──────────────────────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useState } from "react";
import { Button, promptAction, useToast } from "@platform/ui-kit";
import {
  approveReportDraft,
  ensureReportNumber,
  withdrawReportDraftApproval,
  type ValuationReportDraftDto,
} from "@platform/api-client";
import { confirmIgnoringDoubleClick } from "../../lib/evaluator/confirm-ignoring-double-click";
import { FinalReportDownload } from "./FinalReportDownload";
import { PhaseNote, RefusalPanel, refusalLines, type Refusal } from "./ReportDraftFeedback";
import { useSetReportDraft } from "./useReportDraft";
import { apiConfig } from "./valuation-work/lib/shell-utils";

/** Which action is in flight — each button spins on its own, the others stay disabled. */
type BusyAction = "approve" | "withdraw" | null;

/** The report date is the approval date: today's date on the appraiser's device (the server checks it). */
function todayIso(): string {
  return new Date().toLocaleDateString("en-CA");
}

/**
 * The appraiser's side of the report draft the specialist sent: he approves it (the printed report as he
 * sees it is kept, and the report date is fixed), and can take his approval back until the deposit is
 * recorded. The specialist then deposits the report in Qeema and records its code and certificate
 * (`ReportDepositStep`); the bar only says so, then offers the final report. Nothing shows while the
 * specialist prepares.
 */
export function ReportDraftApprovalBar({
  propertyId,
  draft,
  buildApprovedHtml,
}: {
  propertyId: string;
  draft: ValuationReportDraftDto;
  /**
   * Builds the printed report with the approval date and the report number the server just fixed
   * (the browser's own print HTML); reports its steps.
   */
  buildApprovedHtml: (
    reportDate: string,
    onPhase: (phase: string) => void,
    reportNumber: string,
  ) => Promise<string>;
}) {
  const { showToast } = useToast();
  const setDraft = useSetReportDraft(propertyId);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const refuse = (title: string, res: { message?: string; errors?: Record<string, string> }) => {
    const lines = refusalLines(res, title);
    setRefusal({ title, lines });
    showToast(lines[0] ?? title, "error");
  };

  // Approval takes tens of seconds (report build and upload): leaving the page mid-way loses it.
  const guardUnload = busy === "approve";
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

  /**
   * The appraiser's «اعتماد التقرير» action.
   *
   * How it works: asks for confirmation; takes today as the report date once; calls
   * `ensureReportNumber` for the draft's valuation request; builds the printed copy with that
   * date and the returned `reportNumber` (`buildApprovedHtml`); uploads it with
   * `approveReportDraft`; on success stores the returned draft and toasts. Each step shows in
   * the phase note, and leaving the page is guarded while it runs.
   *
   * Edge cases: — the number (PRV-… from the transaction's PR root) is
   * fixed before the copy is printed; if it cannot be fixed, the refusal shows and nothing is
   * built or approved. A refused approval leaves the draft as it was; a double-click or a busy
   * bar does nothing.
   */
  async function approve() {
    const config = apiConfig();
    if (!config || anyBusy) return;
    // A double-click opens the confirm once and its second click never dismisses it.
    const confirmed = await confirmIgnoringDoubleClick({
      title: "اعتماد تقرير التقييم",
      message: "يُثبَّت تاريخ اليوم تاريخاً للتقرير ويُجمَّد، ثم يودعه الأخصائي في «قيمة» ويسجّل رمز الإيداع.",
      confirmLabel: "اعتماد التقرير",
    });
    if (!confirmed) return;
    // The report date is the approval date, taken once so the printed copy and the record agree.
    const reportDate = todayIso();
    setRefusal(null);
    setBusy("approve");
    setPhase("تثبيت رقم التقرير…");
    try {
      // The number is fixed first (PRV-… from the transaction's PR root) so the
      // printed copy carries it; without it nothing is approved.
      const numbered = await ensureReportNumber(config, draft.valuationRequestId);
      if (!numbered.ok) {
        refuse("تعذّر تثبيت رقم التقرير", numbered);
        return;
      }
      setPhase("تجهيز نسخة التقرير…");
      const html = await buildApprovedHtml(reportDate, setPhase, numbered.data.reportNumber);
      setPhase("رفع نسخة التقرير المعتمدة…");
      const res = await approveReportDraft(config, draft.valuationRequestId, { reportDate, html });
      if (!res.ok) {
        refuse("تعذّر اعتماد التقرير", res);
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

  return (
    <div
      className="mb-3 flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-surface-2 px-3.5 py-3"
      data-testid="report-draft-approval-bar"
      aria-busy={anyBusy || undefined}
    >
      {refusal ? <RefusalPanel refusal={refusal} onClose={() => setRefusal(null)} /> : null}
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
              onClick={(e) => {
                if (e.detail > 1) return; // the tail of a double-click — the first click already asked
                void approve();
              }}
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
        </div>
      ) : (
        <div className="flex flex-col gap-2" data-testid="report-awaiting-deposit">
          <p className="m-0 text-[12.5px] font-semibold text-heading">
            اعتُمد التقرير — تاريخ التقرير {draft.reportDate ?? "—"}. يودعه الأخصائي في «قيمة» ويسجّل رمز الإيداع
            والشهادة، فيصدر التقرير النهائي.
          </p>
          <div>
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
        </div>
      )}
    </div>
  );
}
