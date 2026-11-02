"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, cn, opsFldControl, useToast } from "@platform/ui-kit";
import { registerDepositCertificate, type ValuationReportDraftDto } from "@platform/api-client";
import { notifyTasksChanged } from "@platform/app-shared/workflow/task-types";
import { PhaseNote, RefusalPanel, refusalLines, type Refusal } from "./ReportDraftFeedback";
import { reportDraftKey } from "./useReportDraft";
import { apiConfig } from "./valuation-work/lib/shell-utils";

const MAX_CERTIFICATE_BYTES = 10 * 1024 * 1024;

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
 * The specialist's deposit step under the report draft, once the appraiser has approved the report.
 *
 * How it works: before the final issuance it asks for the «قيمة» deposit code and the one-page PDF
 * certificate and sends both with `registerDepositCertificate`, which issues the final report on the
 * server; after it, «تعديل رمز الإيداع» re-sends the code alone. The draft query refreshes afterwards.
 *
 * Edge cases: a missing code, a missing certificate, a non-PDF or a file over 10 MB is refused before
 * any call; a refusal stays on screen with every reason; leaving the page is guarded while the final
 * PDF is generated. Shown only to the specialist (the server refuses everyone else).
 */
export function ReportDepositStep({
  propertyId,
  draft,
}: {
  propertyId: string;
  draft: ValuationReportDraftDto;
}) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [depositCode, setDepositCode] = useState("");
  const [certificate, setCertificate] = useState<File | null>(null);
  const [editingCode, setEditingCode] = useState(false);
  const [busy, setBusy] = useState<"deposit" | "code" | null>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);

  // The final PDF is generated inside the call (tens of seconds): leaving the page mid-way loses it.
  const guardUnload = busy === "deposit";
  useEffect(() => {
    if (!guardUnload) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [guardUnload]);

  const finalIssued = draft.reportStage === "final_issued";
  const anyBusy = busy !== null;

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
    setRefusal(null);
    setBusy(codeOnly ? "code" : "deposit");
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
        const lines = refusalLines(res, "تعذّر تسجيل رمز الإيداع");
        setRefusal({ title: "تعذّر تسجيل رمز الإيداع", lines });
        showToast(lines[0] ?? "تعذّر تسجيل رمز الإيداع", "error");
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
    <div className="mb-3 flex flex-col gap-2" data-testid="report-deposit-step" aria-busy={anyBusy || undefined}>
      {refusal ? <RefusalPanel refusal={refusal} onClose={() => setRefusal(null)} /> : null}
      {finalIssued ? (
        editingCode ? (
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
        )
      ) : (
        <>
          <p className="m-0 text-[12.5px] font-semibold text-heading">
            أودِع التقرير المعتمد في «قيمة»، ثم سجّل رمز الإيداع وأرفق شهادة الإيداع (PDF من صفحة واحدة) ليصدر
            التقرير النهائي.
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
          </div>
        </>
      )}
      <PhaseNote
        phase={phase}
        hint={busy === "deposit" ? "يُولَّد ملف التقرير النهائي على الخادم، قد يستغرق نحو دقيقة، لا تغلق الصفحة" : undefined}
      />
    </div>
  );
}
