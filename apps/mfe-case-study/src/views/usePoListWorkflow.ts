"use client";

/**
 * All non-rendering workflow behind `PoListView`: queries, search/sort/paging
 * state, the derived queue, and the cancel/stop/delete writes. The view consumes
 * the returned bag and keeps JSX plus event wiring only.
 */
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@platform/ui-kit";
import { poListStatusMeta, isPoListStatusTerminal } from "@platform/app-shared/app-data/po-list-status";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import type { ActiveQueueMobileCardItem } from "@platform/app-shared/components/ActiveQueueMobileCards";
import { poPropertiesPath } from "@platform/app-shared/domain/po-routes";
import { formatPoDisplay } from "../lib/app-data/po-intake-data";
import {
  cancelPoRecord,
  deletePoRecord,
  stopPoRecord,
} from "../lib/app-data/po-intake-commands";
import {
  buildPoDeedIndex,
  classifyPoListSearch,
  poListSearchModeLabel,
} from "../lib/app-data/po-list-search";
import { buildPoListRowMoreItems } from "../lib/app-data/po-list-row-menu";
import {
  usePoListRowsPageQuery,
  usePropertyListItemsQuery,
  useWorkflowTasksQuery,
  useWorkOrderListCountsQuery,
} from "@case-study/mfe/query/case-study-queries";
import { useDebouncedValue } from "@platform/app-shared/hooks/use-debounced-value";
import {
  canDeletePo,
  canEditPoHeader,
  canReceivePo,
} from "../lib/app-data/po-roles";
import { canManageOperationsTasks } from "../lib/app-data/operations-task-roles";
import {
  buildPoListPageRows,
  INITIAL_PO_LIST_QUERY,
  isPoListBillingBucket,
  poListBillingWindow,
  poListEmptyMessage,
  poListKpiFromCounts,
  poListQueryReducer,
  poListRowView,
  poListServerPagination,
  poStatusStyle,
  PO_ASSIGNMENT_TYPE_OPTIONS,
  PO_LIST_PAGE_SIZE,
  registeredCountsByPo,
  teamNamesByPo,
  toWorkOrderListCountsQuery,
  toWorkOrderListQuery,
  type SortKey,
  type StatusFilter,
} from "./po-list-view-state";

export function usePoListWorkflow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { role } = useAppAccess();
  const showIntake = canReceivePo(role);
  const showEdit = canEditPoHeader(role);
  const showDelete = canDeletePo(role);
  const showCreateOperationsTask = canManageOperationsTasks(role);
  const { showToast } = useToast();
  const [deletingPo, setDeletingPo] = useState<string | null>(null);
  const [lifecyclePo, setLifecyclePo] = useState<string | null>(null);
  const [intakeOpen, setIntakeOpenState] = useState(false);
  /** `/po/intake` redirects here as `?intake=1` — the deep link into the modal. */
  const intakeFromQuery = searchParams.get("intake") === "1";
  const [query, dispatchQuery] = useReducer(
    poListQueryReducer,
    INITIAL_PO_LIST_QUERY,
  );
  const { search, statusFilter, typeFilter, page } = query;
  const setSearch = (value: string) =>
    dispatchQuery({ type: "search", value });
  const setStatusFilter = (value: StatusFilter) =>
    dispatchQuery({ type: "status", value });
  const setTypeFilter = (value: string) =>
    dispatchQuery({ type: "assignmentType", value });
  const setPage = (value: number) => dispatchQuery({ type: "page", page: value });

  useEffect(() => {
    if (!showIntake || !intakeFromQuery) return;
    setIntakeOpenState(true);
  }, [showIntake, intakeFromQuery]);

  /**
   * The query param stays on the URL while the modal is open and is dropped
   * only when it closes — replacing the URL during the opening render raced
   * the navigation that brought it here (`/po/intake` → `/po?intake=1`).
   */
  const setIntakeOpen = useCallback(
    (open: boolean) => {
      setIntakeOpenState(open);
      if (!open && intakeFromQuery) {
        router.replace("/po", { scroll: false });
      }
    },
    [intakeFromQuery, router],
  );

  // The search box drives a server request — debounce it, do not just defer a
  // local filter pass (the deferred value would fire a request per keystroke).
  const debouncedSearch = useDebouncedValue(search, 300);
  const serverQuery = useMemo(
    () => toWorkOrderListQuery(query, { search: debouncedSearch }),
    [query, debouncedSearch],
  );

  const countsQuery = useMemo(
    () => toWorkOrderListCountsQuery(query, { search: debouncedSearch }),
    [query, debouncedSearch],
  );

  const {
    data: pageResult,
    isPending: pagePending,
    isPlaceholderData,
  } = usePoListRowsPageQuery(serverQuery);
  // The KPI band and the empty-state copy are SQL COUNTs on the same filters —
  // no list is loaded for them any more (pagination-contract §1.1).
  const { data: counts } = useWorkOrderListCountsQuery(countsQuery);
  const { data: propertyItems } = usePropertyListItemsQuery();
  const { data: workflowTasks } = useWorkflowTasksQuery();
  const teamByPo = useMemo(() => teamNamesByPo(workflowTasks), [workflowTasks]);
  const deedIndex = useMemo(
    () => buildPoDeedIndex(propertyItems ?? []),
    [propertyItems],
  );
  const registeredByPo = useMemo(
    () => registeredCountsByPo(deedIndex),
    [deedIndex],
  );
  const searchMode = useMemo(() => classifyPoListSearch(search), [search]);
  const appliedSearchMode = useMemo(
    () => classifyPoListSearch(debouncedSearch),
    [debouncedSearch],
  );
  const searchModeLabel = poListSearchModeLabel(searchMode);
  const statsReady = pageResult !== undefined && !pagePending;

  const kpi = useMemo(() => poListKpiFromCounts(counts), [counts]);
  const emptyMessage = poListEmptyMessage(counts);

  const assignmentTypes = PO_ASSIGNMENT_TYPE_OPTIONS;

  // Only the billing refinement and the deed-mode expansion run here — the
  // server already applied status, type, `q` and the sort.
  const displayRows = useMemo(
    () =>
      buildPoListPageRows({
        rows: pageResult?.rows ?? [],
        search: debouncedSearch,
        deedIndex,
        statusFilter,
      }),
    [pageResult, debouncedSearch, deedIndex, statusFilter],
  );

  const propertyDeedView =
    appliedSearchMode === "deed" && debouncedSearch.trim().length > 0;

  // `partially_billed` / `fully_billed` come back widened to their study bucket,
  // so the window over them is cut here instead of by the server.
  const billingBucket = isPoListBillingBucket(statusFilter);
  const billingWindow = useMemo(
    () => (billingBucket ? poListBillingWindow(displayRows, page) : null),
    [billingBucket, displayRows, page],
  );
  const serverPagination = poListServerPagination({
    totalCount: pageResult?.totalCount ?? 0,
    page,
    pageSize: pageResult?.pageSize ?? PO_LIST_PAGE_SIZE,
    totalPages: pageResult?.totalPages ?? 1,
  });
  const { totalPages, safePage, rangeStart, rangeEnd } =
    billingWindow ?? serverPagination;
  const totalCount = billingWindow
    ? billingWindow.totalCount
    : (pageResult?.totalCount ?? 0);
  const pageRows = billingWindow ? billingWindow.rows : displayRows;

  const mobileCardItems = useMemo((): ActiveQueueMobileCardItem[] => {
    return pageRows.map((entry) => {
      const { row: p, deedEntry, studied, expected, pct, urgent, target, rowKey } =
        poListRowView(entry, registeredByPo);
      const deedLabel = deedEntry?.deedNumber?.trim();
      const statusMeta = poListStatusMeta(p.status);
      const statusStyle = poStatusStyle(p.status);
      const tone: ActiveQueueMobileCardItem["tone"] = isPoListStatusTerminal(
        p.status,
      )
        ? "done"
        : urgent
          ? "returned"
          : p.status === "under_study" || pct > 0
            ? "pending"
            : "new";
      const specialist =
        p.specialist && p.specialist !== "—" ? p.specialist.trim() : "";

      return {
        id: rowKey,
        title: deedLabel
          ? deedLabel.startsWith("صك")
            ? deedLabel
            : `صك ${deedLabel}`
          : formatPoDisplay(p.id),
        meta: [
          ...(deedLabel
            ? [{ text: formatPoDisplay(p.id), kind: "po" as const }]
            : []),
          { text: p.type || "—", kind: "type" as const },
          specialist
            ? { text: specialist, kind: "place" as const }
            : {
                text: `${studied}/${expected || p.count || 0} مكتمل`,
                kind: "plain" as const,
              },
        ],
        statusLabel: statusMeta.label,
        statusStyle: {
          base: statusStyle.base,
          fg: statusStyle.fg,
        },
        tone,
        timerLabel: `${pct}%`,
        timerRatio: Math.min(1, Math.max(0, pct / 100)),
        timerOverdue: urgent,
        moreItems: buildPoListRowMoreItems({
          poNumber: p.id,
          status: p.status,
          showEdit,
          showDelete,
          showLifecycleActions: showEdit,
          showCreateOperationsTask,
          deleting: deletingPo === p.id,
          lifecycleBusy: lifecyclePo === p.id,
          router,
          onDelete: () => void handleDeletePo(p.id),
          onCancel: () => void handleCancelPo(p.id),
          onStop: () => void handleStopPo(p.id),
        }),
        onOpen: () => router.push(target),
      };
    });
  }, [
    pageRows,
    registeredByPo,
    showEdit,
    showDelete,
    showCreateOperationsTask,
    deletingPo,
    lifecyclePo,
    router,
  ]);

  function toggleSort(key: SortKey) {
    dispatchQuery({ type: "sort", key });
  }

  async function handleCancelPo(poNumber: string) {
    if (
      !window.confirm(
        `إلغاء أمر العمل «${poNumber}»؟ سيُعرض كملغى في القائمة.`,
      )
    ) {
      return;
    }
    setLifecyclePo(poNumber);
    const result = await cancelPoRecord(poNumber);
    setLifecyclePo(null);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: appDataKeys.all });
    showToast(`تم إلغاء أمر العمل «${poNumber}».`, "success");
  }

  async function handleStopPo(poNumber: string) {
    if (
      !window.confirm(
        `إيقاف أمر العمل «${poNumber}»؟ سيُعرض كمتوقف في القائمة.`,
      )
    ) {
      return;
    }
    setLifecyclePo(poNumber);
    const result = await stopPoRecord(poNumber);
    setLifecyclePo(null);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: appDataKeys.all });
    showToast(`تم إيقاف أمر العمل «${poNumber}».`, "success");
  }

  async function handleDeletePo(poNumber: string) {
    if (
      !window.confirm(
        `حذف أمر العمل «${poNumber}» وجميع عقاراته؟ لا يمكن التراجع.`,
      )
    ) {
      return;
    }
    setDeletingPo(poNumber);
    const result = await deletePoRecord(poNumber);
    setDeletingPo(null);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: appDataKeys.all });
    showToast(`تم حذف أمر العمل «${poNumber}» وعقاراته.`, "success");
  }

  return {
    router,
    showIntake,
    showEdit,
    showDelete,
    showCreateOperationsTask,
    intakeOpen,
    setIntakeOpen,
    deletingPo,
    lifecyclePo,
    search,
    setSearch,
    searchModeLabel,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    assignmentTypes,
    emptyMessage,
    totalCount,
    pageRows,
    teamByPo,
    registeredByPo,
    propertyDeedView,
    statsReady,
    isPlaceholderData,
    kpi,
    mobileCardItems,
    page,
    setPage,
    safePage,
    totalPages,
    rangeStart,
    rangeEnd,
    toggleSort,
    handleCancelPo,
    handleStopPo,
    handleDeletePo,
    onIntakeComplete: (poNumber: string) => {
      setIntakeOpen(false);
      router.push(poPropertiesPath(poNumber));
    },
  };
}
