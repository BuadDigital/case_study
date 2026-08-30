"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useMemo, useState, Fragment } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { useViewportDesktop } from "@platform/app-shared/hooks/use-viewport-desktop";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";
import type { RoleId } from "@platform/types";
import {
  Button,
  cn,
  EmptyState,
  formControlClassName,
  KpiAlertIcon,
  KpiBand,
  KpiCell,
  KpiCheckIcon,
  KpiClipboardIcon,
  KpiClockIcon,
  MobileKpiStatCards,
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
} from "@platform/ui-kit";
import {
  formatPoDisplay,
  PROPERTY_IDENTIFIER_COLUMN_LABEL,
} from "@case-study/mfe/lib/prototype/po-intake-data";
import { poPropertyPath } from "@case-study/mfe/lib/po-routes";
import { suspendPropertyTransaction } from "@case-study/mfe/lib/prototype/suspend-property-transaction";
import { usePoRecordsQuery } from "@case-study/mfe/query/case-study-queries";
import {
  ActiveQueueMobileCards,
  type ActiveQueueMobileCardItem,
} from "@case-study/mfe/components/queue/ActiveQueueMobileCards";
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
  failureActorLabel,
  failureListSeverityLabel,
  failureListStatusColor,
  failureListStatusLabel,
  failureRecordTitle,
} from "../lib/failures-labels";
import {
  isActiveFailureStatus,
  type FailureRecord,
} from "../lib/failures-types";
import { useFailuresQuery } from "../query/failures-queries";

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
    case "government-reviewer":
      return "لا توجد تعذرات — سجّل تعذراً من تفاصيل المهمة في «المهام»، ثم تظهر هنا.";
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
  // After hydration mount only one tree (table or cards) — both used to build together.
  const isDesktopViewport = useViewportDesktop();
  const [expandedId, setExpandedId] = useState<string | null>(highlightId);
  const [supervisorNote, setSupervisorNote] = useState<Record<string, string>>(
    {},
  );
  const [resolveDraft, setResolveDraft] = useState<Record<string, ResolveDraft>>(
    {},
  );
  const [resolveOpen, setResolveOpen] = useState<Record<string, boolean>>({});
  /** `failureId:action` — shows Spinner on the button during the network call. */
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightId || !isFetched) return;
    setExpandedId(highlightId);
    const el = document.getElementById(`failure-${highlightId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId, isFetched, visibleItems]);

  const router = useRouter();

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: prototypeKeys.failures() });
    void queryClient.invalidateQueries({
      queryKey: prototypeKeys.suspendedTransactions(),
    });
    void queryClient.invalidateQueries({
      queryKey: prototypeKeys.workflowTasks(),
    });
    void queryClient.invalidateQueries({
      queryKey: prototypeKeys.pendingBourseItems(),
    });
    void refetch();
  }, [queryClient, refetch]);

  const stats = useMemo(() => {
    // One pass computes all four badges — countOpenFailures was a second full pass
    // over the same array (js-combine-iterations).
    let open = 0;
    let review = 0;
    let closed = 0;
    let total = 0;
    for (const f of visibleItems) {
      if (
        isActiveFailureStatus(f.status) &&
        (f.status === "internal" || f.status === "review" || f.status === "returned")
      ) {
        open += 1;
      }
      if (f.status === "review") review += 1;
      else if (f.status === "approved" || f.status === "resolved") closed += 1;
      if (f.status !== "suspended") total += 1;
    }
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

  // Input stays immediate; filtering is deferred one frame — pure local filter (rerender-use-deferred-value).
  const deferredSearch = useDeferredValue(search);

  const filteredItems = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
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
  }, [sortedItems, deferredSearch]);

  async function runBusy(
    key: string,
    work: () => Promise<void>,
  ): Promise<void> {
    setBusyKey(key);
    try {
      await work();
    } finally {
      setBusyKey(null);
    }
  }

  function handleSubmit(id: string) {
    void runBusy(`${id}:submit`, async () => {
      try {
        const result = await submitFailureForReview(id);
        if (!result.ok) {
          showToast(result.error, "error");
          return;
        }
        showToast("تم تصعيد التعذر", "success");
        refresh();
      } catch {
        showToast("تعذّر إرسال التعذر للمراجعة — حاول مرة أخرى", "error");
      }
    });
  }

  function handleUpgrade(id: string) {
    void runBusy(`${id}:upgrade`, async () => {
      try {
        const result = await upgradeFailureToInternal(id);
        if (!result.ok) {
          showToast(result.error, "error");
          return;
        }
        showToast("تم تأكيد التعذر الداخلي", "success");
        refresh();
      } catch {
        showToast("تعذّر ترقية التعذر — حاول مرة أخرى", "error");
      }
    });
  }

  function handleApprove(id: string) {
    void runBusy(`${id}:approve`, async () => {
      try {
        const result = await approveFailure(id, supervisorNote[id] ?? "");
        if (!result.ok) {
          showToast(result.error, "error");
          return;
        }
        showToast("تم اعتماد التعذر", "success");
        refresh();
      } catch {
        showToast("تعذّر اعتماد التعذر — حاول مرة أخرى", "error");
      }
    });
  }

  function handleReturn(id: string) {
    void runBusy(`${id}:return`, async () => {
      try {
        const result = await returnFailure(id, supervisorNote[id] ?? "");
        if (!result.ok) {
          showToast(result.error, "error");
          return;
        }
        showToast("أُعيد التعذر للأخصائي", "success");
        refresh();
      } catch {
        showToast("تعذّر إرجاع التعذر — حاول مرة أخرى", "error");
      }
    });
  }

  async function handleSuspend(id: string) {
    const failure = items.find((f) => f.id === id);
    if (!failure) return;
    await runBusy(`${id}:suspend`, async () => {
      const result = await suspendPropertyTransaction({
        failure,
        supervisorNote: supervisorNote[id] ?? "",
      });
      if (result.ok) {
        showToast("تم تعليق المعاملة", "success");
        refresh();
        return;
      }
      showToast(result.error || "تعذّر إيقاف المعاملة — حاول مرة أخرى", "error");
    });
  }

  function handleResolve(id: string) {
    const draft = resolveDraft[id] ?? { reason: "", instructions: "" };
    if (!draft.reason.trim() || !draft.instructions.trim()) return;
    const failure = items.find((f) => f.id === id);
    void runBusy(`${id}:resolve`, async () => {
      try {
        const result = await resolveFailure(id, {
          resolutionReason: draft.reason,
          continueInstructions: draft.instructions,
        });
        if (!result.ok) {
          showToast(result.error, "error");
          return;
        }
        setResolveOpen((o) => ({ ...o, [id]: false }));
        showToast("تم حل التعذر", "success");
        refresh();
        if (failure?.problemTypeId === "unknown-boundaries") {
          router.push("/bourse-inquiry");
        }
      } catch {
        showToast("تعذّر حل التعذر — حاول مرة أخرى", "error");
      }
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
    const actionBtn =
      "h-8 min-h-8 px-2.5 text-[12px] font-semibold text-heading shadow-none max-lg:min-h-11 max-lg:px-3 max-lg:text-[13px]";

    const metaRows: { label: string; value: string }[] = [];
    if (f.internalNote?.trim()) {
      metaRows.push({ label: "ملاحظات", value: f.internalNote.trim() });
    }
    if (f.finalNote?.trim()) {
      metaRows.push({ label: "قرار المشرف", value: f.finalNote.trim() });
    }
    if (f.resolutionReason?.trim()) {
      metaRows.push({ label: "سبب الحل", value: f.resolutionReason.trim() });
    }
    if (f.continueInstructions?.trim()) {
      metaRows.push({
        label: "توجيه استمرار العمل",
        value: f.continueInstructions.trim(),
      });
    }
    if (f.status === "review") {
      metaRows.push({
        label: "أخصائي الإسناد",
        value: assignmentSpecialistByPo.get(f.poNumber.trim()) || "—",
      });
    }

    return (
      <div
        className="border-t border-border bg-row-hover px-4 py-3 text-[12.5px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <div className="text-[13.5px] font-bold leading-snug text-primary">
            {displayTitle}
          </div>
          {metaRows.length > 0 ? (
            <dl className="mt-2 space-y-1.5">
              {metaRows.map((row) => (
                <div
                  key={row.label}
                  className="flex flex-wrap gap-x-1.5 gap-y-0.5 text-[12px] leading-relaxed text-text-2"
                >
                  <dt className="shrink-0 font-semibold text-heading">
                    {row.label}:
                  </dt>
                  <dd className="m-0 min-w-0">{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        {f.propertyId || canSpecialistAct || canSupervisorAct ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/80 pt-3">
            {f.propertyId ? (
              <Link
                href={poPropertyPath(f.poNumber, f.propertyId)}
                className={cn(
                  "inline-flex items-center justify-center gap-[5px] rounded-[var(--radius-DEFAULT)] border-[0.5px] border-solid border-border-md bg-surface text-text no-underline transition-[background,border-color] duration-150 hover:border-gold hover:text-gold-d",
                  actionBtn,
                )}
              >
                عرض العقار
              </Link>
            ) : null}

            {canSpecialistAct ? (
              <>
                {f.severity === "suspected" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    className={actionBtn}
                    loading={busyKey === `${f.id}:upgrade`}
                    showActionToast={false}
                    onClick={() => handleUpgrade(f.id)}
                  >
                    تأكيد تعذر داخلي
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    className={actionBtn}
                    loading={busyKey === `${f.id}:submit`}
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
                    variant="default"
                    className={actionBtn}
                    disabled={Boolean(busyKey?.startsWith(`${f.id}:`))}
                    showActionToast={false}
                    onClick={() => toggleResolve(f.id)}
                  >
                    {resolveOpen[f.id] ? "إلغاء الحل" : "تم الحل"}
                  </Button>
                ) : null}
              </>
            ) : null}

            {canSupervisorAct ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className={actionBtn}
                  loading={busyKey === `${f.id}:approve`}
                  disabled={Boolean(busyKey?.startsWith(`${f.id}:`))}
                  showActionToast={false}
                  onClick={() => handleApprove(f.id)}
                >
                  اعتماد التعذر
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className={actionBtn}
                  loading={busyKey === `${f.id}:return`}
                  disabled={Boolean(busyKey?.startsWith(`${f.id}:`))}
                  showActionToast={false}
                  onClick={() => handleReturn(f.id)}
                >
                  إعادة للأخصائي
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className={actionBtn}
                  loading={busyKey === `${f.id}:suspend`}
                  disabled={Boolean(busyKey?.startsWith(`${f.id}:`))}
                  showActionToast={false}
                  onClick={() => void handleSuspend(f.id)}
                >
                  تعليق المعاملة
                </Button>
              </>
            ) : null}
          </div>
        ) : null}

        {canSupervisorAct ? (
          <div className="mt-3 border-t border-border/80 pt-3">
            <label
              className="mb-1.5 block text-[11px] font-semibold text-heading"
              htmlFor={`sup_note_${f.id}`}
            >
              ملاحظة الاعتماد أو الإعادة
            </label>
            <textarea
              id={`sup_note_${f.id}`}
              className={fieldTextareaClass}
              rows={2}
              placeholder="اكتب الملاحظة إن لزم…"
              value={supervisorNote[f.id] ?? ""}
              onChange={(e) =>
                setSupervisorNote((n) => ({
                  ...n,
                  [f.id]: e.target.value,
                }))
              }
            />
          </div>
        ) : null}

        {resolveOpen[f.id] && canResolve && !canSupervisorAct ? (
          <div className="mt-3 space-y-2.5 border-t border-border/80 pt-3">
            <div>
              <label
                className="mb-1.5 block text-[11px] font-semibold text-heading"
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
            </div>
            <div>
              <label
                className="mb-1.5 block text-[11px] font-semibold text-heading"
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
            </div>
            <Button
              type="button"
              size="sm"
              variant="default"
              className={actionBtn}
              loading={busyKey === `${f.id}:resolve`}
              showActionToast={false}
              disabled={
                !draft.reason.trim() ||
                !draft.instructions.trim() ||
                Boolean(busyKey?.startsWith(`${f.id}:`))
              }
              onClick={() => handleResolve(f.id)}
            >
              تأكيد الحل وإغلاق التعذر
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  const mobileCardItems = useMemo((): ActiveQueueMobileCardItem[] => {
    if (isDesktopViewport === true) return [];
    return filteredItems.map((f) => {
      const active = isActiveFailureStatus(f.status);
      const statusColor = failureListStatusColor(f.status, f.severity);
      const expanded = expandedId === f.id;
      const title = f.deedNumber
        ? f.deedNumber.startsWith("صك")
          ? f.deedNumber
          : `صك ${f.deedNumber}`
        : failureRecordTitle(f);
      const specialist =
        assignmentSpecialistByPo.get(f.poNumber.trim())?.trim() ||
        f.specialist?.trim() ||
        "";
      return {
        id: f.id,
        anchorId: `failure-${f.id}`,
        title,
        meta: [
          { text: formatPoDisplay(f.poNumber), kind: "po" as const },
          {
            text: failureListSeverityLabel(f.severity),
            kind: "type" as const,
          },
          specialist
            ? { text: specialist, kind: "place" as const }
            : {
                text: failureActorLabel(f.raisedByRole),
                kind: "plain" as const,
              },
        ],
        statusLabel: failureListStatusLabel(f.status, f.severity),
        statusStyle: { base: statusColor, fg: statusColor },
        tone: !active
          ? "done"
          : f.severity === "suspected"
            ? "pending"
            : "returned",
        moreItems: [],
        muted: !active,
        expanded,
        expandedPanel: expanded ? renderExpandedActions(f) : null,
        shellClassName:
          highlightId === f.id ? "ring-2 ring-gold/40" : undefined,
        onOpen: () =>
          setExpandedId((prev) => (prev === f.id ? null : f.id)),
      };
    });
  }, [
    isDesktopViewport,
    filteredItems,
    expandedId,
    highlightId,
    ce,
    ca,
    resolveDraft,
    resolveOpen,
    supervisorNote,
    assignmentSpecialistByPo,
  ]);

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

      <KpiBand className="mb-0 hidden lg:flex">
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

      <MobileKpiStatCards
        className="mb-0"
        items={[
          {
            key: "open",
            label: "تعذرات مفتوحة",
            sub: !isFetched
              ? "—"
              : stats.open > 0
                ? "تحتاج معالجة"
                : "لا تعذرات مفتوحة",
            value: !isFetched ? "—" : stats.open,
            icon: <KpiAlertIcon />,
            iconClass: "bg-[var(--gold-soft)] text-[var(--gold-d)]",
            tone: "gold",
            valueClass: "!text-gold-d",
          },
          {
            key: "review",
            label: "عند مشرف دراسة الحالة",
            sub: "بانتظار الاعتماد",
            value: !isFetched ? "—" : stats.review,
            icon: <KpiClockIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#8a5e14]",
            tone: "gold",
            valueClass: "!text-gold-d",
          },
          {
            key: "closed",
            label: "معتمدة / تم الحل",
            sub: isFetched ? stats.closedPct : "—",
            value: !isFetched ? "—" : stats.closed,
            icon: <KpiCheckIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-ink",
            tone: "ink",
            valueClass: "!text-ink",
          },
          {
            key: "total",
            label: "الإجمالي",
            sub: "سجلات التعذر",
            value: !isFetched ? "—" : stats.total,
            icon: <KpiClipboardIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-ink",
            tone: "ink",
          },
        ]}
      />

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

      <OperationalPanel className="shrink-0 overflow-visible max-lg:border-0 max-lg:bg-transparent max-lg:shadow-none max-lg:rounded-none">
        {isDesktopViewport === false ? null : (
        <div className="hidden lg:block">
          <Table pending={!isFetched}>
            <THead>
              <Tr hoverable={false}>
                <Th className="text-start">{PROPERTY_IDENTIFIER_COLUMN_LABEL}</Th>
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
                        <Td className="text-text-2">
                          {failureActorLabel(f.raisedByRole)}
                        </Td>
                        <Td className="text-text-2">
                          {failureActorLabel(f.specialist)}
                        </Td>
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
        </div>
        )}

        {isDesktopViewport === true ? null : (
          <div className="lg:hidden max-lg:px-0">
            <ActiveQueueMobileCards
              items={mobileCardItems}
              pending={!isFetched}
              emptyMessage={
                partyScopedFailuresEmptyLine(role) ??
                "لا توجد تعذرات — سجّل تعذراً من شاشة العقارات."
              }
            />
          </div>
        )}
      </OperationalPanel>

      <QueueTableHint className="hidden lg:block">
        اضغط الصف لفتح التفاصيل والإجراءات. سجّل تعذراً جديداً من شاشة العقار
        (⋮ → إبلاغ عن تعذر).
      </QueueTableHint>
    </PageShell>
  );
}
