"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  SkeletonTableRows,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  cn,
} from "@platform/design-system";
import {
  inspectorFeeStatusLabel,
  inspectorFeeStatusTone,
  inspectorFeeWorkStatusTone,
  type InspectorFeeRowDto,
} from "@platform/api-client";
import { formatFeeDate, sortInspectorFeeRowsNewestFirst } from "./party-fee-meta";
import { PartyPickerModal } from "./PartyPickerModal";
import { FeeAuditModal } from "./FeeAuditModal";
import type { PartyFeeGroup } from "./party-fee-meta";

type BrowseFilter = "all" | "progress" | "ready" | "disbursed" | "returned";

const PAGE_SIZE = 8;

const FILTER_LABELS: Record<BrowseFilter, string> = {
  all: "الكل",
  progress: "قيد التنفيذ",
  ready: "جاهز للصرف",
  disbursed: "مصروفة",
  returned: "مُعاد/استفسار",
};

function matchesFilter(row: InspectorFeeRowDto, filter: BrowseFilter): boolean {
  switch (filter) {
    case "progress":
      return row.workStatus === "in_progress";
    case "ready":
      return (
        row.workStatus === "done" &&
        (row.billingStatus === "at-finance" || row.billingStatus === "disb-req")
      );
    case "disbursed":
      return row.billingStatus === "disbursed";
    case "returned":
      return row.billingStatus === "returned" || row.billingStatus === "inquiry";
    default:
      return true;
  }
}

function documentCell(
  row: InspectorFeeRowDto,
  onAudit: (row: InspectorFeeRowDto) => void,
) {
  if (row.billingStatus === "disbursed" && row.disbursementVoucher) {
    return (
      <button
        type="button"
        className="text-[11px] text-primary underline-offset-2 hover:underline"
        onClick={() => onAudit(row)}
      >
        {row.disbursementVoucher}
      </button>
    );
  }
  if (
    (row.billingStatus === "returned" || row.billingStatus === "inquiry") &&
    row.lastTransitionReason
  ) {
    return (
      <button
        type="button"
        className="text-[11px] text-danger underline-offset-2 hover:underline"
        onClick={() => onAudit(row)}
      >
        السبب
      </button>
    );
  }
  if (row.billingStatus !== "draft") {
    return (
      <button
        type="button"
        className="text-[11px] text-text-3 underline-offset-2 hover:underline"
        onClick={() => onAudit(row)}
      >
        السجل
      </button>
    );
  }
  return "—";
}

export function PartyPropertyBrowse({
  rows,
  partyName,
  partyCategory,
  showPartyPicker = false,
  parties = [],
  selectedAssigneeId,
  onSelectParty,
  pending = false,
  /** واجهة المالية: مصطلحات + تنسيق أقرب لشاشة الصرف */
  variant = "default",
}: {
  rows: InspectorFeeRowDto[];
  partyName: string;
  partyCategory?: string;
  showPartyPicker?: boolean;
  parties?: PartyFeeGroup[];
  selectedAssigneeId?: string;
  onSelectParty?: (assigneeId: string) => void;
  pending?: boolean;
  variant?: "default" | "finance";
}) {
  const finance = variant === "finance";
  const [filter, setFilter] = useState<BrowseFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [auditRow, setAuditRow] = useState<InspectorFeeRowDto | null>(null);

  const counts = useMemo(
    () => ({
      all: rows.length,
      progress: rows.filter((r) => matchesFilter(r, "progress")).length,
      ready: rows.filter((r) => matchesFilter(r, "ready")).length,
      disbursed: rows.filter((r) => matchesFilter(r, "disbursed")).length,
      returned: rows.filter((r) => matchesFilter(r, "returned")).length,
    }),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortInspectorFeeRowsNewestFirst(
      rows.filter((row) => {
        if (!matchesFilter(row, filter)) return false;
        if (!q) return true;
        return (
          row.propertyLabel.toLowerCase().includes(q) ||
          row.poNumber.toLowerCase().includes(q)
        );
      }),
    );
  }, [filter, rows, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const slice = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );
  const from = filtered.length ? safePage * PAGE_SIZE + 1 : 0;
  const to = Math.min(filtered.length, (safePage + 1) * PAGE_SIZE);

  const pillBase =
    "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors";
  const pillOn = "border-ink bg-ink text-white";
  const pillOff =
    "border-border-md bg-surface text-text-2 hover:border-gold hover:text-heading";

  return (
    <div className="flex flex-col gap-3">
      {showPartyPicker && parties.length > 0 && onSelectParty ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-text-2">
            {finance ? "المستحق:" : "الجهة:"}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn(
              "min-w-[240px] justify-between",
              finance && "rounded-lg border-border-md",
            )}
            onClick={() => setPickerOpen(true)}
          >
            <span>
              {partyName}
              {partyCategory ? (
                <span className="text-text-3"> · {partyCategory}</span>
              ) : null}
            </span>
            <span>▾</span>
          </Button>
          <PartyPickerModal
            open={pickerOpen}
            parties={parties}
            selectedAssigneeId={selectedAssigneeId ?? ""}
            onClose={() => setPickerOpen(false)}
            onSelect={(id) => {
              onSelectParty(id);
              setFilter("all");
              setSearch("");
              setPage(0);
            }}
            title={finance ? "اختيار المستحق" : "اختيار الجهة"}
            searchPlaceholder={
              finance ? "ابحث باسم المستحق…" : "ابحث باسم الجهة..."
            }
          />
        </div>
      ) : null}

      <div
        className={cn(
          "flex flex-wrap gap-2 max-lg:-mx-1 max-lg:overflow-x-auto max-lg:px-1 max-lg:pb-1 max-lg:[-webkit-overflow-scrolling:touch]",
          finance && "gap-1.5",
        )}
      >
        {(Object.keys(FILTER_LABELS) as BrowseFilter[]).map((key) =>
          finance ? (
            <button
              key={key}
              type="button"
              className={cn(pillBase, filter === key ? pillOn : pillOff)}
              onClick={() => {
                setFilter(key);
                setPage(0);
              }}
            >
              {FILTER_LABELS[key]}
              <span
                className={cn(
                  "tabular-nums",
                  filter === key ? "text-white/80" : "opacity-60",
                )}
              >
                {counts[key]}
              </span>
            </button>
          ) : (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={filter === key ? "primary" : "outline"}
              className="max-lg:min-h-11 max-lg:shrink-0"
              onClick={() => {
                setFilter(key);
                setPage(0);
              }}
            >
              {FILTER_LABELS[key]}{" "}
              <span className="opacity-60">{counts[key]}</span>
            </Button>
          ),
        )}
      </div>

      <Input
        className={cn(
          "max-w-sm text-sm max-lg:max-w-none max-lg:min-h-11",
          finance && "max-w-md rounded-lg border-border-md",
        )}
        placeholder={
          finance
            ? "بحث بالمرجع أو أمر العمل…"
            : "بحث بالعقار أو أمر العمل..."
        }
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(0);
        }}
      />

      <div
        className={cn(
          "hidden lg:block",
          finance && "overflow-hidden rounded-xl border border-border bg-surface shadow-card",
        )}
      >
        <Table pending={pending}>
          <THead>
            <Tr hoverable={false}>
              <Th className={finance ? "text-start" : undefined}>
                {finance ? "المرجع" : "العقار"}
              </Th>
              <Th className={finance ? "text-center" : undefined}>أمر العمل</Th>
              <Th className={cn("text-end", finance && "text-center")}>
                الصافي
              </Th>
              <Th className={finance ? "text-center" : undefined}>حالة العمل</Th>
              <Th className={finance ? "text-center" : undefined}>حالة الدفع</Th>
              <Th className={finance ? "text-center" : undefined}>المستند</Th>
              <Th className={finance ? "text-center" : undefined}>التاريخ</Th>
            </Tr>
          </THead>
          <TBody>
            {pending && slice.length === 0 ? (
              <SkeletonTableRows rows={5} cols={7} />
            ) : slice.length === 0 ? (
              <Tr hoverable={false}>
                <Td colSpan={7}>
                  <EmptyState line="لا نتائج." />
                </Td>
              </Tr>
            ) : (
              slice.map((row) => (
                <Tr key={row.workflowTaskId} hoverable={false}>
                  <Td className="font-medium text-start">{row.propertyLabel}</Td>
                  <Td
                    className={cn(
                      finance
                        ? "text-center font-bold text-gold-d"
                        : "text-primary-light",
                    )}
                    dir="ltr"
                  >
                    {row.poNumber}
                  </Td>
                  <Td
                    className={cn(
                      "tabular-nums",
                      finance ? "text-center font-extrabold" : "text-end",
                    )}
                    dir="ltr"
                  >
                    {row.netFeeSar.toLocaleString("en-US")} ر.س
                  </Td>
                  <Td className={finance ? "text-center" : undefined}>
                    <Badge tone={inspectorFeeWorkStatusTone(row.workStatus)}>
                      {row.workStatusLabel}
                    </Badge>
                  </Td>
                  <Td className={finance ? "text-center" : undefined}>
                    <Badge tone={inspectorFeeStatusTone(row.billingStatus)}>
                      {row.billingStatusLabel ||
                        inspectorFeeStatusLabel(row.billingStatus)}
                    </Badge>
                  </Td>
                  <Td className={finance ? "text-center" : undefined}>
                    {documentCell(row, setAuditRow)}
                  </Td>
                  <Td
                    className={cn("text-text-2", finance && "text-center")}
                    dir="ltr"
                  >
                    {formatFeeDate(row.workSubmittedAtUtc ?? row.updatedAtUtc)}
                  </Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </div>

      <div className="lg:hidden">
        {pending && slice.length === 0 ? (
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-[108px] animate-pulse rounded-[12px] bg-surface-2"
              />
            ))}
          </div>
        ) : slice.length === 0 ? (
          <EmptyState line="لا نتائج." />
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {slice.map((row) => (
              <li
                key={`m-${row.workflowTaskId}`}
                className={cn(
                  "rounded-[12px] border border-border bg-surface px-3.5 py-3 shadow-card",
                  finance && "rounded-xl",
                )}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[14px] font-bold text-heading">
                      {row.propertyLabel}
                    </div>
                    <div
                      className={cn(
                        "mt-0.5 text-[12.5px] font-semibold",
                        finance ? "text-gold-d" : "text-primary-light",
                      )}
                      dir="ltr"
                    >
                      {row.poNumber}
                    </div>
                  </div>
                  <div
                    className="shrink-0 text-end text-[13px] font-extrabold tabular-nums text-heading"
                    dir="ltr"
                  >
                    {row.netFeeSar.toLocaleString("en-US")} ر.س
                  </div>
                </div>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <Badge tone={inspectorFeeWorkStatusTone(row.workStatus)}>
                    {row.workStatusLabel}
                  </Badge>
                  <Badge tone={inspectorFeeStatusTone(row.billingStatus)}>
                    {row.billingStatusLabel ||
                      inspectorFeeStatusLabel(row.billingStatus)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="text-text-3" dir="ltr">
                    {formatFeeDate(row.workSubmittedAtUtc ?? row.updatedAtUtc)}
                  </span>
                  <span>{documentCell(row, setAuditRow)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 text-xs text-text-2",
        )}
      >
        <span dir="ltr">
          عرض {from}–{to} من {filtered.length}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={safePage <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            السابق
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={safePage >= pages - 1}
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
          >
            التالي
          </Button>
        </div>
      </div>
      <FeeAuditModal
        open={auditRow !== null}
        row={auditRow}
        onClose={() => setAuditRow(null)}
      />
    </div>
  );
}
