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
}: {
  rows: InspectorFeeRowDto[];
  partyName: string;
  partyCategory?: string;
  showPartyPicker?: boolean;
  parties?: PartyFeeGroup[];
  selectedAssigneeId?: string;
  onSelectParty?: (assigneeId: string) => void;
  pending?: boolean;
}) {
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

  return (
    <div className="flex flex-col gap-3">
      {showPartyPicker && parties.length > 0 && onSelectParty ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-text-2">الطرف:</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-w-[240px] justify-between"
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
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(Object.keys(FILTER_LABELS) as BrowseFilter[]).map((key) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={filter === key ? "primary" : "outline"}
            onClick={() => {
              setFilter(key);
              setPage(0);
            }}
          >
            {FILTER_LABELS[key]}{" "}
            <span className="opacity-60">{counts[key]}</span>
          </Button>
        ))}
      </div>

      <Input
        className="max-w-sm text-sm"
        placeholder="بحث بالعقار أو أمر العمل..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(0);
        }}
      />

      <Table pending={pending}>
        <THead>
          <Tr hoverable={false}>
            <Th>العقار</Th>
            <Th>أمر العمل</Th>
            <Th className="text-end">الصافي</Th>
            <Th>حالة العمل</Th>
            <Th>حالة الدفع</Th>
            <Th>المستند</Th>
            <Th>التاريخ</Th>
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
                <Td className="font-medium">{row.propertyLabel}</Td>
                <Td className="text-primary-light">{row.poNumber}</Td>
                <Td className="text-end tabular-nums">
                  {row.netFeeSar.toLocaleString("ar-SA")} ر.س
                </Td>
                <Td>
                  <Badge tone={inspectorFeeWorkStatusTone(row.workStatus)}>
                    {row.workStatusLabel}
                  </Badge>
                </Td>
                <Td>
                  <Badge tone={inspectorFeeStatusTone(row.billingStatus)}>
                    {row.billingStatusLabel ||
                      inspectorFeeStatusLabel(row.billingStatus)}
                  </Badge>
                </Td>
                <Td>{documentCell(row, setAuditRow)}</Td>
                <Td className="text-text-2">
                  {formatFeeDate(row.workSubmittedAtUtc ?? row.updatedAtUtc)}
                </Td>
              </Tr>
            ))
          )}
        </TBody>
      </Table>

      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 text-xs text-text-2",
        )}
      >
        <span>
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
