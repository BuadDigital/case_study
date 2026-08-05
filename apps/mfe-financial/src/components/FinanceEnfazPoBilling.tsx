"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  loadPoEnfazBillingForQuery,
  loadReadyEnfazPoSummaries,
  savePoEnfazBillingData,
  issueEnfazInvoice,
  collectEnfazInvoice,
  downloadEnfazInvoicePdf,
  openEnfazAttachment,
} from "@platform/app-shared/prototype/enfaz-billing-api";
import {
  Input,
  cn,
  useToast,
} from "@platform/design-system";
import {
  type PoEnfazRevenueLineDto,
} from "@platform/api-client";
import {
  finCard,
  finCheck,
  finEmpty,
  finEmptyS,
  finEmptyT,
  finGhost,
  finMuted,
  finNote,
  finNum,
  finPo,
  finPrimary,
  finRowActive,
  finStatusFor,
  finWorkTitle,
} from "../lib/finance-tw";

type LineDraft = {
  caseStudyFee: string;
  surveyFee: string;
  keyFee: string;
  inc: boolean;
};

function lineTotal(d: LineDraft | undefined): number {
  if (!d) return 0;
  return (
    (Number(d.caseStudyFee) || 0) +
    (Number(d.surveyFee) || 0) +
    (Number(d.keyFee) || 0)
  );
}

function invoiceStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "collected":
      return "محصّلة";
    case "partially_collected":
      return "تحصيل جزئي";
    case "issued":
      return "صادرة";
    default:
      return "مُفوتَرة";
  }
}

export function FinanceEnfazPoBilling({
  initialPo = null,
  compact = false,
}: {
  /** يفتح أمر عمل محدد (من مهامي / قائمة الإيرادات). */
  initialPo?: string | null;
  /** يخفي قائمة أوامر العمل الجانبية عند العمل من مرحلة. */
  compact?: boolean;
} = {}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [selectedPo, setSelectedPo] = useState<string | null>(
    initialPo?.trim() || null,
  );
  const [draft, setDraft] = useState<Record<string, LineDraft>>({});
  const [collectAmount, setCollectAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: readySummaries = [] } = useQuery({
    queryKey: [...prototypeKeys.all, "enfaz-billing", "ready-summary"],
    queryFn: loadReadyEnfazPoSummaries,
  });

  const readyPos = readySummaries.map((s) => s.poNumber);

  useEffect(() => {
    if (initialPo?.trim()) {
      setSelectedPo(initialPo.trim());
      return;
    }
    if (!selectedPo && readyPos.length > 0) setSelectedPo(readyPos[0]);
  }, [initialPo, readyPos, selectedPo]);

  const { data: billing, isPending, isError, error, refetch } = useQuery({
    queryKey: [...prototypeKeys.all, "enfaz-billing", selectedPo],
    queryFn: () => loadPoEnfazBillingForQuery(selectedPo!),
    enabled: Boolean(selectedPo),
  });

  useEffect(() => {
    if (!billing) return;
    const next: Record<string, LineDraft> = {};
    for (const line of billing.lines) {
      next[line.propertyId] = {
        caseStudyFee: String(line.caseStudyFeeSar || ""),
        surveyFee: String(line.surveyFeeSar || ""),
        keyFee: String(line.keyFeeSar || ""),
        inc: line.includedInBilling,
      };
    }
    setDraft(next);
    const remaining = Math.max(
      0,
      (billing.totalSar || 0) - (billing.collectedAmountSar || 0),
    );
    setCollectAmount(remaining > 0 ? String(remaining) : "");
  }, [billing]);

  const totals = useMemo(() => {
    if (!billing)
      return { taxable: 0, key: 0, vat: 0, total: 0, billable: 0, sub: 0 };
    let taxable = 0;
    let key = 0;
    let billable = 0;
    for (const line of billing.lines) {
      const d = draft[line.propertyId];
      if (!d?.inc || line.workStatus !== "done") continue;
      billable += 1;
      taxable += (Number(d.caseStudyFee) || 0) + (Number(d.surveyFee) || 0);
      key += Number(d.keyFee) || 0;
    }
    // ضريبة 15٪ على (تقييم+رفع) فقط — أتعاب المفاتيح شاملة الضريبة
    const vat = Math.round(taxable * 0.15 * 100) / 100;
    return {
      taxable,
      key,
      vat,
      total: taxable + vat + key,
      billable,
      /** توافق العرض القديم: مجموع قبل الضريبة الخاضع */
      sub: taxable,
    };
  }, [billing, draft]);

  const issued = Boolean(billing?.invoiceNumber);
  const fullyCollected = billing?.invoiceStatus === "collected";

  const save = async () => {
    if (!selectedPo || !billing) return;
    setBusy(true);
    try {
      const saved = await savePoEnfazBillingData(selectedPo, {
        lines: billing.lines.map((line) => {
          const d = draft[line.propertyId];
          return {
            propertyId: line.propertyId,
            caseStudyFeeSar: Number(d?.caseStudyFee) || 0,
            surveyFeeSar: Number(d?.surveyFee) || 0,
            keyFeeSar: Number(d?.keyFee) || 0,
            keyEntitlementEnvelopeId: line.keyEntitlementEnvelopeId,
            includedInBilling: d?.inc ?? true,
          };
        }),
      });
      if (!saved) {
        showToast("تعذّر حفظ الأتعاب — حاول مرة أخرى", "error");
        return;
      }
      showToast("تم حفظ الأتعاب", "success");
      await queryClient.invalidateQueries({
        queryKey: [...prototypeKeys.all, "enfaz-billing"],
      });
    } finally {
      setBusy(false);
    }
  };

  const issueInvoice = async () => {
    if (!selectedPo) return;
    setBusy(true);
    try {
      const issuedBilling = await issueEnfazInvoice(selectedPo);
      if (!issuedBilling) {
        showToast("تعذّر إصدار الفاتورة — حاول مرة أخرى", "error");
        return;
      }
      showToast("تم إصدار الفاتورة", "success");
      await queryClient.invalidateQueries({
        queryKey: [...prototypeKeys.all, "enfaz-billing"],
      });
      const downloaded = await downloadEnfazInvoicePdf(selectedPo);
      if (!downloaded) {
        showToast("صدرت الفاتورة لكن تعذّر تنزيل PDF", "info");
      }
    } finally {
      setBusy(false);
    }
  };

  const collect = async () => {
    if (!selectedPo || !billing) return;
    const amount = Number(collectAmount);
    if (!(amount > 0)) {
      showToast("أدخل مبلغ تحصيل أكبر من صفر", "error");
      return;
    }
    const remaining = Math.max(
      0,
      (billing.totalSar || 0) - (billing.collectedAmountSar || 0),
    );
    if (
      remaining > 0 &&
      Math.abs(amount - remaining) > 0.009 &&
      typeof window !== "undefined"
    ) {
      const ok = window.confirm(
        `مبلغ التحويل (${amount.toLocaleString("en-US")} ر.س) يختلف عن المتبقي (${remaining.toLocaleString("en-US")} ر.س). المتابعة؟`,
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      const result = await collectEnfazInvoice(selectedPo, {
        amountSar: amount,
      });
      if (!result) {
        showToast("تعذّر تسجيل التحصيل — تحقق من المبلغ", "error");
        return;
      }
      showToast("تم تسجيل التحصيل", "success");
      await queryClient.invalidateQueries({
        queryKey: [...prototypeKeys.all, "enfaz-billing"],
      });
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = async () => {
    if (!selectedPo) return;
    setBusy(true);
    try {
      const ok = await downloadEnfazInvoicePdf(selectedPo);
      if (!ok) {
        showToast("تعذّر تنزيل PDF — تأكد من إصدار الفاتورة أولاً", "error");
        return;
      }
      showToast("تم تنزيل فاتورة PDF", "success");
    } finally {
      setBusy(false);
    }
  };

  const patchDraft = (propertyId: string, patch: Partial<LineDraft>) => {
    setDraft((prev) => ({
      ...prev,
      [propertyId]: {
        caseStudyFee: prev[propertyId]?.caseStudyFee ?? "",
        surveyFee: prev[propertyId]?.surveyFee ?? "",
        keyFee: prev[propertyId]?.keyFee ?? "",
        inc: prev[propertyId]?.inc ?? true,
        ...patch,
      },
    }));
  };

  const lineRow = (line: PoEnfazRevenueLineDto) => {
    const cancelled = line.workStatus === "cancelled";
    const d = draft[line.propertyId];
    return (
      <tr
        key={line.propertyId}
        className={cn(
          "border-b border-border last:border-b-0",
          cancelled && "opacity-50",
        )}
      >
        <td className="px-3 py-2.5 text-[13px] font-semibold text-heading">
          {line.propertyLabel}
          {line.hasKeyEntitlement ? (
            <span className="ms-1 text-[10px] text-text-3">· مفتاح</span>
          ) : null}
        </td>
        <td className="px-3 py-2.5 text-center">
          <span className={finStatusFor(line.workStatus === "done" ? "success" : "warning")}>
            {line.workStatusLabel}
          </span>
        </td>
        <td className="px-3 py-2.5 text-center">
          {cancelled ? (
            <span className={finMuted}>—</span>
          ) : (
            <Input
              type="number"
              min={0}
              className="h-8 w-24 text-xs"
              value={d?.caseStudyFee ?? ""}
              disabled={issued}
              onChange={(e) =>
                patchDraft(line.propertyId, { caseStudyFee: e.target.value })
              }
              aria-label={`دخل دراسة المعاملة ${line.propertyLabel}`}
            />
          )}
        </td>
        <td className="px-3 py-2.5 text-center">
          {cancelled ? (
            <span className={finMuted}>—</span>
          ) : (
            <Input
              type="number"
              min={0}
              className="h-8 w-24 text-xs"
              value={d?.surveyFee ?? ""}
              disabled={issued}
              onChange={(e) =>
                patchDraft(line.propertyId, { surveyFee: e.target.value })
              }
              aria-label={`دخل تكاليف الرفع ${line.propertyLabel}`}
            />
          )}
        </td>
        <td className="px-3 py-2.5 text-center">
          {cancelled ? (
            <span className={finMuted}>—</span>
          ) : line.hasKeyEntitlement ? (
            <Input
              type="number"
              min={0}
              className="h-8 w-24 text-xs"
              value={d?.keyFee ?? ""}
              disabled={issued}
              onChange={(e) =>
                patchDraft(line.propertyId, { keyFee: e.target.value })
              }
              aria-label={`أتعاب المفاتيح ${line.propertyLabel}`}
            />
          ) : (
            <span className={finMuted}>—</span>
          )}
        </td>
        <td className="px-3 py-2.5 text-center">
          {cancelled ? (
            <span className={finMuted}>—</span>
          ) : (
            <span className={finNum}>
              {lineTotal(d).toLocaleString("en-US")} ر.س
            </span>
          )}
        </td>
        <td className="px-3 py-2.5 text-center">
          {cancelled ? (
            <span className={finMuted}>—</span>
          ) : (
            <input
              type="checkbox"
              className={finCheck}
              checked={d?.inc ?? true}
              disabled={issued}
              onChange={(e) =>
                patchDraft(line.propertyId, { inc: e.target.checked })
              }
              aria-label={`تضمين ${line.propertyLabel}`}
            />
          )}
        </td>
      </tr>
    );
  };

  if (!compact && readyPos.length === 0 && !initialPo) {
    return (
      <div className={finCard}>
        <div className={finEmpty}>
          <div className={finEmptyT}>لا أوامر عمل جاهزة للفوترة.</div>
          <div className={finEmptyS}>
            يظهر أمر العمل هنا فقط بعد اكتمال كل معاملاته (مكتملة أو ملغاة).
          </div>
        </div>
      </div>
    );
  }

  const detailPanel = (
        <div className="min-w-0">
          {!selectedPo || isPending ? (
            <div className={finEmpty}>
              <div className={finEmptyT}>اختر أمر عمل من القائمة.</div>
            </div>
          ) : !billing ? (
            <div className={finEmpty}>
              <div className={finEmptyT}>تعذر تحميل بيانات الفوترة.</div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={cn(finWorkTitle, finPo)} dir="ltr">
                  {selectedPo}
                </h3>
                {billing.invoiceNumber ? (
                  <span
                    className={finStatusFor(
                      billing.isOverdue
                        ? "danger"
                        : billing.invoiceStatus === "collected"
                          ? "success"
                          : billing.invoiceStatus === "partially_collected"
                            ? "warning"
                            : "default",
                    )}
                  >
                    {invoiceStatusLabel(billing.invoiceStatus)}
                    {billing.isOverdue ? " · متأخر" : ""} ·{" "}
                    {billing.invoiceNumber}
                  </span>
                ) : billing.poReadyForBilling ? (
                  <span className={finStatusFor("default")}>جاهز للإصدار</span>
                ) : (
                  <span className={finStatusFor("warning")}>يحتاج حفظ</span>
                )}
              </div>

              <div className={finCard}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-[13px]">
                    <thead>
                      <tr className="border-b-2 border-gold bg-surface-2">
                        <th className="px-3 py-3 text-start text-xs font-bold text-heading">المعاملة</th>
                        <th className="px-3 py-3 text-center text-xs font-bold text-heading">الحالة</th>
                        <th className="px-3 py-3 text-center text-xs font-bold text-heading">دخل الدراسة</th>
                        <th className="px-3 py-3 text-center text-xs font-bold text-heading">دخل الرفع</th>
                        <th className="px-3 py-3 text-center text-xs font-bold text-heading">مفاتيح</th>
                        <th className="px-3 py-3 text-center text-xs font-bold text-heading">المجموع</th>
                        <th className="px-3 py-3 text-center text-xs font-bold text-heading">مشمول</th>
                      </tr>
                    </thead>
                    <tbody>{billing.lines.map(lineRow)}</tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface p-4 text-sm shadow-card">
                <div className="mb-2 text-[11px] text-text-3">
                  {totals.billable} معاملة مشمولة في الفاتورة
                </div>
                <div className="flex justify-between py-1 text-text-2">
                  <span>إجمالي الأتعاب (تقييم + رفع)</span>
                  <span className="tabular-nums" dir="ltr">
                    {(issued
                      ? billing.subtotalSar
                      : totals.taxable
                    ).toLocaleString("en-US")}{" "}
                    ر.س
                  </span>
                </div>
                {issued ? (
                  <div className="flex justify-between py-1 text-text-2">
                    <span>أتعاب المفاتيح (ضمن الإجمالي)</span>
                    <span className="tabular-nums text-text-3" dir="ltr">
                      —
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between py-1 text-text-2">
                    <span>أتعاب المفاتيح (شاملة الضريبة)</span>
                    <span className="tabular-nums" dir="ltr">
                      {totals.key.toLocaleString("en-US")} ر.س
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-1 text-text-2">
                  <span>ضريبة القيمة المضافة 15%</span>
                  <span className="tabular-nums" dir="ltr">
                    {(issued ? billing.vatSar : totals.vat).toLocaleString(
                      "en-US",
                    )}{" "}
                    ر.س
                  </span>
                </div>
                <div className="mt-1 flex justify-between border-t border-border pt-2 font-semibold text-heading">
                  <span>الإجمالي المستحق</span>
                  <span className="tabular-nums" dir="ltr">
                    {(issued ? billing.totalSar : totals.total).toLocaleString(
                      "en-US",
                    )}{" "}
                    ر.س
                  </span>
                </div>
                {issued ? (
                  <div className="mt-2 flex justify-between border-t border-border pt-2 text-text-2">
                    <span>المحصّل</span>
                    <span className="tabular-nums" dir="ltr">
                      {billing.collectedAmountSar.toLocaleString("en-US")} ر.س
                    </span>
                  </div>
                ) : null}
                {billing.attachmentIds.length > 0 ? (
                  <div className="mt-3 border-t border-border pt-3">
                    <div className="mb-2 text-[11px] text-text-3">
                      مرفقات ظروف المفاتيح (عرض فقط)
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {billing.attachmentIds.map((id, index) => (
                        <button
                          key={id}
                          type="button"
                          className={finGhost}
                          onClick={() => {
                            void openEnfazAttachment(
                              id,
                              `مرفق-مفتاح-${index + 1}`,
                            ).then((result) => {
                              if (!result.ok) {
                                showToast(result.error, "error");
                              }
                            });
                          }}
                        >
                          مرفق {index + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface-2 px-3.5 py-3">
                <span className="text-xs text-text-2">
                  {fullyCollected
                    ? "الفاتورة محصّلة بالكامل."
                    : issued
                      ? "سجّل مبلغ التحصيل (جزئي أو كامل)."
                      : totals.total <= 0
                        ? "عبّئ أتعاب معاملة واحدة على الأقل قبل الإصدار."
                        : "احفظ ثم أصدر الفاتورة."}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {!issued ? (
                    <>
                      <button
                        type="button"
                        className={finGhost}
                        disabled={busy}
                        onClick={() => void save()}
                      >
                        حفظ المطابقة
                      </button>
                      <button
                        type="button"
                        className={finPrimary}
                        disabled={
                          busy ||
                          !billing.poReadyForBilling ||
                          totals.total <= 0
                        }
                        onClick={() => void issueInvoice()}
                      >
                        تسجيل الفاتورة
                      </button>
                    </>
                  ) : (
                    <>
                      {!fullyCollected ? (
                        <>
                          <Input
                            type="number"
                            min={0}
                            className="h-8 w-28 text-xs"
                            value={collectAmount}
                            onChange={(e) => setCollectAmount(e.target.value)}
                            aria-label="مبلغ التحصيل"
                          />
                          {(() => {
                            const remaining = Math.max(
                              0,
                              (billing.totalSar || 0) -
                                (billing.collectedAmountSar || 0),
                            );
                            const amt = Number(collectAmount) || 0;
                            if (remaining > 0 && amt > 0 && Math.abs(amt - remaining) > 0.009) {
                              return (
                                <span className="text-[11px] text-[#a5432e]">
                                  تنبيه: يختلف عن المتبقي
                                </span>
                              );
                            }
                            return null;
                          })()}
                          <button
                            type="button"
                            className={finPrimary}
                            disabled={busy}
                            onClick={() => void collect()}
                          >
                            تسجيل تحصيل
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        className={finGhost}
                        disabled={busy}
                        onClick={() => void downloadPdf()}
                      >
                        تحميل PDF
                      </button>
                    </>
                  )}
                </div>
              </div>

              {!compact ? (
                <p className="m-0 text-xs text-text-3">
                  المعاملات الملغاة لا تُفوتر. أتعاب المفاتيح شاملة الضريبة
                  عند وجود استحقاق ظرف. التحصيل على الفاتورة يقفل معاملاتها.
                </p>
              ) : null}
            </div>
          )}
        </div>
  );

  if (compact) {
    return (
      <div className="flex flex-col gap-3">
        {isError ? (
          <p className={cn(finNote, "mb-0")}>
            {error instanceof Error
              ? error.message
              : "تعذّر تحميل بيانات الفوترة — حاول مرة أخرى"}{" "}
            <button
              type="button"
              className={cn(finGhost, "ms-2")}
              onClick={() => void refetch()}
            >
              إعادة المحاولة
            </button>
          </p>
        ) : null}
        {detailPanel}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className={cn(finNote, "mb-0")}>
        المسار: اختر أمر عمل ← طابِق الأتعاب (تقييم + رفع + مفاتيح) ← احفظ ←
        سجّل الفاتورة ← سجّل التحويل.
      </p>

      {isError ? (
        <p className={cn(finNote, "mb-0")}>
          {error instanceof Error
            ? error.message
            : "تعذّر تحميل بيانات الفوترة — حاول مرة أخرى"}{" "}
          <button
            type="button"
            className={cn(finGhost, "ms-2")}
            onClick={() => void refetch()}
          >
            إعادة المحاولة
          </button>
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(220px,0.9fr)_1.6fr]">
        <div className={finCard}>
          <div className="border-b border-border px-3 py-2.5 text-[12px] font-semibold text-heading">
            أوامر العمل الجاهزة
            <span className={cn(finStatusFor("warning"), "ms-2")}>
              {readySummaries.length}
            </span>
          </div>
          {readySummaries.map((summary) => (
            <button
              key={summary.poNumber}
              type="button"
              className={cn(
                "flex w-full items-center justify-between border-t border-border px-3 py-2.5 text-start text-sm transition-colors hover:bg-row-hover",
                selectedPo === summary.poNumber && finRowActive,
                selectedPo === summary.poNumber && "font-semibold",
              )}
              onClick={() => setSelectedPo(summary.poNumber)}
            >
              <span className={finPo} dir="ltr">
                {summary.poNumber}
              </span>
              <span className="text-[11px] text-text-3">
                {summary.doneCount} مكتملة
                {summary.cancelledCount > 0
                  ? ` · ${summary.cancelledCount} ملغاة`
                  : ""}
              </span>
            </button>
          ))}
        </div>

        {detailPanel}
      </div>
    </div>
  );
}
