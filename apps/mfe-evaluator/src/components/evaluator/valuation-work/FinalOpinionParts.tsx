"use client";

import type {
  ValuationIssuanceGatesDto,
  ValuationReportIssuanceStateDto,
} from "@platform/api-client";
import { cn, opsFldControl } from "@platform/ui-kit";

import { Card, CardPad, CardTitle, GhostBtn, PrimaryBtn } from "./atoms";
import { JUSTIFICATION_MIN_LENGTH } from "./lib/shell-utils";
import type { FinalOpinionWorkflow } from "./useFinalOpinionWorkflow";

/** Issuance conditions card — the alert list and each alert's disposition. */
export function FinalOpinionGatesCard({
  gates,
  workflow,
  saving,
}: {
  gates: ValuationIssuanceGatesDto;
  workflow: FinalOpinionWorkflow;
  saving: boolean;
}) {
  const { triggeredAlerts, alertOverrides, setAlertOverrides } = workflow;

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

              {/* Methodology alerts (21) — disposition via text rationale or acknowledgment by alert class */}
              <div className="mt-4 border-t border-border pt-3.5">
                <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2.5">
                  <span className="text-[13.5px] font-extrabold text-heading">
                    التنبيهات المنهجية
                  </span>
                  <span className="text-[11px] text-text-3">
                    {gates.methodologyAlertsNoteAr} · تُحفَظ المعالجات مع «حفظ
                    التوفيق والرأي النهائي»
                  </span>
                </div>
                {triggeredAlerts.length === 0 ? (
                  <div className="text-[12.5px] font-bold text-[#2f7a4d]">
                    ✓ لا تنبيهات منهجية مفعّلة
                  </div>
                ) : (
                  triggeredAlerts
                    .map((a) => {
                      const ov = alertOverrides[a.code] ?? {
                        overrideRationale: "",
                        acknowledged: false,
                      };
                      const needsRationale = a.severityKind === "require_rationale";
                      const needsAck = a.severityKind === "require_ack";
                      return (
                        <div
                          key={a.code}
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
                              <span className="text-[11.5px] text-text-2">
                                {a.detailAr}
                              </span>
                            ) : null}
                          </div>
                          {needsRationale ? (
                            <>
                              <input
                                value={ov.overrideRationale}
                                placeholder={`المبرر النصي لتجاوز التنبيه (${JUSTIFICATION_MIN_LENGTH} أحرف فأكثر)…`}
                                onChange={(e) =>
                                  setAlertOverrides((prev) => ({
                                    ...prev,
                                    [a.code]: {
                                      overrideRationale: e.target.value,
                                      acknowledged: prev[a.code]?.acknowledged ?? false,
                                    },
                                  }))
                                }
                                className={cn(
                                  "rounded-[7px] border border-dashed bg-surface px-2.5 py-[7px] text-xs",
                                  ov.overrideRationale.trim().length > 0 &&
                                    ov.overrideRationale.trim().length <
                                      JUSTIFICATION_MIN_LENGTH
                                    ? "border-danger"
                                    : "border-border-md",
                                )}
                              />
                              {ov.overrideRationale.trim().length > 0 &&
                              ov.overrideRationale.trim().length <
                                JUSTIFICATION_MIN_LENGTH ? (
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
                                onChange={(e) =>
                                  setAlertOverrides((prev) => ({
                                    ...prev,
                                    [a.code]: {
                                      overrideRationale:
                                        prev[a.code]?.overrideRationale ?? "",
                                      acknowledged: e.target.checked,
                                    },
                                  }))
                                }
                                className="size-[15px]"
                              />
                              أقرّ بالاطلاع على هذا التنبيه والوعي بأثره
                            </label>
                          ) : null}
                          {a.isHard ? (
                            <span className="text-[11px] text-red-text">
                              تنبيه حاجب — يُعالَج بتصحيح المدخلات نفسها لا
                              بالتجاوز.
                            </span>
                          ) : null}
                        </div>
                      );
                    })
                )}
              </div>
            </CardPad>
          </Card>
  );
}

/** Rule Q-6: two-stage issuance — deposit version, certificate, reopen. */
export function FinalOpinionIssuanceCard({
  issuance,
  workflow,
  saving,
}: {
  issuance: ValuationReportIssuanceStateDto;
  workflow: FinalOpinionWorkflow;
  saving: boolean;
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

                  {/* Supplement Rule Q-9 (R2): reopen valuation cycle — section-supervisor approval */}
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
