"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatSar } from "./FinancePartyBillingParts";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { loadInspectorFeesSummary } from "@platform/app-shared/prototype/inspector-fees-api";
import { loadPartyBillingStatements } from "@platform/app-shared/prototype/party-billing-statements-api";
import { resolvePartyName } from "@platform/app-shared/fees/party-fee-meta";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { cn } from "@platform/ui-kit";
import {
  finCard,
  finEmpty,
  finEmptyS,
  finEmptyT,
  finGridExcluded,
  finGroupHead,
  finGroupTitle,
  finMuted,
  finNote,
  finNum,
  finPo,
  finRow,
  finScroll,
  finStatusFor,
  finTd,
  finTh,
  finThead,
} from "../lib/finance-tw";

/**
 * مستبعدة: بنود مخسومة/مستبعدة قبل الاستحقاق + مسيرات ملغاة (سجل).
 * وفق مرجع عرض فقط.
 */
export function FinanceExcludedCosts({
  assigneeId = null,
}: {
  assigneeId?: string | null;
} = {}) {
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];

  const feesQuery = useQuery({
    queryKey: [...prototypeKeys.all, "inspector-fees", "finance-excluded"],
    queryFn: () => loadInspectorFeesSummary({ submittedOnly: false }),
  });

  const statementsQuery = useQuery({
    queryKey: [...prototypeKeys.all, "party-billing", "statements", "excluded"],
    queryFn: () => loadPartyBillingStatements(),
  });

  const excludedLines = useMemo(
    () =>
      (feesQuery.data?.rows ?? []).filter((r) => {
        if (assigneeId?.trim()) {
          if ((r.assigneeId?.trim() || "—") !== assigneeId.trim()) return false;
        }
        return (
          r.excludedFromBatch ||
          (r.netFeeSar === 0 && r.workStatus === "done")
        );
      }),
    [feesQuery.data?.rows, assigneeId],
  );

  const cancelledStatements = useMemo(
    () =>
      (statementsQuery.data ?? []).filter((s) => {
        if (s.status !== "cancelled") return false;
        if (assigneeId?.trim()) return s.assigneeId === assigneeId.trim();
        return true;
      }),
    [statementsQuery.data, assigneeId],
  );

  const pending = feesQuery.isPending || statementsQuery.isPending;

  if (pending) {
    return (
      <div className={finCard}>
        <div className={finEmpty}>
          <div className={finEmptyT}>جاري التحميل…</div>
        </div>
      </div>
    );
  }

  if (excludedLines.length === 0 && cancelledStatements.length === 0) {
    return (
      <div className={finCard}>
        <div className={finEmpty}>
          <div className={finEmptyT}>لا مستبعدة حالياً.</div>
          <div className={finEmptyS}>
            تظهر هنا البنود المستبعدة قبل الاستحقاق والمسيرات الملغاة كسجل.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className={finNote}>
        بنود خرجت من دورة الصرف ولن تُدفع — ملغاة أو مخسومة بالكامل، سُوّيت بين
        المشرف والمكتب الهندسي قبل الاستحقاق. لا تصل المالية إلا الأتعاب المتفق
        عليها، فهذا التبويب للمطابقة والسجل فقط.
      </p>

      {excludedLines.length > 0 ? (
        <section>
          <div className={finGroupHead}>
            <h3 className={finGroupTitle}>
              بنود مستبعدة{" "}
              <span className={`${finMuted} font-normal`}>
                ({excludedLines.length})
              </span>
            </h3>
          </div>
          <div className={finCard}>
            <div className={finScroll}>
              <div>
                <div className={cn(finThead, finGridExcluded)}>
                  <div className={finTh}>المستحق</div>
                  <div className={finTh}>المرجع</div>
                  <div className={finTh}>أمر العمل</div>
                  <div className={finTh}>الصافي</div>
                  <div className={finTh}>السبب</div>
                </div>
                {excludedLines.map((row) => (
                  <div
                    key={row.workflowTaskId}
                    className={cn(finRow, finGridExcluded)}
                  >
                    <div className={finTd}>
                      <span className="font-semibold text-heading">
                        {resolvePartyName(row.assigneeId, staffUsers)}
                      </span>
                    </div>
                    <div className={finTd}>
                      <span className={finMuted} title={row.propertyLabel}>
                        {row.propertyLabel || "—"}
                      </span>
                    </div>
                    <div className={finTd}>
                      <span className={finPo}>{row.poNumber}</span>
                    </div>
                    <div className={finTd}>
                      <span className={finNum}>{formatSar(row.netFeeSar)}</span>
                    </div>
                    <div className={finTd}>
                      <span className={finMuted}>
                        {row.exclusionReason?.trim() ||
                          row.lastTransitionReason?.trim() ||
                          (row.excludedFromBatch
                            ? "مستبعد من الصرف"
                            : "صافي صفر")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {cancelledStatements.length > 0 ? (
        <section>
          <div className={finGroupHead}>
            <h3 className={finGroupTitle}>
              مسيرات / أوامر ملغاة{" "}
              <span className={`${finMuted} font-normal`}>
                ({cancelledStatements.length})
              </span>
            </h3>
          </div>
          <div className={finCard}>
            <div className={finScroll}>
              <div>
                <div
                  className={cn(
                    finThead,
                    "min-w-full grid-cols-[minmax(110px,1fr)_minmax(120px,1.2fr)_100px_minmax(140px,1.3fr)]",
                  )}
                >
                  <div className={finTh}>المرجع</div>
                  <div className={finTh}>المستحق</div>
                  <div className={finTh}>المبلغ</div>
                  <div className={finTh}>سبب الإلغاء</div>
                </div>
                {cancelledStatements.map((s) => (
                  <div
                    key={s.id}
                    className={cn(
                      finRow,
                      "min-w-full grid-cols-[minmax(110px,1fr)_minmax(120px,1.2fr)_100px_minmax(140px,1.3fr)]",
                    )}
                  >
                    <div className={finTd}>
                      <span className={finPo}>{s.referenceNumber}</span>
                      <span className={cn(finStatusFor("cancelled"), "ms-1.5")}>
                        ملغى
                      </span>
                    </div>
                    <div className={finTd}>
                      <span className="font-semibold text-heading">
                        {resolvePartyName(s.assigneeId, staffUsers)}
                      </span>
                    </div>
                    <div className={finTd}>
                      <span className={finNum}>
                        {formatSar(s.totalNetSar)}
                      </span>
                    </div>
                    <div className={finTd}>
                      <span className={finMuted}>
                        {(s.cancelReason ?? "").trim() || "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
