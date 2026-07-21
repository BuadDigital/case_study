"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, Fragment } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { ROLES } from "@platform/app-shared/prototype/constants";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";
import type { RoleId } from "@platform/types";
import {
  Button,
  cn,
  EmptyState,
  formControlClassName,
  KpiBand,
  KpiCell,
  Note,
  OperationalPanel,
  OperationalToolbarSearch,
  PageShell,
  PageToolbar,
  QueueTableHint,
  SkeletonTableRows,
  StatusPill,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  queueTableRowClassName,
  useToast,
} from "@platform/design-system";
import { formatPoDisplay } from "@case-study/mfe";
import { poPropertyPath } from "@case-study/mfe/lib/po-routes";
import { suspendPropertyTransaction } from "@case-study/mfe/lib/prototype/suspend-property-transaction";
import { usePoRecordsQuery } from "@case-study/mfe/query/case-study-queries";
import {
  failuresForPartyRole,
  isPartyScopedFailuresRole,
} from "../lib/failures-party-raiser-scope";
import {
  approveFailure,
  resolveFailure,
  returnFailure,
  submitFailureForReview,
  upgradeFailureToInternal,
} from "../lib/failures-repository";
import {
  failureListSeverityLabel,
  failureListStatusColor,
  failureListStatusLabel,
  failureRecordTitle,
} from "../lib/failures-labels";
import {
  countOpenFailures,
  isActiveFailureStatus,
  type FailureRecord,
} from "../lib/failures-types";
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
  const { data: items = [], isFetched, isError, error, refetch } =
    useFailuresQuery();
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
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(highlightId);
  const [supervisorNote, setSupervisorNote] = useState<Record<string, string>>(
    {},
  );
  const [resolveDraft, setResolveDraft] = useState<Record<string, ResolveDraft>>(
    {},
  );
  const [resolveOpen, setResolveOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!highlightId || !isFetched) return;
    setExpandedId(highlightId);
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

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedItems;
    return sortedItems.filter((f) => {
      const hay = [
        f.deedNumber,
        f.poNumber,
        failureRecordTitle(f),
        failureListSeverityLabel(f.severity),
        failureListStatusLabel(f.status, f.severity),
        f.raisedByRole,
        f.specialist,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [sortedItems, search]);

  function handleSubmit(id: string) {
    void submitFailureForReview(id)
      .then((result) => {
        if (!result.ok) {
          showToast(result.error, "error");
          return;
        }
        showToast("تم تصعيد التعذر", "success");
        refresh();
      })
      .catch(() => {
        showToast("تعذّر إرسال التعذر للمراجعة — حاول مرة أخرى", "error");
      });
  }

  function handleUpgrade(id: string) {
    void upgradeFailureToInternal(id)
      .then((result) => {
        if (!result.ok) {
          showToast(result.error, "error");
          return;
        }
        showToast("تم تأكيد التعذر الداخلي", "success");
        refresh();
      })
      .catch(() => {
        showToast("تعذّر ترقية التعذر — حاول مرة أخرى", "error");
      });
  }

  function handleApprove(id: string) {
    void approveFailure(id, supervisorNote[id] ?? "")
      .then((result) => {
        if (!result.ok) {
          showToast(result.error, "error");
          return;
        }
        showToast("تم اعتماد التعذر", "success");
        refresh();
      })
      .catch(() => {
        showToast("تعذّر اعتماد التعذر — حاول مرة أخرى", "error");
      });
  }

  function handleReturn(id: string) {
    void returnFailure(id, supervisorNote[id] ?? "")
      .then((result) => {
        if (!result.ok) {
          showToast(result.error, "error");
          return;
        }
        showToast("أُعيد التعذر للأخصائي", "success");
        refresh();
      })
      .catch(() => {
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
      showToast("تم تعليق المعاملة", "success");
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
    })
      .then((result) => {
        if (!result.ok) {
          showToast(result.error, "error");
          return;
        }
        setResolveOpen((o) => ({ ...o, [id]: false }));
        showToast("تم حل التعذر", "success");
        refresh();
      })
      .catch(() => {
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

  function renderExpandedActions(f: FailureRecord) {
    const active = isActiveFailureStatus(f.status);
    const canSpecialistAct =
      ce && active && (f.status === "internal" || f.status === "returned");
    const canSupervisorAct = ca && active && f.status === "review";
    const canResolve = canSpecialistAct && f.status !== "approved";
    const draft = resolveDraft[f.id] ?? { reason: "", instructions: "" };
    const displayTitle = failureRecordTitle(f);

    return (
      <div className="space-y-3 border-t border-border bg-surface-2/40 px-4 py-3 text-[12px]">
        <div className="font-semibold text-heading">{displayTitle}</div>
        {f.internalNote ? (
          <div className="text-text-2">
            <strong>ملاحظات:</strong> {f.internalNote}
          </div>
        ) : null}
        {f.finalNote ? (
          <div className="text-text-2">
            <strong>قرار المشرف:</strong> {f.finalNote}
          </div>
        ) : null}
        {f.resolutionReason ? (
          <div className="text-text-2">
            <strong>سبب الحل:</strong> {f.resolutionReason}
            {f.continueInstructions ? (
              <>
                <br />
                <strong>توجيه استمرار العمل:</strong> {f.continueInstructions}
              </>
            ) : null}
          </div>
        ) : null}
        {f.status === "review" ? (
          <div className="text-text-3">
            أخصائي الإسناد:{" "}
            {assignmentSpecialistByPo.get(f.poNumber.trim()) || "—"}
          </div>
        ) : null}
        {f.propertyId ? (
          <Link
            href={poPropertyPath(f.poNumber, f.propertyId)}
            className="inline-flex items-center justify-center rounded-[var(--radius-DEFAULT)] border border-border-md bg-surface px-2 py-1 text-[11px] text-text no-underline hover:bg-surface-2"
            onClick={(e) => e.stopPropagation()}
          >
            عرض العقار
          </Link>
        ) : null}

        {canSpecialistAct ? (
          <div className="flex flex-wrap gap-1.5">
            {f.severity === "suspected" ? (
              <Button
                type="button"
                size="sm"
                variant="primary"
                showActionToast={false}
                onClick={() => handleUpgrade(f.id)}
              >
                تأكيد تعذر داخلي
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="primary"
                showActionToast={false}
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
                showActionToast={false}
                onClick={() => toggleResolve(f.id)}
              >
                {resolveOpen[f.id] ? "إلغاء الحل" : "تم الحل"}
              </Button>
            ) : null}
          </div>
        ) : null}

        {canSupervisorAct ? (
          <div>
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
              onClick={(e) => e.stopPropagation()}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="success"
                showActionToast={false}
                onClick={() => handleApprove(f.id)}
              >
                اعتماد التعذر
              </Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                showActionToast={false}
                onClick={() => handleReturn(f.id)}
              >
                إعادة للأخصائي
              </Button>
              <Button
                type="button"
                size="sm"
                variant="primary"
                showActionToast={false}
                onClick={() => void handleSuspend(f.id)}
              >
                تعليق المعاملة
              </Button>
            </div>
          </div>
        ) : null}

        {resolveOpen[f.id] && canResolve && !canSupervisorAct ? (
          <div className="rounded-lg border border-border bg-surface p-3">
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
              onClick={(e) => e.stopPropagation()}
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
              onClick={(e) => e.stopPropagation()}
            />
            <Button
              type="button"
              size="sm"
              variant="success"
              className="mt-2"
              showActionToast={false}
              disabled={!draft.reason.trim() || !draft.instructions.trim()}
              onClick={() => handleResolve(f.id)}
            >
              تأكيد الحل وإغلاق التعذر
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <PageShell variant="canvas" className="min-h-0 flex-1 space-y-4">
      {isError ? (
        <Note tone="warn" className="mb-0">
          {error instanceof Error
            ? error.message
            : "تعذّر تحميل التعذرات — حاول مرة أخرى"}
          <div className="mt-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              showActionToast={false}
              onClick={() => void refetch()}
            >
              إعادة المحاولة
            </Button>
          </div>
        </Note>
      ) : null}

      <KpiBand>
        <KpiCell
          first
          icon={<KpiAlertIcon />}
          iconClass="bg-[var(--gold-soft)] text-[var(--gold-d)]"
          label="تعذرات مفتوحة"
          value={!isFetched ? "—" : stats.open}
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
          iconClass="bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#8a5e14]"
          label="عند مشرف دراسة الحالة"
          value={!isFetched ? "—" : stats.review}
          sub="بانتظار الاعتماد"
        />
        <KpiCell
          icon={<KpiCheckIcon />}
          iconClass="bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-ink"
          label="معتمدة / تم الحل"
          value={!isFetched ? "—" : stats.closed}
          sub={isFetched ? stats.closedPct : "—"}
        />
        <KpiCell
          last
          icon={<KpiClipboardIcon />}
          iconClass="bg-[color-mix(in_srgb,#3f8f5f_16%,transparent)] text-[#2f7a4d]"
          label="الإجمالي"
          value={!isFetched ? "—" : stats.total}
          sub="سجلات التعذر"
        />
      </KpiBand>

      <PageToolbar className="mb-0 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b-0 bg-transparent px-0 py-0">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
          <OperationalToolbarSearch
            type="search"
            placeholder="بحث…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="بحث التعذرات"
          />
        </div>
      </PageToolbar>

      {!ce && !ca && !isPartyScopedFailuresRole(role) ? (
        <Note tone="info" className="m-0">
          {role === "general-manager"
            ? "أنت في وضع الاطلاع — صلاحية التعديل للمشرف والأخصائي"
            : role === "cdo"
              ? "صلاحيات كاملة — يمكنك اعتماد التعذرات وإنشاؤها"
              : "أنت في وضع المراقبة — لا تملك صلاحية تعديل التعذرات"}
        </Note>
      ) : null}

      <OperationalPanel className="shrink-0 overflow-visible">
        <Table pending={!isFetched}>
          <THead>
            <Tr hoverable={false}>
              <Th className="text-start">الصك</Th>
              <Th className="text-start">أمر العمل</Th>
              <Th className="text-start">الخطورة</Th>
              <Th className="text-start">الحالة</Th>
              <Th className="text-start">الرافع</Th>
              <Th className="text-start">الأخصائي</Th>
            </Tr>
          </THead>
          <TBody>
            {!isFetched ? (
              <SkeletonTableRows rows={6} cols={6} />
            ) : filteredItems.length === 0 ? (
              <Tr hoverable={false}>
                <Td colSpan={6} className="cursor-default py-10">
                  <EmptyState
                    line={
                      partyScopedFailuresEmptyLine(role) ??
                      "لا توجد تعذرات — سجّل تعذراً من شاشة العقارات."
                    }
                  />
                </Td>
              </Tr>
            ) : (
              filteredItems.map((f) => {
                const active = isActiveFailureStatus(f.status);
                const statusColor = failureListStatusColor(
                  f.status,
                  f.severity,
                );
                const expanded = expandedId === f.id;
                return (
                  <Fragment key={f.id}>
                    <Tr
                      id={`failure-${f.id}`}
                      hoverable={false}
                      className={cn(
                        "group",
                        queueTableRowClassName,
                        !active && "opacity-70",
                        highlightId === f.id && "bg-primary-light/30",
                        expanded && "bg-row-hover",
                      )}
                      onClick={() =>
                        setExpandedId((prev) => (prev === f.id ? null : f.id))
                      }
                    >
                      <Td>
                        <span className="text-[13.5px] font-bold text-primary">
                          {f.deedNumber
                            ? f.deedNumber.startsWith("صك")
                              ? f.deedNumber
                              : `صك ${f.deedNumber}`
                            : failureRecordTitle(f)}
                        </span>
                      </Td>
                      <Td className="font-semibold text-text-2">
                        {formatPoDisplay(f.poNumber)}
                      </Td>
                      <Td className="text-[13px] font-semibold text-heading">
                        {failureListSeverityLabel(f.severity)}
                      </Td>
                      <Td>
                        <StatusPill
                          label={failureListStatusLabel(f.status, f.severity)}
                          style={{ base: statusColor, fg: statusColor }}
                        />
                      </Td>
                      <Td className="text-text-2">{f.raisedByRole || "—"}</Td>
                      <Td className="text-text-2">{f.specialist || "—"}</Td>
                    </Tr>
                    {expanded ? (
                      <Tr hoverable={false}>
                        <Td colSpan={6} className="cursor-default p-0">
                          {renderExpandedActions(f)}
                        </Td>
                      </Tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </TBody>
        </Table>
      </OperationalPanel>

      <QueueTableHint>
        اضغط الصف لفتح التفاصيل والإجراءات. سجّل تعذراً جديداً من شاشة العقار
        (⋮ → إبلاغ عن تعذر).
      </QueueTableHint>
    </PageShell>
  );
}
