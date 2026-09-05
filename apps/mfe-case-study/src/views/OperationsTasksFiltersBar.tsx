"use client";

/** Operations-tasks list — search / status / scope toolbar, create button and the bulk-selection bar. */

import {
  cn,
  OperationalToolbarPrimaryButton,
  OperationalToolbarSearch,
  OperationalToolbarSelect,
  Spinner,
} from "@platform/ui-kit";
import {
  OPERATIONS_TASK_SCOPE_LABELS,
  OPERATIONS_TASK_STATUS_LABELS,
} from "../lib/app-data/operations-task-display";
import { TasksShowAllEye } from "../components/tasks/TasksHtmlPrimitives";
import {
  opsBulk,
  opsBulkClear,
  opsBulkCount,
  opsFilters,
  opsListCount,
  opsRemindBtn,
  opsShowAllBtn,
  opsShowAllBtnOn,
  opsToolbar,
} from "../lib/app-data/ops-tasks-tw";
import {
  BellIcon,
  PlusIcon,
  type OperationsTasksWorkflow,
} from "./OperationsTasksViewShared";

export type OperationsTasksFiltersBarProps = Pick<
  OperationsTasksWorkflow,
  | "canCreate"
  | "scopeFilter"
  | "search"
  | "setCreateOpen"
  | "setCreatePrefill"
  | "setScopeFilter"
  | "setSearch"
  | "setShowAll"
  | "setStatusFilter"
  | "showAll"
  | "showAllEyeBlink"
  | "statusFilter"
  | "toggleShowAll"
  | "visibleTasks"
> & {
  /** Warm the create-modal chunk on hover/focus of the create button. */
  onPreloadCreate: () => void;
};

export function OperationsTasksFiltersBar({
  canCreate,
  scopeFilter,
  search,
  setCreateOpen,
  setCreatePrefill,
  setScopeFilter,
  setSearch,
  setShowAll,
  setStatusFilter,
  showAll,
  showAllEyeBlink,
  statusFilter,
  toggleShowAll,
  visibleTasks,
  onPreloadCreate,
}: OperationsTasksFiltersBarProps) {
  return (
    <div className={opsToolbar}>
      <div className={cn(opsFilters, "flex-1")}>
        <OperationalToolbarSearch
          type="search"
          placeholder="عنوان المهمة أو المنفّذ أو رقم الصك…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="بحث المهام"
        />
        <div className="flex flex-wrap items-center gap-2.5 max-lg:grid max-lg:w-full max-lg:grid-cols-2 lg:contents">
          <OperationalToolbarSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="تصفية الحالة"
          >
            <option value="">جميع الحالات</option>
            {Object.entries(OPERATIONS_TASK_STATUS_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </OperationalToolbarSelect>
          <OperationalToolbarSelect
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
            aria-label="تصفية النطاق"
          >
            <option value="">كل النطاقات</option>
            {Object.entries(OPERATIONS_TASK_SCOPE_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </OperationalToolbarSelect>
        </div>
        <div className="flex items-center gap-2 max-lg:w-full lg:contents">
          <button
            type="button"
            className={showAll ? opsShowAllBtnOn : opsShowAllBtn}
            onClick={() => setShowAll(toggleShowAll)}
          >
            <TasksShowAllEye open={showAll} blink={showAllEyeBlink} />
            <span>{showAll ? "النشطة فقط" : "إظهار جميع المهام"}</span>
          </button>
          <span className={opsListCount} aria-live="polite">
            {visibleTasks.length}
            <span>نتيجة</span>
          </span>
        </div>
      </div>
      {canCreate ? (
        <OperationalToolbarPrimaryButton
          className="ms-3 max-lg:ms-0"
          onClick={() => {
            setCreatePrefill(null);
            setCreateOpen(true);
          }}
          onMouseEnter={onPreloadCreate}
          onFocus={onPreloadCreate}
        >
          <PlusIcon />
          <span>إنشاء مهمة</span>
        </OperationalToolbarPrimaryButton>
      ) : null}
    </div>
  );
}

export type OperationsTasksBulkBarProps = Pick<
  OperationsTasksWorkflow,
  | "bulkRemind"
  | "bulkReminding"
  | "busy"
  | "canRemind"
  | "selectedCount"
  | "setSelectedIds"
>;

export function OperationsTasksBulkBar({
  bulkRemind,
  bulkReminding,
  busy,
  canRemind,
  selectedCount,
  setSelectedIds,
}: OperationsTasksBulkBarProps) {
  if (selectedCount > 0 && canRemind) {
    return (
      <div className={opsBulk}>
        <BellIcon size={16} />
        <span className={opsBulkCount}>{selectedCount} مهمة محددة</span>
        <button
          type="button"
          className={cn(opsRemindBtn, "ms-auto")}
          disabled={busy || bulkReminding}
          aria-busy={busy || bulkReminding || undefined}
          onClick={bulkRemind}
        >
          {busy || bulkReminding ? <Spinner /> : <BellIcon size={15} />}
          <span>
            {busy || bulkReminding
              ? "جاري التذكير…"
              : "تذكير المحدد دفعة واحدة"}
          </span>
        </button>
        <button
          type="button"
          className={opsBulkClear}
          onClick={() => setSelectedIds({})}
        >
          إلغاء التحديد
        </button>
      </div>
    );
  }
  if (selectedCount > 0) {
    return (
      <div className={opsBulk}>
        <span className={opsBulkCount}>{selectedCount} مهمة محددة</span>
        <button
          type="button"
          className={opsBulkClear}
          onClick={() => setSelectedIds({})}
        >
          إلغاء التحديد
        </button>
      </div>
    );
  }
  return null;
}
