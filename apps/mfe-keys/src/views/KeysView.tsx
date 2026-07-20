"use client";

import { useMemo, useState } from "react";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";
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
import { KeyEnvelopeDetailModal } from "../components/KeyEnvelopeDetailModal";
import { RegisterKeyEnvelopeModal } from "../components/RegisterKeyEnvelopeModal";
import { RowMoreMenu } from "../components/ui/RowMoreMenu";
import { removeKeyEnvelope } from "../lib/keys-envelope-api";
import type { KeyEnvelopeRow } from "../lib/keys-envelope-types";
import {
  useInvalidateKeyEnvelopes,
  useKeyEnvelopesQuery,
} from "../query/keys-queries";

const PAGE_SIZE = 10;

type StatusFilter = "" | "reviewer" | "assessor" | "external" | "returned";
type SortKey = "envelope" | "request" | "keys";

function envelopeCode(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
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

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
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
      className="text-text-3"
      aria-hidden
    >
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function KpiKeyIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="8" cy="8" r="5" />
      <path d="M11.5 11.5 21 21M17 17l2-2M14 14l2-2" />
    </svg>
  );
}

function KpiCheckIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

function KpiClockIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function KpiAlertIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

function keysCountLabel(env: KeyEnvelopeRow): string {
  if (env.countMismatch) {
    return `${env.keysCountActual} (مكتوب ${env.keysCountLabeled})`;
  }
  return String(env.keysCountActual);
}

export function KeysView() {
  const { showToast } = useToast();
  const { role } = usePrototype();
  const viewOnly = !isSuperAdmin(role) && role === "general-manager";
  const canEditEnvelope =
    !viewOnly &&
    (isSuperAdmin(role) ||
      role === "government-reviewer" ||
      role === "section-supervisor" ||
      role === "field-inspector" ||
      role === "real-estate-appraiser");
  const canRegisterEnvelope =
    !viewOnly &&
    (isSuperAdmin(role) ||
      role === "government-reviewer" ||
      role === "section-supervisor");

  const envelopesQuery = useKeyEnvelopesQuery();
  const invalidateEnvelopes = useInvalidateKeyEnvelopes();
  const envelopes = envelopesQuery.data ?? [];
  const ready = !envelopesQuery.isPending;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [sortKey, setSortKey] = useState<SortKey>("envelope");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const withReviewer = envelopes.filter((e) => e.status === "reviewer").length;
  const withAssessor = envelopes.filter((e) => e.status === "assessor").length;
  const withFees = envelopes.filter((e) => e.feeGenerated).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = envelopes;
    if (statusFilter) {
      rows = rows.filter((e) => e.status === statusFilter);
    }
    if (q) {
      rows = rows.filter((e) => {
        const code = envelopeCode(e.id).toLowerCase();
        const court = `${e.court} ${e.circuit}`.toLowerCase();
        return (
          code.includes(q) ||
          e.requestNumber.toLowerCase().includes(q) ||
          court.includes(q) ||
          e.id.toLowerCase().includes(q)
        );
      });
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sortKey === "request") {
        return a.requestNumber.localeCompare(b.requestNumber, "ar") * dir;
      }
      if (sortKey === "keys") {
        return (a.keysCountActual - b.keysCountActual) * dir;
      }
      return envelopeCode(a.id).localeCompare(envelopeCode(b.id)) * dir;
    });
  }, [envelopes, search, statusFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );
  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  async function deleteEnvelope(env: KeyEnvelopeRow) {
    const confirmed = window.confirm(
      `هل تريد حذف الظرف ${envelopeCode(env.id)}؟ لا يمكن التراجع عن الحذف.`,
    );
    if (!confirmed) return;

    setDeletingId(env.id);
    const result = await removeKeyEnvelope(env.id);
    setDeletingId(null);
    if (result.ok) {
      if (detailId === env.id) setDetailId(null);
      invalidateEnvelopes();
      showToast("تم حذف الظرف.", "success");
    } else {
      showToast(result.error, "error");
    }
  }

  return (
    <PageShell variant="canvas" className="min-h-0 flex-1 space-y-4">
      <KpiBand>
        <KpiCell
          first
          icon={<KpiKeyIcon />}
          iconClass="bg-info-bg text-info-text"
          label="الظروف المسجّلة"
          value={ready ? envelopes.length : "—"}
          sub="وحدة تتبع المفاتيح"
          dot
        />
        <KpiCell
          icon={<KpiClockIcon />}
          iconClass="bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#b8791a]"
          label="بعهدة المراجع"
          value={ready ? withReviewer : "—"}
          sub="جاهزة للمناولة"
        />
        <KpiCell
          icon={<KpiAlertIcon />}
          iconClass="bg-[color-mix(in_srgb,var(--red)_15%,transparent)] text-red"
          label="أتعاب مولَّدة"
          value={ready ? withFees : "—"}
          valueClass="!text-red"
          sub="سيناريو استلام محكمة"
        />
        <KpiCell
          last
          icon={<KpiCheckIcon />}
          iconClass="bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-success-text"
          label="بعهدة المعاين"
          value={ready ? withAssessor : "—"}
          sub="بعد تأكيد المناولة"
        />
      </KpiBand>

      <PageToolbar className="mb-0 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b-0 bg-transparent px-0 py-0">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
          <OperationalToolbarSearch
            type="search"
            placeholder="رقم الظرف أو رقم الطلب أو المحكمة…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            aria-label="بحث الظروف"
          />
          <OperationalToolbarSelect
            className="shrink-0"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter);
              setPage(1);
            }}
            aria-label="تصفية الحالة"
          >
            <option value="">جميع الحالات</option>
            <option value="reviewer">بعهدة المراجع</option>
            <option value="assessor">بعهدة المعاين</option>
            <option value="external">بعهدة طرف خارجي</option>
            <option value="returned">مُرجع للمحكمة</option>
          </OperationalToolbarSelect>
        </div>
        {canRegisterEnvelope ? (
          <OperationalToolbarPrimaryButton
            onClick={() => setRegisterOpen(true)}
          >
            <PlusIcon />
            تسجيل ظرف
          </OperationalToolbarPrimaryButton>
        ) : null}
      </PageToolbar>

      <OperationalPanel className="shrink-0 overflow-visible">
        <Table pending={!ready}>
          <THead>
            <Tr hoverable={false}>
              <Th>
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-0.5 border-none bg-transparent p-0 font-inherit text-inherit"
                  onClick={() => toggleSort("envelope")}
                >
                  رقم الظرف
                  <SortIcon />
                </button>
              </Th>
              <Th>
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-0.5 border-none bg-transparent p-0 font-inherit text-inherit"
                  onClick={() => toggleSort("request")}
                >
                  رقم الطلب
                  <SortIcon />
                </button>
              </Th>
              <Th>المحكمة / الدائرة</Th>
              <Th className="text-center">
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-0.5 border-none bg-transparent p-0 font-inherit text-inherit"
                  onClick={() => toggleSort("keys")}
                >
                  عدد المفاتيح
                  <SortIcon />
                </button>
              </Th>
              <ThAction aria-label="إجراءات" />
            </Tr>
          </THead>
          <TBody>
            {!ready ? (
              <SkeletonTableRows rows={8} cols={5} />
            ) : filtered.length === 0 ? (
              <Tr hoverable={false}>
                <Td
                  colSpan={5}
                  className="cursor-default py-10 text-center text-[13px] text-text-3"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <InboxIcon />
                    <span>
                      {envelopes.length === 0
                        ? "لا توجد ظروف مسجّلة بعد."
                        : "لا توجد نتائج مطابقة"}
                    </span>
                  </div>
                </Td>
              </Tr>
            ) : (
              pageRows.map((env) => (
                <Tr
                  key={env.id}
                  hoverable={false}
                  className={cn("group", queueTableRowClassName)}
                  onClick={() => setDetailId(env.id)}
                >
                  <Td>
                    <span className="text-[13.5px] font-bold text-primary">
                      {envelopeCode(env.id)}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-[13px] font-semibold text-heading">
                    {env.requestNumber || "—"}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <span className="inline-flex items-center rounded-md border border-border-md bg-surface-2 px-2.5 py-[3px] text-[12px] font-medium text-text-2">
                      {env.court || "—"}
                      {env.circuit ? ` / ${env.circuit}` : ""}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-center text-[14px] font-extrabold text-heading tabular-nums">
                    {keysCountLabel(env)}
                  </Td>
                  <TdAction onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center">
                      <RowMoreMenu
                        items={[
                          {
                            id: "details",
                            label: "تفاصيل الظرف",
                            onClick: () => setDetailId(env.id),
                          },
                          ...(canRegisterEnvelope
                            ? [
                                {
                                  id: "delete",
                                  label:
                                    deletingId === env.id
                                      ? "جاري الحذف…"
                                      : "حذف الظرف",
                                  disabled: deletingId !== null,
                                  danger: true,
                                  onClick: () => void deleteEnvelope(env),
                                },
                              ]
                            : []),
                        ]}
                      />
                    </div>
                  </TdAction>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </OperationalPanel>

      <PageGutter className="flex shrink-0 items-center justify-between bg-transparent px-0 py-3">
        <span className="text-[13px] text-text-3">
          {ready ? (
            <>
              عرض{" "}
              <b className="font-bold text-heading">
                {rangeStart}–{rangeEnd}
              </b>{" "}
              من <b className="font-bold text-heading">{filtered.length}</b>{" "}
              نتيجة
            </>
          ) : (
            "—"
          )}
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

      <RegisterKeyEnvelopeModal
        open={registerOpen}
        busy={false}
        onClose={() => setRegisterOpen(false)}
        onRegistered={() => invalidateEnvelopes()}
      />
      <KeyEnvelopeDetailModal
        envelopeId={detailId}
        canEdit={canEditEnvelope}
        onClose={() => setDetailId(null)}
        onChanged={() => invalidateEnvelopes()}
      />
    </PageShell>
  );
}
