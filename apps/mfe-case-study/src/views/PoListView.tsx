"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { PoRow } from "@platform/app-shared/prototype/constants";
import {
  isPoListStatusTerminal,
  PO_LIST_STATUS_OPTIONS,
  poListStatusMeta,
  poProgressPct,
  type PoListStatus,
} from "@platform/app-shared/prototype/po-list-status";
import {
  Badge,
  Button,
  Input,
  OperationalPanel,
  PageGutter,
  PageShell,
  PageToolbar,
  Select,
  StatCard,
  StatGrid,
  StatLabel,
  StatSkeleton,
  StatSub,
  StatValue,
  SkeletonTableRows,
  Table,
  TBody,
  Td,
  TdAction,
  Th,
  ThAction,
  THead,
  Tr,
  cn,
  queueTableRowClassName,
  useToast,
} from "@platform/design-system";
import { PoNumber } from "@case-study/mfe/components/ui/PoNumber";
import { RowMoreMenu } from "@case-study/mfe/components/ui/RowMoreMenu";
import { buildPoListRowMoreItems } from "../lib/prototype/po-list-row-menu";
import { ltrValueClass } from "../components/po-intake/PropertyDetailFields";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { formatDateAr, isPastDue } from "../lib/prototype/po-intake-data";
import {
  cancelPoRecord,
  deletePoRecord,
  stopPoRecord,
} from "../lib/prototype/po-intake-storage";
import { poHeaderEditPath, poPropertiesPath, poPropertyPath } from "../lib/po-routes";
import {
  buildPoDeedIndex,
  buildPoListDisplay,
  classifyPoListSearch,
  poListSearchModeLabel,
  type PoDeedIndexEntry,
} from "../lib/prototype/po-list-search";
import { PoIntakeModal } from "@case-study/mfe/components/po-intake/PoIntakeModal";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  usePoListRowsQuery,
  usePropertyListItemsQuery,
} from "@case-study/mfe/query/case-study-queries";
import {
  canDeletePo,
  canEditPoHeader,
  canReceivePo,
  isPoViewOnly,
} from "../lib/prototype/po-roles";

type SortKey = "created" | "po" | "received" | "due";
type SortDir = "asc" | "desc";
type StatusFilter = PoListStatus | "";

const PO_LIST_TOOLBAR_FIELD =
  "!h-8 !py-0 !leading-8 border-border-md bg-surface px-2.5 text-xs shadow-none";

function isDueSoon(iso: string): boolean {
  if (!iso) return false;
  const due = new Date(iso.slice(0, 10));
  const now = new Date();
  const diff = due.getTime() - now.getTime();
  return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
}

function isDueUrgent(dueIso: string, status: PoRow["status"]): boolean {
  if (!dueIso || isPoListStatusTerminal(status)) return false;
  return isPastDue(dueIso) || isDueSoon(dueIso);
}

function progressFillClass(pct: number): string {
  if (pct >= 80) return "bg-primary";
  if (pct >= 40) return "bg-amber";
  return "bg-red";
}

function PoListStatusBadge({ status }: { status: PoRow["status"] }) {
  const { tone, label } = poListStatusMeta(status);
  return <Badge tone={tone}>{label}</Badge>;
}

function SearchIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg
      className="ms-0.5 opacity-70"
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path d="M4 4h16v12H4zM4 12l4 4h8l4-4" />
    </svg>
  );
}

export function PoListView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { role } = usePrototype();
  const viewOnly = isPoViewOnly(role);
  const showIntake = canReceivePo(role);
  const showEdit = canEditPoHeader(role);
  const showDelete = canDeletePo(role);
  const { showToast } = useToast();
  const [deletingPo, setDeletingPo] = useState<string | null>(null);
  const [lifecyclePo, setLifecyclePo] = useState<string | null>(null);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    if (!showIntake) return;
    if (searchParams.get("intake") !== "1") return;
    setIntakeOpen(true);
    router.replace("/po", { scroll: false });
  }, [showIntake, searchParams, router]);

  const { data: rows, isPending: rowsPending } = usePoListRowsQuery();
  const { data: propertyItems } = usePropertyListItemsQuery();
  const list = useMemo(() => rows ?? [], [rows]);
  const deedIndex = useMemo(
    () => buildPoDeedIndex(propertyItems ?? []),
    [propertyItems],
  );
  const registeredByPo = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of deedIndex) {
      counts.set(entry.poNumber, (counts.get(entry.poNumber) ?? 0) + 1);
    }
    return counts;
  }, [deedIndex]);
  const searchMode = useMemo(() => classifyPoListSearch(search), [search]);
  const searchModeLabel = poListSearchModeLabel(searchMode);
  const statsReady = rows !== undefined && !rowsPending;

  const stats = useMemo(() => {
    if (!statsReady) return undefined;
    const propertyCount = list.reduce((n, p) => n + p.count, 0);
    const avgPerPo =
      list.length > 0 ? (propertyCount / list.length).toFixed(1) : "0";
    const doneMonth = list.filter(
      (p) =>
        p.status === "completed" ||
        p.status === "fully_billed" ||
        p.status === "partially_billed",
    ).length;
    return {
      total: list.length,
      propertyCount,
      avgPerPo,
      doneMonth,
    };
  }, [list, statsReady]);

  const assignmentTypes = useMemo(
    () =>
      [...new Set(list.map((p) => p.type).filter((t) => t && t !== "—"))].sort(
        (a, b) => a.localeCompare(b, "ar"),
      ),
    [list],
  );

  const filtered = useMemo(() => {
    const q = search.trim();
    let result = buildPoListDisplay(list, q, deedIndex).filter((entry) => {
      const row = entry.view === "po" ? entry.item.row : entry.item.row;
      const matchStatus = !statusFilter || row.status === statusFilter;
      const matchType = !typeFilter || row.type === typeFilter;
      return matchStatus && matchType;
    });

    result = [...result].sort((a, b) => {
      const rowA = a.view === "po" ? a.item.row : a.item.row;
      const rowB = b.view === "po" ? b.item.row : b.item.row;
      let cmp = 0;
      if (sortKey === "created") {
        const createdA = rowA.createdAtUtc || "";
        const createdB = rowB.createdAtUtc || "";
        if (createdA && createdB) {
          cmp = createdA.localeCompare(createdB);
        } else {
          cmp =
            list.findIndex((r) => r.id === rowA.id) -
            list.findIndex((r) => r.id === rowB.id);
        }
        if (cmp === 0) {
          cmp = rowA.id.localeCompare(rowB.id);
        }
      } else if (sortKey === "po") {
        cmp = rowA.id.localeCompare(rowB.id);
        if (cmp === 0 && a.view === "property" && b.view === "property") {
          cmp = a.item.deed.deedNumber.localeCompare(
            b.item.deed.deedNumber,
            "ar",
          );
        }
      } else if (sortKey === "received") {
        cmp = (rowA.date || "").localeCompare(rowB.date || "");
      } else {
        cmp = (rowA.dueDate || "").localeCompare(rowB.dueDate || "");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [list, search, deedIndex, statusFilter, typeFilter, sortKey, sortDir]);

  const propertyDeedView = searchMode === "deed" && search.trim().length > 0;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, filtered.length);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, typeFilter]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "po" || key === "created" ? "desc" : "asc");
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
    await queryClient.invalidateQueries({ queryKey: prototypeKeys.all });
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
    await queryClient.invalidateQueries({ queryKey: prototypeKeys.all });
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
    await queryClient.invalidateQueries({ queryKey: prototypeKeys.all });
    showToast(`تم حذف أمر العمل «${poNumber}» وعقاراته.`, "success");
  }

  return (
    <>
      {showIntake ? (
        <PoIntakeModal
          open={intakeOpen}
          onClose={() => setIntakeOpen(false)}
          onComplete={(record) => {
            setIntakeOpen(false);
            router.push(poPropertiesPath(record.poNumber));
          }}
        />
      ) : null}

      <PageShell variant="canvas" className="min-h-0 flex-1">
        <StatGrid cols={4}>
            {statsReady ? (
              <>
                <StatCard accent="default">
                  <StatLabel>إجمالي أوامر العمل</StatLabel>
                  <StatValue value={stats?.total} countUp />
                  <StatSub>PO نشط</StatSub>
                </StatCard>
                <StatCard accent="amber">
                  <StatLabel>عقارات نشطة</StatLabel>
                  <StatValue value={stats?.propertyCount} countUp />
                  <StatSub>قيد المعالجة</StatSub>
                </StatCard>
                <StatCard accent="blue">
                  <StatLabel>متوسط العقارات / PO</StatLabel>
                  <StatValue value={stats?.avgPerPo} />
                  <StatSub>عقار لكل أمر</StatSub>
                </StatCard>
                <StatCard accent="gray">
                  <StatLabel>مكتملة / مفوترة</StatLabel>
                  <StatValue value={stats?.doneMonth} countUp />
                  <StatSub>{`من ${stats?.total ?? 0} إجمالي`}</StatSub>
                </StatCard>
              </>
            ) : (
              Array.from({ length: 4 }, (_, index) => (
                <StatCard key={index} accent="gray">
                  <StatSkeleton />
                </StatCard>
              ))
            )}
        </StatGrid>

        <OperationalPanel className="min-h-0 flex-1">
          <PageToolbar className="shrink-0 border-b-0 bg-surface-2">
              {showIntake ? (
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  className="shrink-0"
                  onClick={() => setIntakeOpen(true)}
                >
                  <PlusIcon />
                  أمر عمل جديد
                </Button>
              ) : null}
              <div className="relative min-w-[min(100%,220px)] flex-1 basis-[240px] max-w-[320px]">
                <span className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-text-3">
                  <SearchIcon />
                </span>
                <Input
                  className={cn(
                    PO_LIST_TOOLBAR_FIELD,
                    "pe-8 text-[12.5px]",
                    search.trim() && searchModeLabel && "ps-[6.25rem]",
                  )}
                  type="search"
                  placeholder="PO أو رقم الصك أو نوع الإسناد…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="بحث أوامر العمل"
                />
                {search.trim() && searchModeLabel ? (
                  <span className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 rounded-full bg-info-bg px-2 py-0.5 text-[10px] font-medium text-info-text">
                    {searchModeLabel}
                  </span>
                ) : null}
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-none">
                <Select
                  className={cn(
                    PO_LIST_TOOLBAR_FIELD,
                    "!w-auto min-w-[148px] max-w-full shrink-0 sm:w-[148px]",
                  )}
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as StatusFilter)
                  }
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
                </Select>
                <Select
                  className={cn(
                    PO_LIST_TOOLBAR_FIELD,
                    "!w-auto min-w-[168px] max-w-full shrink-0 sm:w-[168px]",
                  )}
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
                </Select>
              </div>
              <span className="w-full text-[11.5px] text-text-3 sm:ms-auto sm:w-auto">
                {statsReady ? `${filtered.length} نتيجة` : "—"}
              </span>
          </PageToolbar>

          <Table pending={!statsReady}>
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
                    <Th>العقارات</Th>
                    <Th>المكتملة</Th>
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
                    <ThAction aria-label="إجراءات" />
                  </Tr>
                </THead>
                <TBody>
                  {!statsReady ? (
                    <SkeletonTableRows rows={8} cols={10} />
                  ) : filtered.length === 0 ? (
                    <Tr hoverable={false}>
                      <Td
                        colSpan={10}
                        className="cursor-default py-10 text-center text-[13px] text-text-3"
                      >
                        <div className="flex flex-col items-center justify-center gap-2">
                          <InboxIcon />
                          <span>
                            {list.length === 0
                              ? "لا توجد أوامر عمل."
                              : "لا توجد نتائج مطابقة"}
                          </span>
                        </div>
                      </Td>
                    </Tr>
                  ) : (
                    pageRows.map((entry) => {
                      const p = entry.view === "po" ? entry.item.row : entry.item.row;
                      const deedEntry =
                        entry.view === "property" ? entry.item.deed : null;
                      const match =
                        entry.view === "po" ? entry.item.match : entry.item.match;
                      const registered =
                        p.registered ?? registeredByPo.get(p.id) ?? 0;
                      const studied = p.done ?? 0;
                      const expected = p.count ?? 0;
                      const pct = poProgressPct(registered, studied, expected);
                      const urgent = isDueUrgent(p.dueDate, p.status);
                      const target =
                        deedEntry || match?.propertyId
                          ? poPropertyPath(
                              p.id,
                              deedEntry?.propertyId ?? match!.propertyId!,
                            )
                          : poPropertiesPath(p.id);
                      const rowKey =
                        entry.view === "property"
                          ? `${p.id}-${deedEntry!.propertyId}`
                          : p.id;

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
                          <Td>
                            <PoNumber
                              value={p.id}
                              link
                              className="text-[13px] font-medium text-primary"
                            />
                          </Td>
                          <Td className="whitespace-nowrap">{p.type}</Td>
                          <Td className="whitespace-nowrap">
                            <strong>{p.count}</strong>
                          </Td>
                          <Td className="whitespace-nowrap">{studied}</Td>
                          <Td className="whitespace-nowrap">
                            <div className="flex min-w-[120px] items-center gap-2">
                              <div className="h-[5px] min-w-[60px] flex-1 overflow-hidden rounded bg-surface-3">
                                <div
                                  className={cn(
                                    "h-full rounded transition-[width] duration-300",
                                    progressFillClass(pct),
                                  )}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="min-w-7 text-end text-[11.5px] text-text-2 tabular-nums">
                                {pct}%
                              </span>
                            </div>
                          </Td>
                          <Td className="whitespace-nowrap">
                            <PoListStatusBadge status={p.status} />
                          </Td>
                          <Td className="whitespace-nowrap text-[12.5px] text-text-2">
                            {p.date ? (
                              <bdi dir="ltr" className={ltrValueClass}>
                                {formatDateAr(p.date)}
                              </bdi>
                            ) : (
                              "—"
                            )}
                          </Td>
                          <Td
                            className={cn(
                              "whitespace-nowrap text-[12.5px]",
                              urgent
                                ? "font-medium text-red"
                                : "text-text",
                            )}
                          >
                            {p.dueDate ? (
                              <bdi dir="ltr" className={ltrValueClass}>
                                {formatDateAr(p.dueDate)}
                              </bdi>
                            ) : (
                              "—"
                            )}
                          </Td>
                          <Td className="whitespace-nowrap text-[12.5px] text-text">
                            {p.specialist}
                          </Td>
                          <TdAction onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              {showEdit ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  title="تعديل"
                                  onClick={() =>
                                    router.push(poHeaderEditPath(p.id))
                                  }
                                >
                                  <EditIcon />
                                </Button>
                              ) : null}
                              <RowMoreMenu
                                items={buildPoListRowMoreItems({
                                  poNumber: p.id,
                                  status: p.status,
                                  showEdit,
                                  showDelete,
                                  showLifecycleActions: showEdit,
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

          <PageGutter className="flex shrink-0 items-center justify-between border-t border-border py-2.5">
              <span className="text-xs text-text-3">
                {statsReady
                  ? `عرض ${rangeStart}–${rangeEnd} من ${filtered.length} نتيجة`
                  : "—"}
              </span>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="h-[30px] w-[30px] p-0"
                  disabled={safePage <= 1}
                  onClick={() => setPage((n) => Math.max(1, n - 1))}
                  aria-label="الصفحة السابقة"
                >
                  ›
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  className="h-[30px] w-[30px] p-0"
                  aria-current="page"
                  disabled
                >
                  {safePage}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="h-[30px] w-[30px] p-0"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((n) => Math.min(totalPages, n + 1))}
                  aria-label="الصفحة التالية"
                >
                  ‹
                </Button>
              </div>
          </PageGutter>
        </OperationalPanel>
      </PageShell>
    </>
  );
}
