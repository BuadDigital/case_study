"use client";

import type {
  ValuationIssuanceGatesDto,
  ValuationReportIssuanceStateDto,
} from "@platform/api-client";
import { cn } from "@platform/ui-kit";

import { Card, CardPad, CardTitle, GhostBtn, PrimaryBtn } from "./atoms";
import { JUSTIFICATION_MIN_LENGTH } from "./lib/shell-utils";
import type { ReportIssuanceWorkflow } from "./useReportIssuanceWorkflow";

/** Issuance conditions card — hard gates only. Methodology alerts live on طريقة المقارنة. */
export function FinalOpinionGatesCard({
  gates,
}: {
  gates: ValuationIssuanceGatesDto;
}) {
  return (
          <Card>
            <CardPad>
              <CardTitle>اعتماد التقييم — شروط الإصدار</CardTitle>
              <p className="mb-2.5 text-[11.5px] text-text-3">
                المنع يقع عند الاعتماد فقط — الإدخال الجزئي محفوظ كمسوّدة.
              </p>
              <p className="mb-2.5 text-[13px] text-text">
                الحالة:{" "}
                <strong
                  className={cn(
                    gates.allowsIssuance ? "text-[#2f7a4d]" : "text-red-text",
                  )}
                >
                  {gates.allowsIssuance
                    ? "كل شروط الاعتماد مستوفاة ✓"
                    : "الاعتماد ممنوع ✗"}
                </strong>
              </p>
              <ul className="m-0 list-none p-0">
                {gates.gates.map((g) => (
                  <li
                    key={g.code}
                    className={cn(
                      "mb-1.5 flex gap-2 text-[12.5px]",
                      g.passed ? "text-text" : "text-red-text",
                    )}
                  >
                    <span>{g.passed ? "✓" : "✗"}</span>
                    <span>{g.labelAr}</span>
                    {g.detailAr ? (
                      <span className="text-text-3">— {g.detailAr}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CardPad>
          </Card>
  );
}

/** Rule Q-6: two-stage issuance — deposit version, certificate, reopen. */
export function FinalOpinionIssuanceCard({
  issuance,
  workflow,
}: {
  issuance: ValuationReportIssuanceStateDto;
  workflow: ReportIssuanceWorkflow;
}) {
  const {
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
  } = workflow;

  return (
          <Card>
            <CardPad>
              <CardTitle>الإصدار ثنائي المرحلة — شهادة الإيداع (ق-6)</CardTitle>
              <p className="mb-2.5 text-[11.5px] text-text-3">
                نسخة الإيداع تُجمِّد التقرير كاملاً وتُرفع يدوياً في منصة قيمة؛ ثم تُسجَّل
                شهادة الإيداع ورمزها فتصدر النسخة النهائية (صفحة الشهادة مرفقة والرمز في
                الميتا). الرمز والشهادة وحدهما خارج نطاق التجميد.
              </p>

              {issuance.supersededCount > 0 ? (
                <p className="mb-2 text-[11.5px] text-amber-text">
                  {issuance.supersededCount} نسخة إيداع ملغاة «حلّت محلها نسخة أحدث» تبقى
                  في ملف المعاملة (ر2) —{" "}
                  {issuance.stage === "draft"
                    ? `الدور الجديد ${issuance.version} قيد العمل`
                    : `الساري هو الدور ${issuance.version}`}
                  .
                </p>
              ) : null}

              {issuance.stage === "draft" ? (
                <div className="flex flex-col gap-2">
                  {!issuance.allowsDepositIssue && issuance.blockingReasonsAr.length > 0 ? (
                    <ul className="m-0 list-disc ps-5 text-[11.5px] text-red-text">
                      {issuance.blockingReasonsAr.slice(0, 5).map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div>
                    <PrimaryBtn
                      disabled={issuanceBusy || !issuance.allowsDepositIssue}
                      onClick={() => void issueDeposit()}
                    >
                      إصدار نسخة الإيداع (تجميد التقرير)
                    </PrimaryBtn>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <p className="m-0 text-[12.5px] text-text">
                    الحالة:{" "}
                    <strong className="text-[#2f7a4d]">
                      {issuance.stage === "final_issued"
                        ? "النسخة النهائية صادرة ✓"
                        : "نسخة الإيداع صادرة — التقرير مجمّد بانتظار الشهادة"}
                    </strong>
                    {issuance.depositCode ? (
                      <span className="ms-2 text-text-2" dir="ltr">
                        {issuance.depositCode}
                      </span>
                    ) : null}
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <GhostBtn
                      disabled={!issuance.hasDepositPdf}
                      onClick={() => void downloadIssuancePdf("deposit")}
                    >
                      تنزيل نسخة الإيداع (PDF)
                    </GhostBtn>
                    {issuance.hasFinalPdf ? (
                      <GhostBtn onClick={() => void downloadIssuancePdf("final")}>
                        تنزيل النسخة النهائية (PDF)
                      </GhostBtn>
                    ) : null}
                  </div>

                  <div className="mt-1 flex flex-wrap items-end gap-2 rounded-[9px] border border-dashed border-border-md bg-surface-2 p-3">
                    <label className="flex flex-col gap-1 text-[11.5px] text-text-2">
                      رمز الإيداع (من شهادة قيمة)
                      <input
                        dir="ltr"
                        value={depositCodeDraft}
                        onChange={(e) => setDepositCodeDraft(e.target.value)}
                        className="w-52 rounded-[7px] border border-border bg-surface px-2.5 py-[7px] text-xs"
                        placeholder="QYM-…"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[11.5px] text-text-2">
                      مستند الشهادة (صورة تدخل صفحةً في النسخة النهائية)
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => setCertificateFile(e.target.files?.[0] ?? null)}
                        className="text-[11px]"
                      />
                    </label>
                    <PrimaryBtn
                      disabled={issuanceBusy || !depositCodeDraft.trim()}
                      onClick={() => void registerCertificate()}
                    >
                      {issuance.stage === "final_issued"
                        ? "تحديث الشهادة/الرمز وإعادة إصدار النهائية"
                        : "تسجيل الشهادة وإصدار النسخة النهائية"}
                    </PrimaryBtn>
                  </div>
                  {issuance.certificateFileName ? (
                    <p className="m-0 text-[11px] text-text-3">
                      الشهادة المحفوظة: {issuance.certificateFileName}
                    </p>
                  ) : null}

                  <div className="mt-1 flex flex-wrap items-end gap-2 rounded-[9px] border border-dashed border-red bg-surface-2 p-3">
                    <label className="flex min-w-64 flex-1 flex-col gap-1 text-[11.5px] text-text-2">
                      إعادة فتح دور التقييم (ر2) — سبب إلزامي (
                      {JUSTIFICATION_MIN_LENGTH}+ أحرف)؛ النسخة المودعة تُعلَّم ملغاة وتبقى
                      بالملف، ويصدر الدور {issuance.version + 1} بإيداع جديد في قيمة
                      <input
                        value={reopenReason}
                        onChange={(e) => setReopenReason(e.target.value)}
                        className="rounded-[7px] border border-border bg-surface px-2.5 py-[7px] text-xs"
                        placeholder="مثال: صفقة مسجلة أحدث غيّرت قيمة المقارنات"
                      />
                    </label>
                    <GhostBtn
                      disabled={
                        issuanceBusy ||
                        reopenReason.trim().length < JUSTIFICATION_MIN_LENGTH
                      }
                      onClick={() => void reopenIssuance()}
                    >
                      إعادة فتح الدور (مشرف القسم)
                    </GhostBtn>
                  </div>
                </div>
              )}
            </CardPad>
          </Card>
  );
}
