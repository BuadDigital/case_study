"use client";

/**
 * All non-rendering workflow behind `PoListView`: queries, search/sort/paging
 * state, the derived queue, and the cancel/stop/delete writes. The view consumes
 * the returned bag and keeps JSX plus event wiring only.
 */
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useToast, confirmAction } from "@platform/ui-kit";
import { queryLoadFailed } from "@platform/app-shared/query/query-load-state";
import {
  isPoListStatusTerminal,
  poListStatusMeta,
  poListStatusOptions,
} from "@platform/app-shared/app-data/po-list-status";
import { canSeeBillingStatuses } from "@platform/app-shared/app-data/role-access";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import type { ActiveQueueMobileCardItem } from "@platform/app-shared/components/ActiveQueueMobileCards";
import { poPropertiesPath } from "@platform/app-shared/domain/po-routes";
import { formatPoDisplay } from "../lib/app-data/po-intake-data";
import {
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
  prefetchPoRecord,
  usePoListRowsPageQuery,
  usePropertyListItemsQuery,
  useWorkflowTasksQuery,
  useWorkOrderListCountsQuery,
} from "@case-study/mfe/query/case-study-queries";
import { useDebouncedValue } from "@platform/app-shared/hooks/use-debounced-value";
import {
  canDecideTransactionCancel,
  canDeletePo,
  canEditPoHeader,
  canReceivePo,
  canRequestTransactionCancel,
} from "../lib/app-data/po-roles";
import { canManageOperationsTasks } from "../lib/app-data/operations-task-roles";
import {
  buildPoListPageRows,
  initialPoListQuery,
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
  rowDisplayStatus,
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
  const showCancel = canRequestTransactionCancel(role);
  const cancelDecides = canDecideTransactionCancel(role);
  /** «إلغاء أمر العمل» dialog — the work order whose live transactions are being cancelled. */
  const [cancelPo, setCancelPo] = useState<string | null>(null);
  /** Billing labels are Finance's and management's; everyone else sees the study status. */
  const billing = canSeeBillingStatuses(role);
  const { showToast } = useToast();
  const [deletingPo, setDeletingPo] = useState<string | null>(null);
  const [lifecyclePo, setLifecyclePo] = useState<string | null>(null);
  const [intakeOpen, setIntakeOpenState] = useState(false);
  /** `/po/intake` redirects here as `?intake=1` — the deep link into the modal. */
  const intakeFromQuery = searchParams.get("intake") === "1";
  const [query, dispatchQuery] = useReducer(
    poListQueryReducer,
    role,
    initialPoListQuery,
  );
  const { search, statusFilter, typeFilter, page } = query;
  const setSearch = (value: string) =>
    dispatchQuery({ type: "search", value });
  const setStatusFilter = (value: StatusFilter) =>
    dispatchQuery({ type: "status", value });
  const setTypeFilter = (value: string) =>
    dispatchQuery({ type: "assignmentType", value });
  const setPage = (value: number) => dispatchQuery({ type: "page", page: value });

  // `?intake=1` opens the modal — adjusted during render so it is already open on
  // the first paint after the navigation.
  const intakeRequested = showIntake && intakeFromQuery;
  const [prevIntakeRequested, setPrevIntakeRequested] = useState(intakeRequested);
  if (prevIntakeRequested !== intakeRequested) {
    setPrevIntakeRequested(intakeRequested);
    if (intakeRequested) setIntakeOpenState(true);
  }

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

  const pageQuery = usePoListRowsPageQuery(serverQuery);
  const {
    data: pageResult,
    isPending: pagePending,
    isPlaceholderData,
  } = pageQuery;
  // The KPI band and the empty-state copy are SQL COUNTs on the same filters —
  // no list is loaded for them any more (pagination-contract).
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
      const shownStatus = rowDisplayStatus(p, billing);
      const statusMeta = poListStatusMeta(shownStatus);
      const statusStyle = poStatusStyle(shownStatus);
      const tone: ActiveQueueMobileCardItem["tone"] = isPoListStatusTerminal(
        shownStatus,
      )
        ? "done"
        : urgent
          ? "returned"
          : shownStatus === "under_study" ||
              shownStatus === "ready_for_enfaz" ||
              pct > 0
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
                text: `${studied}/${expected || p.count || 0} مرفوع`,
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
          showCancel,
          cancelDecides,
          showCreateOperationsTask,
          deleting: deletingPo === p.id,
          lifecycleBusy: lifecyclePo === p.id,
          router,
          onDelete: () => void handleDeletePo(p.id),
          onCancel: () => setCancelPo(p.id),
          onStop: () => void handleStopPo(p.id),
        }),
        onOpen: () => router.push(target),
      };
    });
    // The lifecycle handlers below only touch stable setters, the toast and
    // the query client, so the rows never capture stale state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pageRows,
    registeredByPo,
    billing,
    showEdit,
    showCancel,
    cancelDecides,
    showDelete,
    showCreateOperationsTask,
    deletingPo,
    lifecyclePo,
    router,
  ]);

  function toggleSort(key: SortKey) {
    dispatchQuery({ type: "sort", key });
  }

  async function handleStopPo(poNumber: string) {
    const ok = await confirmAction({
      title: "إيقاف أمر العمل",
      message: `إيقاف أمر العمل «${poNumber}»؟ سيُعرض كمتوقف في القائمة.`,
      confirmLabel: "إيقاف",
    });
    if (!ok) return;
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
    const ok = await confirmAction({
      title: "حذف أمر العمل",
      message: `حذف أمر العمل «${poNumber}» وجميع عقاراته؟ لا يمكن التراجع.`,
      confirmLabel: "حذف",
      danger: true,
    });
    if (!ok) return;
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
    billing,
    statusOptions: poListStatusOptions({ billing }),
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
    /** The page failed with no rows to show — the view swaps in the error state. */
    pageLoadFailed: queryLoadFailed(pageQuery),
    pageLoadError: pageQuery.error,
    retryPageLoad: () => void pageQuery.refetch(),
    pageRetrying: pageQuery.isFetching,
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
    showCancel,
    cancelDecides,
    cancelPo,
    /** Opens the «إلغاء أمر العمل» dialog for one order (null closes it). */
    setCancelPo,
    handleStopPo,
    handleDeletePo,
    /** Row hover: both screens a row opens read this PO's record — fetch it before the click. */
    warmPo: (poNumber: string) => prefetchPoRecord(queryClient, poNumber),
    onIntakeComplete: (poNumber: string) => {
      setIntakeOpen(false);
      router.push(poPropertiesPath(poNumber));
    },
  };
}
