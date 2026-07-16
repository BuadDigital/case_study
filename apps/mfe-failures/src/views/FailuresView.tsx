"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { ROLES } from "@platform/app-shared/prototype/constants";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";
import type { RoleId } from "@platform/types";
import {
  Badge,
  Button,
  cn,
  EmptyState,
  formControlClassName,
  KpiBand,
  KpiCell,
  Note,
  OperationalPanel,
  PageShell,
  PageToolbar,
  QueueTableHint,
  useToast,
} from "@platform/design-system";
import { formatDateAr, formatPoDisplay } from "@case-study/mfe";
import { poPropertyPath } from "@case-study/mfe/lib/po-routes";
import { suspendPropertyTransaction } from "@case-study/mfe/lib/prototype/suspend-property-transaction";
import { usePoRecordsQuery } from "@case-study/mfe/query/case-study-queries";
import {
  failuresForPartyRole,
  isPartyScopedFailuresRole,
} from "../lib/failures-party-raiser-scope";
import { approveFailure, resolveFailure, returnFailure, submitFailureForReview, upgradeFailureToInternal } from "../lib/failures-repository";
import { failureRecordTitle, failureSeverityLabel, failureStatusLabel } from "../lib/failures-labels";
import { countOpenFailures, isActiveFailureStatus, type FailureRecord } from "../lib/failures-types";
import { useFailuresQuery } from "../query/failures-queries";

function KpiAlertIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

function KpiClockIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function KpiCheckIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

function KpiClipboardIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  );
}

function isCaseEditor(role: RoleId) {
  return isSuperAdmin(role) || role === "case-specialist";
}

function isSupervisor(role: RoleId) {
  return isSuperAdmin(role) || role === "section-supervisor";
}


function partyScopedFailuresNote(role: RoleId): string | null {
  switch (role) {
    case "government-reviewer":
      return "تعرض هنا تعذراتك التي رفعتها من المراجعة الحكومية فقط — للمتابعة والاطلاع.";
    case "engineering-office":
      return "تعرض هنا تعذراتك التي سجّلتها من الرفع المساحي فقط — للمتابعة والاطلاع.";
    case "field-inspector":
      return "تعرض هنا تعذراتك التي سجّلتها من المعاينة الميدانية فقط — للمتابعة والاطلاع.";
    case "real-estate-appraiser":
      return "تعرض هنا تعذراتك التي سجّلتها من تقييم العقار فقط — للمتابعة والاطلاع.";
    default:
      return null;
  }
}

function partyScopedFailuresEmptyLine(role: RoleId): string | null {
  switch (role) {
    case "engineering-office":
      return "لا توجد تعذرات — سجّل تعذراً من قائمة الرفع المساحي أو من تبويب التعذرات في المعاملة.";
    case "field-inspector":
      return "لا توجد تعذرات — سجّل تعذراً من قائمة المعاينة الميدانية أو من تبويب التعذرات في المعاملة.";
    case "real-estate-appraiser":
      return "لا توجد تعذرات — سجّل تعذراً من قائمة تقييم العقار أو من تبويب التعذرات في المعاملة.";
    default:
      return null;
  }
}

type ResolveDraft = { reason: string; instructions: string };

const fieldTextareaClass = cn(
  formControlClassName,
  "min-h-[72px] resize-y py-2 leading-relaxed",
);

export function FailuresView() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight")?.trim() || null;
  const { showToast } = useToast();
  const { role } = usePrototype();
  const ce = isCaseEditor(role);
  const ca = isSupervisor(role);
  const { data: items = [], isFetched, isError, error, refetch } = useFailuresQuery();
  const visibleItems = useMemo(() => {
    const scoped = failuresForPartyRole(role, items);
    if (scoped) return scoped;
    return items;
  }, [items, role]);
  const { data: poRecords = [] } = usePoRecordsQuery();
  const assignmentSpecialistByPo = useMemo(() => {
    const map = new Map<string, string>();
    for (const record of poRecords) {
      const name = record.assignmentSpecialist?.trim();
      if (name) map.set(record.poNumber.trim(), name);
    }
    return map;
  }, [poRecords]);
  const [supervisorNote, setSupervisorNote] = useState<Record<string, string>>({});
  const [resolveDraft, setResolveDraft] = useState<Record<string, ResolveDraft>>(
    {},
  );
  const [resolveOpen, setResolveOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!highlightId || !isFetched) return;
    const el = document.getElementById(`failure-${highlightId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId, isFetched, visibleItems]);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: prototypeKeys.failures() });
    void queryClient.invalidateQueries({
      queryKey: prototypeKeys.suspendedTransactions(),
    });
    void queryClient.invalidateQueries({
      queryKey: prototypeKeys.workflowTasks(),
    });
    void refetch();
  }, [queryClient, refetch]);

  const stats = useMemo(() => {
    const open = countOpenFailures(visibleItems);
    const review = visibleItems.filter((f) => f.status === "review").length;
    const approved = visibleItems.filter((f) => f.status === "approved").length;
    const resolved = visibleItems.filter((f) => f.status === "resolved").length;
    const closed = approved + resolved;
    const total = visibleItems.filter((f) => f.status !== "suspended").length;
    return {
      open,
      review,
      closed,
      total,
      closedPct:
        total > 0 ? `${Math.round((closed / total) * 100)}% من الإجمالي` : "—",
    };
  }, [visibleItems]);

  const sortedItems = useMemo(() => {
    return [...visibleItems]
      .filter((f) => f.status !== "suspended")
      .sort((a, b) => {
        const aActive = isActiveFailureStatus(a.status);
        const bActive = isActiveFailureStatus(b.status);
        if (aActive !== bActive) return aActive ? -1 : 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [visibleItems]);

  function handleSubmit(id: string) {
    void submitFailureForReview(id).then((result) => {
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      refresh();
    }).catch(() => {
      showToast("تعذّر إرسال التعذر للمراجعة — حاول مرة أخرى", "error");
    });
  }

  function handleUpgrade(id: string) {
    void upgradeFailureToInternal(id).then((result) => {
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      refresh();
    }).catch(() => {
      showToast("تعذّر ترقية التعذر — حاول مرة أخرى", "error");
    });
  }

  function handleApprove(id: string) {
    void approveFailure(id, supervisorNote[id] ?? "").then((result) => {
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      refresh();
    }).catch(() => {
      showToast("تعذّر اعتماد التعذر — حاول مرة أخرى", "error");
    });
  }

  function handleReturn(id: string) {
    void returnFailure(id, supervisorNote[id] ?? "").then((result) => {
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      refresh();
    }).catch(() => {
      showToast("تعذّر إرجاع التعذر — حاول مرة أخرى", "error");
    });
  }

  async function handleSuspend(id: string) {
    const failure = items.find((f) => f.id === id);
    if (!failure) return;
    const ok = await suspendPropertyTransaction({
      failure,
      supervisorNote: supervisorNote[id] ?? "",
      suspendedBy: ROLES[role]?.name ?? "مشرف",
    });
    if (ok) {
      refresh();
      return;
    }
    showToast("تعذّر إيقاف المعاملة — حاول مرة أخرى", "error");
  }

  function handleResolve(id: string) {
    const draft = resolveDraft[id] ?? { reason: "", instructions: "" };
    if (!draft.reason.trim() || !draft.instructions.trim()) return;
    void resolveFailure(id, {
      resolutionReason: draft.reason,
      continueInstructions: draft.instructions,
    }).then((result) => {
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      setResolveOpen((o) => ({ ...o, [id]: false }));
      refresh();
    }).catch(() => {
      showToast("تعذّر حل التعذر — حاول مرة أخرى", "error");
    });
  }

  function toggleResolve(id: string) {
    setResolveOpen((o) => ({ ...o, [id]: !o[id] }));
  }

  function patchResolveDraft(id: string, patch: Partial<ResolveDraft>) {
    setResolveDraft((d) => {
      const current = d[id] ?? { reason: "", instructions: "" };
      return { ...d, [id]: { ...current, ...patch } };
    });
  }

  return (
    <PageShell variant="canvas" className="min-h-0 flex-1">
      {isError ? (
        <Note tone="warn" className="mb-4">
          {error instanceof Error
            ? error.message
            : "تعذّر تحميل التعذرات — حاول مرة أخرى"}
          <div className="mt-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>
              إعادة المحاولة
            </Button>
          </div>
        </Note>
      ) : null}
      <KpiBand>
        <KpiCell
          first
          icon={<KpiAlertIcon />}
          iconClass="bg-[color-mix(in_srgb,var(--red)_15%,transparent)] text-red"
          label="تعذرات مفتوحة"
          value={!isFetched ? "—" : stats.open}
          valueClass="!text-red"
          sub={
            isFetched
              ? stats.open > 0
                ? "تحتاج معالجة"
                : "لا تعذرات مفتوحة"
              : "—"
          }
          dot
        />
        <KpiCell
          icon={<KpiClockIcon />}
          iconClass="bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#b8791a]"
          label="عند مشرف دراسة الحالة"
          value={!isFetched ? "—" : stats.review}
          sub="بانتظار اعتماد المشرف"
        />
        <KpiCell
          icon={<KpiCheckIcon />}
          iconClass="bg-[color-mix(in_srgb,#2f9e6b_16%,transparent)] text-[#2f9e6b]"
          label="معتمدة / تم الحل"
          value={!isFetched ? "—" : stats.closed}
          valueClass="!text-[#2f9e6b]"
          sub={isFetched ? stats.closedPct : "—"}
        />
        <KpiCell
          last
          icon={<KpiClipboardIcon />}
          iconClass="bg-info-bg text-info-text"
          label="الإجمالي"
          value={!isFetched ? "—" : stats.total}
          sub="سجلات التعذر في النظام"
        />
      </KpiBand>

      <OperationalPanel className="min-h-0 flex-1 overflow-y-auto">
          {!ce && !ca ? (
            <PageToolbar className="border-b-0 bg-surface-2/50">
              <Note tone="info" className="m-0 flex-1">
                {role === "general-manager"
                  ? "أنت في وضع الاطلاع — صلاحية التعديل للمشرف والأخصائي"
                  : role === "cdo"
                    ? "صلاحيات كاملة — يمكنك اعتماد التعذرات وإنشاؤها"
                    : isPartyScopedFailuresRole(role)
                      ? partyScopedFailuresNote(role)
                      : "أنت في وضع المراقبة — لا تملك صلاحية تعديل التعذرات"}
              </Note>
            </PageToolbar>
          ) : null}
          {ca ? (
            <PageToolbar className="border-b-0 bg-surface-2/50">
              <Note tone="success" className="m-0 flex-1">
                مسار التعذر: رفع (احتمال / داخلي) → معالجة الأخصائي → مراجعة
                المشرف مع أخصائي الإسناد → اعتماد التعذر أو تعليق المعاملة.
              </Note>
            </PageToolbar>
          ) : null}

          {sortedItems.length === 0 ? (
            <EmptyState
              line={
                partyScopedFailuresEmptyLine(role) ??
                "لا توجد تعذرات — سجّل تعذراً من شاشة العقارات."
              }
            />
          ) : (
            <>
              <div className="flex flex-col gap-2.5 px-4 py-4">
                {sortedItems.map((f) => {
          const active = isActiveFailureStatus(f.status);
          const displayTitle = failureRecordTitle(f);
          const canSpecialistAct =
            ce &&
            active &&
            (f.status === "internal" || f.status === "returned");
          const canSupervisorAct = ca && active && f.status === "review";
          const canResolve = canSpecialistAct && f.status !== "approved";
          const draft = resolveDraft[f.id] ?? { reason: "", instructions: "" };

          return (
            <div
              id={`failure-${f.id}`}
              key={f.id}
              className={cn(
                "mb-2.5 rounded-lg border border-border border-e-[3px] border-e-danger bg-surface p-3.5",
                highlightId === f.id && "ring-2 ring-primary/40",
              )}
              style={active ? undefined : { opacity: 0.72 }}
            >
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] font-medium">
                  {f.deedNumber || displayTitle}{" "}
                  <span className="text-[11px] text-text-3">
                    · {formatPoDisplay(f.poNumber)}
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <Badge tone="default" className="border-0 text-[11px] font-normal">
                    {failureSeverityLabel(f.severity)}
                  </Badge>
                  <Badge tone="default" className="border-0 text-[11px] font-normal">
                    {failureStatusLabel(f.status)}
                  </Badge>
                  <span className="text-[11px] text-text-3">
                    <bdi dir="ltr" className="[direction:ltr] [unicode-bidi:isolate]">
                      {formatDateAr(f.updatedAt.slice(0, 10))}
                    </bdi>
                  </span>
                </div>
              </div>
              <div className="mb-1 text-[13px] font-semibold">{displayTitle}</div>
              {f.internalNote ? (
                <div className="text-xs leading-relaxed text-text-2">
                  <strong>ملاحظات:</strong> {f.internalNote}
                </div>
              ) : null}
              {f.finalNote ? (
                <div className="mt-1 text-xs text-text-2">
                  <strong>قرار المشرف:</strong> {f.finalNote}
                </div>
              ) : null}
              {f.resolutionReason ? (
                <div className="mt-1 text-xs text-text-2">
                  <strong>سبب الحل:</strong> {f.resolutionReason}
                  {f.continueInstructions ? (
                    <>
                      <br />
                      <strong>توجيه استمرار العمل:</strong>{" "}
                      {f.continueInstructions}
                    </>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-1 text-[11px] text-text-3">
                الرافع: {f.raisedByRole || "—"} · الأخصائي: {f.specialist}
                {f.status === "review" ? (
                  <>
                    {" "}
                    · أخصائي الإسناد:{" "}
                    {assignmentSpecialistByPo.get(f.poNumber.trim()) || "—"}
                  </>
                ) : null}
              </div>
              {f.propertyId ? (
                <div className="mt-2">
                  <Link
                    href={poPropertyPath(f.poNumber, f.propertyId)}
                    className="inline-flex items-center justify-center rounded-[var(--radius-DEFAULT)] border border-border-md bg-surface px-2 py-1 text-[11px] text-text no-underline transition-colors hover:bg-surface-2"
                  >
                    عرض العقار
                  </Link>
                </div>
              ) : null}

              {canSpecialistAct ? (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {f.severity === "suspected" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      onClick={() => handleUpgrade(f.id)}
                    >
                      تأكيد تعذر داخلي
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      onClick={() => handleSubmit(f.id)}
                    >
                      تصعيد على المشرف
                    </Button>
                  )}
                  {canResolve ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="success"
                      onClick={() => toggleResolve(f.id)}
                    >
                      {resolveOpen[f.id] ? "إلغاء الحل" : "تم الحل"}
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {canSupervisorAct ? (
                <div className="mt-2.5">
                  <textarea
                    className={fieldTextareaClass}
                    rows={2}
                    placeholder="ملاحظة الاعتماد أو الإعادة"
                    value={supervisorNote[f.id] ?? ""}
                    onChange={(e) =>
                      setSupervisorNote((n) => ({
                        ...n,
                        [f.id]: e.target.value,
                      }))
                    }
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="success"
                      onClick={() => handleApprove(f.id)}
                    >
                      اعتماد التعذر
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      onClick={() => handleReturn(f.id)}
                    >
                      إعادة للأخصائي
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      onClick={() => void handleSuspend(f.id)}
                    >
                      تعليق المعاملة
                    </Button>
                  </div>
                </div>
              ) : null}

              {resolveOpen[f.id] && canResolve && !canSupervisorAct ? (
                <div className="mt-2.5 rounded-lg border border-border bg-[#FAFBFC] p-3">
                  <label
                    className="mb-1 block text-[11px] font-semibold text-text-2"
                    htmlFor={`resolve_reason_${f.id}`}
                  >
                    سبب الحل *
                  </label>
                  <textarea
                    id={`resolve_reason_${f.id}`}
                    className={fieldTextareaClass}
                    rows={2}
                    value={draft.reason}
                    onChange={(e) =>
                      patchResolveDraft(f.id, { reason: e.target.value })
                    }
                  />
                  <label
                    className="mb-1 mt-2 block text-[11px] font-semibold text-text-2"
                    htmlFor={`resolve_instructions_${f.id}`}
                  >
                    توجيه استمرار العمل *
                  </label>
                  <textarea
                    id={`resolve_instructions_${f.id}`}
                    className={fieldTextareaClass}
                    rows={2}
                    value={draft.instructions}
                    onChange={(e) =>
                      patchResolveDraft(f.id, {
                        instructions: e.target.value,
                      })
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="success"
                    className="mt-2"
                    disabled={
                      !draft.reason.trim() || !draft.instructions.trim()
                    }
                    onClick={() => handleResolve(f.id)}
                  >
                    تأكيد الحل وإغلاق التعذر
                  </Button>
                </div>
              ) : null}
            </div>
          );
            })}
              </div>
              <QueueTableHint>
                سجّل تعذراً جديداً من شاشة العقار (⋮ → إبلاغ عن تعذر).
              </QueueTableHint>
            </>
          )}
        </OperationalPanel>
    </PageShell>
  );
}
