"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { PoRow } from "@platform/app-shared/prototype/constants";
import {
  isPoListStatusTerminal,
  PO_LIST_STATUS_OPTIONS,
  poListStatusMeta,
  poProgressPct,
  type PoListStatus,
} from "@platform/app-shared/prototype/po-list-status";
import {
  Button,
  KpiBand,
  KpiCell,
  OperationalPanel,
  OperationalToolbarPrimaryButton,
  OperationalToolbarSearch,
  OperationalToolbarSelect,
  PageGutter,
  PageShell,
  PageToolbar,
  SkeletonTableRows,
  StatusPill,
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
  useWorkflowTasksQuery,
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

const TEAM_COLORS = ["#12284C", "#a4906f", "#22406e", "#8c7857", "#3f8f5f"];
const PO_TOOLTIP_GAP = 8;
const PO_TOOLTIP_VIEWPORT_MARGIN = 8;

function computeHoverCardStyle(
  trigger: HTMLElement,
  card: HTMLElement,
  align: "start" | "end" = "start",
): CSSProperties {
  const rect = trigger.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardWidth = card.offsetWidth;
  const cardHeight = card.offsetHeight;

  let left = align === "end" ? rect.right - cardWidth : rect.left;
  left = Math.max(
    PO_TOOLTIP_VIEWPORT_MARGIN,
    Math.min(left, vw - cardWidth - PO_TOOLTIP_VIEWPORT_MARGIN),
  );

  let top = rect.bottom + PO_TOOLTIP_GAP;
  if (top + cardHeight > vh - PO_TOOLTIP_VIEWPORT_MARGIN) {
    const above = rect.top - cardHeight - PO_TOOLTIP_GAP;
    if (above >= PO_TOOLTIP_VIEWPORT_MARGIN) top = above;
  }

  return {
    position: "fixed",
    top,
    left,
    zIndex: 1200,
  };
}

function HoverPortalCard({
  children,
  content,
  align = "start",
  panelClassName,
  triggerClassName,
}: {
  children: ReactNode;
  content: ReactNode;
  align?: "start" | "end";
  panelClassName: string;
  triggerClassName?: string;
}) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [cardStyle, setCardStyle] = useState<CSSProperties>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !cardRef.current) return;

    let raf = 0;
    const placeCard = () => {
      if (!triggerRef.current || !cardRef.current) return;
      setCardStyle(
        computeHoverCardStyle(triggerRef.current, cardRef.current, align),
      );
    };

    placeCard();
    raf = requestAnimationFrame(placeCard);
    window.addEventListener("resize", placeCard);
    window.addEventListener("scroll", placeCard, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", placeCard);
      window.removeEventListener("scroll", placeCard, true);
    };
  }, [align, content, open]);

  const card = open ? (
    <div
      ref={cardRef}
      className={panelClassName}
      style={cardStyle}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {content}
    </div>
  ) : null;

  return (
    <>
      <span
        ref={triggerRef}
        className={cn("inline-block w-fit", triggerClassName)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {children}
      </span>
      {mounted && card ? createPortal(card, document.body) : null}
    </>
  );
}

function teamInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0) : "?";
}

function TeamStack({ members }: { members: string[] }) {
  if (members.length === 0) {
    return <span className="font-normal text-text-3">—</span>;
  }
  const shown = members.slice(0, 3);
  const extra = members.length - shown.length;
  return (
    <HoverPortalCard
      align="end"
      panelClassName="min-w-[190px] rounded-[10px] border border-border-md bg-surface p-2 shadow-[0_8px_24px_-8px_rgba(18,40,76,.28)]"
      content={
        <>
          <div className="px-2 pb-1.5 pt-0.5 text-[11px] font-bold text-text-3">
            فريق المعاملة ({members.length})
          </div>
          {members.map((name, i) => (
            <div
              key={`pop-${name}-${i}`}
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5"
            >
              <span
                className="grid size-[26px] shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                style={{ backgroundColor: TEAM_COLORS[i % TEAM_COLORS.length] }}
              >
                {teamInitial(name)}
              </span>
              <span className="whitespace-nowrap text-[13px] font-semibold text-heading">
                {name}
              </span>
            </div>
          ))}
        </>
      }
    >
      <span className="inline-flex w-fit items-center">
      {shown.map((name, i) => (
        <span
          key={`${name}-${i}`}
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full border-2 border-surface text-[11px] font-bold text-white",
            i > 0 && "-ms-2",
          )}
          style={{ backgroundColor: TEAM_COLORS[i % TEAM_COLORS.length] }}
          title={name}
        >
          {teamInitial(name)}
        </span>
      ))}
      {extra > 0 ? (
        <span className="-ms-2 grid size-7 shrink-0 place-items-center rounded-full border-2 border-surface bg-surface-2 text-[11px] font-bold text-heading">
          +{extra}
        </span>
      ) : null}
      </span>
    </HoverPortalCard>
  );
}

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

function isDueWithin48(iso: string): boolean {
  if (!iso) return false;
  const due = new Date(iso.slice(0, 10)).getTime();
  const now = Date.now();
  return due >= now && due <= now + 2 * 24 * 60 * 60 * 1000;
}

/** خلفية شريط التقدم — أخضر عند ≥60٪، ذهبي عند وجود تقدم، شفاف عند الصفر. */
function progFill(pct: number): string {
  if (pct >= 60) return "linear-gradient(90deg, var(--ink), var(--navy-3))";
  if (pct > 0) return "linear-gradient(90deg, var(--gold-d), var(--gold))";
  return "transparent";
}

function poStatusStyle(status: PoRow["status"]): {
  base: string;
  fg: string;
  live: boolean;
} {
  switch (status) {
    case "under_study":
      return { base: "var(--gold)", fg: "var(--gold-d)", live: true };
    case "completed":
    case "fully_billed":
      return { base: "#3f8f5f", fg: "#2f7a4d", live: false };
    case "partially_billed":
      return { base: "#d9a441", fg: "#b8791a", live: false };
    case "stopped":
      return { base: "#8a8d96", fg: "#696c75", live: false };
    case "cancelled":
      return { base: "var(--red)", fg: "var(--red-text)", live: false };
    default:
      return { base: "var(--heading)", fg: "var(--heading)", live: false };
  }
}

function PoStatusPill({ status }: { status: PoRow["status"] }) {
  const { label } = poListStatusMeta(status);
  return <StatusPill label={label} style={poStatusStyle(status)} />;
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
  const { data: workflowTasks } = useWorkflowTasksQuery();
  const list = useMemo(() => rows ?? [], [rows]);
  const teamByPo = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const task of workflowTasks ?? []) {
      const po = task.poNumber?.trim();
      const name = task.assigneeName?.trim();
      if (!po || !name || name === "—" || name === "-") continue;
      const current = map.get(po) ?? [];
      if (!current.includes(name)) current.push(name);
      map.set(po, current);
    }
    return map;
  }, [workflowTasks]);
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

  const kpi = useMemo(() => {
    if (!statsReady) return undefined;
    const active = list.filter((p) => !isPoListStatusTerminal(p.status));
    const overdue = active.filter(
      (p) => p.dueDate && isPastDue(p.dueDate),
    ).length;
    const dueSoon = active.filter(
      (p) => p.dueDate && isDueWithin48(p.dueDate),
    ).length;
    const doneProps = list.reduce((n, p) => n + (p.done ?? 0), 0);
    return { active: active.length, overdue, dueSoon, doneProps };
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

      <PageShell variant="canvas" className="gap-3 py-4 sm:py-5">
        <KpiBand className="mb-0 shrink-0">
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

        <PageToolbar className="mb-0 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b-0 bg-transparent px-0 py-0">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
            <OperationalToolbarSearch
              type="search"
              placeholder="PO أو رقم الصك أو نوع الإسناد…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="بحث أوامر العمل"
              endAdornment={
                search.trim() && searchModeLabel ? (
                  <span className="pointer-events-none absolute inset-inline-end-2.5 top-1/2 -translate-y-1/2 rounded-full bg-info-bg px-2 py-0.5 text-[10px] font-medium text-info-text">
                    {searchModeLabel}
                  </span>
                ) : null
              }
            />
            <OperationalToolbarSelect
              className="!w-auto min-w-[148px] max-w-full shrink-0 sm:w-[148px]"
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
              className="!w-auto min-w-[168px] max-w-full shrink-0 sm:w-[168px]"
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

        <OperationalPanel className="shrink-0 overflow-visible">
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
                  ) : filtered.length === 0 ? (
                    <Tr hoverable={false}>
                      <Td
                        colSpan={11}
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
                      const projectTip = p.project?.trim() || "";
                      const teamMembers = (() => {
                        const fromTasks = teamByPo.get(p.id) ?? [];
                        if (fromTasks.length > 0) return fromTasks;
                        const specialist =
                          p.specialist?.trim() && p.specialist !== "—"
                            ? [p.specialist.trim()]
                            : [];
                        return specialist;
                      })();

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
                          <Td className="whitespace-nowrap text-[13px] text-text-2">
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
                              "whitespace-nowrap text-[13px] font-semibold",
                              urgent ? "text-red" : "text-heading",
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
                          {filtered.length}
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
                  onClick={() => setPage((n) => Math.max(1, n - 1))}
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
                  onClick={() => setPage((n) => Math.min(totalPages, n + 1))}
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
