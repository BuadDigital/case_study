"use client";

/**
 * PO list screen — KPI band, search/filter toolbar, the desktop queue table and
 * its mobile cards. Queries, filters and writes live in `usePoListWorkflow`;
 * pure rules in `po-list-view-state.ts`; sub-components in `PoListViewParts`.
 */

import { PO_LIST_STATUS_OPTIONS } from "@platform/app-shared/app-data/po-list-status";
import {
  Button,
  cn,
  KpiAlertIcon,
  KpiBand,
  KpiCell,
  KpiCheckIcon,
  KpiClipboardIcon,
  KpiClockIcon,
  MobileKpiStatCards,
  OperationalPanel,
  OperationalToolbarPrimaryButton,
  OperationalToolbarSearch,
  OperationalToolbarSelect,
  PageGutter,
  PageShell,
  PageToolbar,
  queueTableRowClassName,
  RowMoreMenu,
  SkeletonTableRows,
  Table,
  TableEmptyRow,
  TBody,
  Td,
  TdAction,
  TdLtr,
  Th,
  ThAction,
  THead,
  Tr,
} from "@platform/ui-kit";
import { PoNumber } from "@case-study/mfe/components/ui/PoNumber";
import { buildPoListRowMoreItems } from "../lib/app-data/po-list-row-menu";
import { ActiveQueueMobileCards } from "@platform/app-shared/components/ActiveQueueMobileCards";
import { formatDateAr } from "../lib/app-data/po-intake-data";
import { PoIntakeModal } from "@case-study/mfe/components/po-intake/PoIntakeModal";
import {
  poListRowView,
  progFill,
  teamMembersForRow,
  type StatusFilter,
} from "./po-list-view-state";
import {
  HoverPortalCard,
  InboxIcon,
  PlusIcon,
  PoStatusPill,
  SortIcon,
  TeamStack,
} from "./PoListViewParts";
import { usePoListWorkflow } from "./usePoListWorkflow";

export function PoListView() {
  const {
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
    kpi,
    mobileCardItems,
    setPage,
    safePage,
    totalPages,
    rangeStart,
    rangeEnd,
    toggleSort,
    handleCancelPo,
    handleStopPo,
    handleDeletePo,
    onIntakeComplete,
  } = usePoListWorkflow();

  return (
    <>
      {showIntake ? (
        <PoIntakeModal
          open={intakeOpen}
          onClose={() => setIntakeOpen(false)}
          onComplete={(record) => onIntakeComplete(record.poNumber)}
        />
      ) : null}

      <PageShell variant="canvas" className="gap-3 py-4 sm:py-5">
        <KpiBand className="mb-0 hidden shrink-0 lg:flex">
          <KpiCell
            first
            className="px-5 py-4"
            icon={<KpiClipboardIcon />}
            iconClass="bg-gold-soft text-gold-d"
            label="أوامر نشطة"
            value={kpi ? kpi.active : "—"}
            sub="قيد التنفيذ حاليًا"
            dot
          />
          <KpiCell
            className="px-5 py-4"
            icon={<KpiAlertIcon />}
            iconClass="bg-[color-mix(in_srgb,var(--red)_15%,transparent)] text-red"
            label="متأخرة عن الاستحقاق"
            value={kpi ? kpi.overdue : "—"}
            valueClass="!text-red"
            sub="تحتاج معالجة فورية"
          />
          <KpiCell
            className="px-5 py-4"
            icon={<KpiClockIcon />}
            iconClass="bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#b8791a]"
            label="تستحق خلال 48 ساعة"
            value={kpi ? kpi.dueSoon : "—"}
            sub="قدّمها في الأولوية"
          />
          <KpiCell
            last
            className="px-5 py-4"
            icon={<KpiCheckIcon />}
            iconClass="bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-success-text"
            label="عقارات أُنجزت اليوم"
            value={kpi ? kpi.doneProps : "—"}
            valueClass="!text-success-text"
            sub="عبر جميع الأوامر"
          />
        </KpiBand>

        <MobileKpiStatCards
          className="mb-0"
          items={[
            {
              key: "active",
              label: "أوامر نشطة",
              sub: "قيد التنفيذ حاليًا",
              value: kpi ? kpi.active : "—",
              icon: <KpiClipboardIcon />,
              iconClass: "bg-gold-soft text-gold-d",
              tone: "gold",
              valueClass: "!text-gold-d",
            },
            {
              key: "overdue",
              label: "متأخرة عن الاستحقاق",
              sub: "تحتاج معالجة فورية",
              value: kpi ? kpi.overdue : "—",
              icon: <KpiAlertIcon />,
              iconClass:
                "bg-[color-mix(in_srgb,var(--red)_15%,transparent)] text-red",
              tone: "red",
              valueClass: "!text-red",
            },
            {
              key: "dueSoon",
              label: "تستحق خلال 48 ساعة",
              sub: "قدّمها في الأولوية",
              value: kpi ? kpi.dueSoon : "—",
              icon: <KpiClockIcon />,
              iconClass:
                "bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#b8791a]",
              tone: "gold",
            },
            {
              key: "done",
              label: "عقارات أُنجزت اليوم",
              sub: "عبر جميع الأوامر",
              value: kpi ? kpi.doneProps : "—",
              icon: <KpiCheckIcon />,
              iconClass:
                "bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-ink",
              tone: "ink",
              valueClass: "!text-ink",
            },
          ]}
        />

        <PageToolbar className="mb-0 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b-0 bg-transparent px-0 py-0">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5 max-lg:w-full">
            <OperationalToolbarSearch
              type="search"
              placeholder="PO أو رقم الصك أو نوع الإسناد…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="بحث أوامر العمل"
              className="max-lg:min-w-0 max-lg:flex-1"
              endAdornment={
                search.trim() && searchModeLabel ? (
                  <span className="pointer-events-none absolute inset-inline-end-2.5 top-1/2 -translate-y-1/2 rounded-full bg-info-bg px-2 py-0.5 text-[10px] font-medium text-info-text">
                    {searchModeLabel}
                  </span>
                ) : null
              }
            />
            <OperationalToolbarSelect
              className="shrink-0 max-lg:min-h-11"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              aria-label="تصفية الحالة"
            >
              <option value="">جميع الحالات</option>
              {PO_LIST_STATUS_OPTIONS.filter((o) => o.value !== "").map(
                (option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ),
              )}
            </OperationalToolbarSelect>
            <OperationalToolbarSelect
              className="shrink-0 max-lg:min-h-11"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="تصفية نوع الإسناد"
            >
              <option value="">جميع أنواع الإسناد</option>
              {assignmentTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </OperationalToolbarSelect>
          </div>
          {showIntake ? (
            <OperationalToolbarPrimaryButton onClick={() => setIntakeOpen(true)}>
              <PlusIcon />
              أمر عمل جديد
            </OperationalToolbarPrimaryButton>
          ) : null}
        </PageToolbar>

        <OperationalPanel className="shrink-0 overflow-visible max-lg:border-0 max-lg:bg-transparent max-lg:shadow-none max-lg:rounded-none">
          <Table framed pending={!statsReady} wrapClassName="hidden lg:block">
                <THead>
                  <Tr hoverable={false}>
                    <Th>
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-0.5 border-none bg-transparent p-0 font-inherit text-inherit"
                        onClick={() => toggleSort("po")}
                      >
                        رقم PO
                        <SortIcon />
                      </button>
                    </Th>
                    <Th>نوع الإسناد</Th>
                    <Th className="text-center">عدد الصكوك</Th>
                    <Th className="text-center">المكتملة</Th>
                    <Th>التقدم</Th>
                    <Th>الحالة</Th>
                    <Th>
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-0.5 border-none bg-transparent p-0 font-inherit text-inherit"
                        onClick={() => toggleSort("received")}
                      >
                        تاريخ الاستلام
                        <SortIcon />
                      </button>
                    </Th>
                    <Th>
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-0.5 border-none bg-transparent p-0 font-inherit text-inherit"
                        onClick={() => toggleSort("due")}
                      >
                        تاريخ الاستحقاق
                        <SortIcon />
                      </button>
                    </Th>
                    <Th>أخصائي الإسناد</Th>
                    <Th>الفريق</Th>
                    <ThAction aria-label="إجراءات" />
                  </Tr>
                </THead>
                <TBody>
                  {!statsReady ? (
                    <SkeletonTableRows rows={10} cols={11} />
                  ) : pageRows.length === 0 ? (
                    <TableEmptyRow colSpan={11}>
                      <div className="flex flex-col items-center justify-center gap-2">
                        <InboxIcon />
                        <span>{emptyMessage}</span>
                      </div>
                    </TableEmptyRow>
                  ) : (
                    pageRows.map((entry) => {
                      const { row: p, studied, pct, urgent, target, rowKey } =
                        poListRowView(entry, registeredByPo);
                      const projectTip = p.project?.trim() || "";
                      const teamMembers = teamMembersForRow(teamByPo, p);

                      return (
                        <Tr
                          key={rowKey}
                          hoverable={false}
                          className={cn(
                            "group",
                            queueTableRowClassName,
                            propertyDeedView && "bg-[color-mix(in_srgb,var(--info-bg)_22%,var(--surface))]",
                          )}
                          onClick={() => router.push(target)}
                        >
                          <Td className="overflow-visible">
                            {projectTip ? (
                              <HoverPortalCard
                                align="end"
                                panelClassName="max-w-[260px] whitespace-normal rounded-lg bg-ink px-2.5 py-1.5 text-[12px] font-semibold leading-snug text-white shadow-[0_8px_22px_-8px_rgba(18,40,76,.4)]"
                                content={projectTip}
                                triggerClassName="block w-full"
                              >
                                <PoNumber
                                  value={p.id}
                                  link
                                  className="text-[13.5px] !font-bold text-primary"
                                />
                              </HoverPortalCard>
                            ) : (
                              <PoNumber
                                value={p.id}
                                link
                                className="text-[13.5px] !font-bold text-primary"
                              />
                            )}
                          </Td>
                          <Td className="whitespace-nowrap">
                            <span className="inline-flex items-center rounded-md border border-border-md bg-surface-2 px-2.5 py-[3px] text-[12px] font-medium text-text-2">
                              {p.type}
                            </span>
                          </Td>
                          <Td className="whitespace-nowrap text-center text-[14px] font-extrabold text-heading tabular-nums">
                            {p.count}
                          </Td>
                          <Td className="whitespace-nowrap text-center text-[13.5px] font-bold text-text-2 tabular-nums">
                            {studied}
                          </Td>
                          <Td className="whitespace-nowrap">
                            <div className="flex min-w-[120px] items-center gap-2.5">
                              <div
                                className="h-1.5 min-w-[60px] flex-1 overflow-hidden rounded-full"
                                style={{
                                  background:
                                    "color-mix(in srgb, var(--text-3) 26%, transparent)",
                                }}
                              >
                                <div
                                  className="h-full rounded-full transition-[width] duration-500"
                                  style={{
                                    width: `${pct}%`,
                                    background: progFill(pct),
                                  }}
                                />
                              </div>
                              <span className="min-w-8 text-start text-[12px] font-bold text-heading tabular-nums">
                                {pct}%
                              </span>
                            </div>
                          </Td>
                          <Td className="whitespace-nowrap">
                            <PoStatusPill status={p.status} />
                          </Td>
                          <TdLtr className="whitespace-nowrap text-[13px] text-text-2">
                            {p.date ? formatDateAr(p.date) : "—"}
                          </TdLtr>
                          <TdLtr
                            className={cn(
                              "whitespace-nowrap text-[13px] font-semibold",
                              urgent ? "text-red" : "text-heading",
                            )}
                          >
                            {p.dueDate ? formatDateAr(p.dueDate) : "—"}
                          </TdLtr>
                          <Td className="whitespace-nowrap text-[13px] font-semibold text-heading">
                            {p.specialist && p.specialist !== "—" ? (
                              p.specialist
                            ) : (
                              <span className="font-normal text-text-3">—</span>
                            )}
                          </Td>
                          <Td className="overflow-visible whitespace-nowrap">
                            <TeamStack members={teamMembers} />
                          </Td>
                          <TdAction onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center">
                              <RowMoreMenu
                                items={buildPoListRowMoreItems({
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
                                })}
                              />
                            </div>
                          </TdAction>
                        </Tr>
                      );
                    })
                  )}
                </TBody>
              </Table>

          <div className="px-0 pb-1 lg:hidden">
            <ActiveQueueMobileCards
              items={mobileCardItems}
              pending={!statsReady}
              emptyMessage={emptyMessage}
            />
          </div>
        </OperationalPanel>

          <PageGutter className="flex shrink-0 items-center justify-between bg-transparent px-0 py-3">
              <span className="text-[13px] text-text-3">
                {statsReady
                  ? (
                      <>
                        عرض{" "}
                        <b className="font-bold text-heading">
                          {rangeStart}–{rangeEnd}
                        </b>{" "}
                        من{" "}
                        <b className="font-bold text-heading">
                          {totalCount}
                        </b>{" "}
                        نتيجة
                      </>
                    )
                  : "—"}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="h-[30px] w-[30px] p-0 disabled:opacity-40"
                  disabled={safePage <= 1}
                  onClick={() => setPage(safePage - 1)}
                  aria-label="الصفحة السابقة"
                >
                  ‹
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((n) => {
                    if (totalPages <= 7) return true;
                    if (n === 1 || n === totalPages) return true;
                    return Math.abs(n - safePage) <= 1;
                  })
                  .map((n, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showGap = prev != null && n - prev > 1;
                    return (
                      <span key={n} className="contents">
                        {showGap ? (
                          <span className="px-1 text-[12px] text-text-3">…</span>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant={n === safePage ? "primary" : "default"}
                          className="h-[30px] min-w-[30px] px-1.5"
                          aria-current={n === safePage ? "page" : undefined}
                          onClick={() => setPage(n)}
                        >
                          {n}
                        </Button>
                      </span>
                    );
                  })}
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="h-[30px] w-[30px] p-0 disabled:opacity-40"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(safePage + 1)}
                  aria-label="الصفحة التالية"
                >
                  ›
                </Button>
              </div>
          </PageGutter>
      </PageShell>
    </>
  );
}
