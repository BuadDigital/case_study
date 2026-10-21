"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppModal, Button, cn, Note, useToast } from "@platform/ui-kit";
import { RegField, RegTextarea } from "@platform/app-shared/registration/FormFields";
import {
  mergeTransactions,
  searchTransactionDeeds,
  type TransactionDeedSearchHitDto,
  type TransactionDetailDto,
  type TransactionLinkKind,
} from "@platform/api-client";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { notifyWorkOrdersChanged, workOrdersApiConfig } from "../../lib/work-orders-api-config";
import { formatPoDisplay } from "../../lib/app-data/po-intake-data";
import { transactionDeedLabel } from "./TransactionDeedSwitcher";

const LINK_KINDS: { value: TransactionLinkKind; label: string; hint: string }[] = [
  { value: "one_building", label: "مبنى واحد على عدة صكوك", hint: "قيمة واحدة للمبنى كله" },
  { value: "contract", label: "أعيان مرتبطة بعقد", hint: "قيمة لكل عين ثم المجموع" },
];

const kindPill = (selected: boolean) =>
  cn(
    "flex cursor-pointer flex-col items-start gap-0.5 rounded-[var(--radius-DEFAULT)] border-2 px-3 py-2 text-start font-[inherit] transition-all",
    selected
      ? "border-primary bg-primary text-white"
      : "border-border bg-surface text-text-2 hover:border-primary-light hover:text-primary",
  );

/** Refreshes everything that shows the transaction after a merge / unmerge. */
export function invalidateTransactionViews(
  queryClient: ReturnType<typeof useQueryClient>,
  poNumbers: string[],
) {
  void queryClient.invalidateQueries({ queryKey: [...appDataKeys.all, "transaction"] });
  void queryClient.invalidateQueries({ queryKey: [...appDataKeys.all, "transaction-timeline"] });
  void queryClient.invalidateQueries({ queryKey: appDataKeys.poRecords() });
  void queryClient.invalidateQueries({ queryKey: appDataKeys.workOrderDtos() });
  for (const po of poNumbers) {
    void queryClient.invalidateQueries({ queryKey: appDataKeys.poRecord(po) });
  }
  notifyWorkOrdersChanged();
}

/**
 * Decision 2026-10-19: after the inspections, the case-study specialist joins other deeds'
 * transactions into this one — by deed, registry or PO number, with the link kind and a reason.
 * The server refuses deeds that are not ready and says why on each hit.
 */
export function TransactionMergeDialog({
  open,
  transaction,
  onClose,
  onMerged,
}: {
  open: boolean;
  transaction: TransactionDetailDto;
  onClose: () => void;
  onMerged: (next: TransactionDetailDto) => void;
}) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<TransactionDeedSearchHitDto[]>([]);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<Map<string, TransactionDeedSearchHitDto>>(new Map());
  const [linkKind, setLinkKind] = useState<TransactionLinkKind | "">(
    (transaction.linkKind as TransactionLinkKind | null | undefined) ?? "",
  );
  const [reason, setReason] = useState("");
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const picked = useMemo(() => [...selected.values()], [selected]);
  const incomingDeeds = picked.reduce((n, h) => n + Math.max(1, h.transactionDeedCount), 0);
  const canMerge = picked.length > 0 && Boolean(linkKind) && reason.trim().length >= 5 && !merging;

  if (!open) return null;

  async function search() {
    const config = workOrdersApiConfig();
    const q = query.trim();
    if (!config || q.length < 3) {
      setError("أدخل ثلاثة أحرف على الأقل من رقم الصك أو السجل أو أمر العمل");
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const res = await searchTransactionDeeds(config, transaction.id, q);
      setSearched(true);
      if (!res.ok) {
        setHits([]);
        setError(res.message ?? "تعذّر البحث عن الصكوك");
        return;
      }
      setHits(res.data);
    } finally {
      setSearching(false);
    }
  }

  function toggle(hit: TransactionDeedSearchHitDto) {
    if (hit.blockedReasonAr) return;
    setSelected((prev) => {
      const next = new Map(prev);
      // One pick per transaction is enough: a deed brings its whole transaction.
      const sameTransaction = [...next.values()].find((h) => h.transactionId === hit.transactionId);
      if (next.has(hit.propertyId)) next.delete(hit.propertyId);
      else if (sameTransaction) {
        next.delete(sameTransaction.propertyId);
        next.set(hit.propertyId, hit);
      } else next.set(hit.propertyId, hit);
      return next;
    });
  }

  async function merge() {
    const config = workOrdersApiConfig();
    if (!config || !canMerge || !linkKind) return;
    setMerging(true);
    setError(null);
    try {
      const res = await mergeTransactions(config, transaction.id, {
        propertyIds: picked.map((h) => h.propertyId),
        linkKind,
        reason: reason.trim(),
      });
      if (!res.ok) {
        const message = res.message ?? "تعذّر دمج المعاملات";
        setError(message);
        showToast(message, "error");
        return;
      }
      invalidateTransactionViews(queryClient, [
        ...transaction.deeds.map((d) => d.poNumber),
        ...picked.map((h) => h.poNumber),
      ]);
      showToast(`ضُمّت ${incomingDeeds} صكوك إلى المعاملة ${transaction.displayNumber}`, "success");
      onMerged(res.data);
      onClose();
    } finally {
      setMerging(false);
    }
  }

  return (
    <AppModal
      open
      wide
      title="دمج معاملات مرتبطة"
      subtitle={`المعاملة الجامعة ${transaction.displayNumber} — تبقى برقمها وتُضم إليها صكوك المعاملات المختارة`}
      onClose={() => {
        if (!merging) onClose();
      }}
      footer={
        <>
          <Button type="button" variant="default" onClick={onClose} disabled={merging}>
            إلغاء
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={merging}
            disabled={!canMerge}
            showActionToast={false}
            onClick={() => void merge()}
          >
            دمج {picked.length > 0 ? `(${incomingDeeds} صكوك)` : ""}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Note tone="info">
          يُدمج الصك متى اكتمل تسجيله: أمر العمل والبيانات الأولية واستعلام البورصة. المعاينة
          والدراسة ليستا شرطًا. اختيار صك يضم معاملته كاملة بكل صكوكها. المعاملات
          المضمومة تُقفل بحالة «مدمجة في {transaction.displayNumber}».
        </Note>

        <div className="rounded-[var(--radius-DEFAULT)] border border-border bg-surface-2 px-3 py-2.5 text-[12px]">
          <div className="mb-1 text-[11px] text-text-3">صكوك المعاملة الحالية ({transaction.deeds.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {transaction.deeds.map((deed) => (
              <span
                key={deed.propertyId}
                className="rounded border border-border bg-surface px-2 py-0.5 font-semibold tabular-nums text-heading"
              >
                <bdi dir="ltr">{transactionDeedLabel(deed)}</bdi>
                <span className="ms-1 text-[10.5px] font-normal text-text-3">{formatPoDisplay(deed.poNumber)}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1">
            <RegField
              id="transaction-merge-search"
              label="رقم الصك أو السجل العيني أو أمر العمل"
              value={query}
              dir="ltr"
              onChange={(value) => {
                setQuery(value);
                setSearched(false);
                setError(null);
              }}
            />
          </div>
          <Button type="button" variant="default" disabled={searching || query.trim().length < 3} onClick={() => void search()}>
            {searching ? "جارٍ البحث…" : "بحث"}
          </Button>
        </div>

        {searched && hits.length === 0 ? (
          <p className="m-0 text-[12px] text-text-3">لا صكوك بهذا الرقم.</p>
        ) : null}
        {hits.length > 0 ? (
          <ul className="m-0 flex max-h-[260px] list-none flex-col gap-1.5 overflow-y-auto p-0">
            {hits.map((hit) => {
              const blocked = Boolean(hit.blockedReasonAr);
              const checked = selected.has(hit.propertyId);
              return (
                <li key={hit.propertyId} className="m-0">
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-DEFAULT)] border px-3 py-2 text-[12px]",
                      blocked
                        ? "cursor-not-allowed border-border bg-surface-2 opacity-70"
                        : checked
                          ? "border-primary bg-info-bg"
                          : "border-border bg-surface hover:border-primary-light",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={checked}
                      disabled={blocked}
                      onChange={() => toggle(hit)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <bdi dir="ltr" className="font-bold tabular-nums text-heading">
                          {transactionDeedLabel(hit)}
                        </bdi>
                        <span className="text-[11px] text-text-3">{formatPoDisplay(hit.poNumber)}</span>
                        <span className="text-[11px] text-text-3">
                          <bdi dir="ltr">{hit.transactionNumber}</bdi>
                          {hit.transactionDeedCount > 1 ? ` · ${hit.transactionDeedCount} صكوك` : ""}
                        </span>
                      </span>
                      <span className="block text-[11px] text-text-2">
                        {[hit.ownerName, hit.city, hit.district].filter(Boolean).join(" · ") || "—"}
                      </span>
                      {hit.blockedReasonAr ? (
                        <span className="block text-[11px] font-semibold text-danger">{hit.blockedReasonAr}</span>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : null}

        <div>
          <div className="mb-1.5 text-[11px] font-medium text-text-2">نوع الارتباط</div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {LINK_KINDS.map((kind) => (
              <button
                key={kind.value}
                type="button"
                className={kindPill(linkKind === kind.value)}
                onClick={() => setLinkKind(kind.value)}
              >
                <span className="text-[12.5px] font-semibold">{kind.label}</span>
                <span className={cn("text-[11px]", linkKind === kind.value ? "text-white/80" : "text-text-3")}>
                  {kind.hint}
                </span>
              </button>
            ))}
          </div>
        </div>

        <RegTextarea
          id="transaction-merge-reason"
          label="مبرر الدمج"
          required
          rows={2}
          value={reason}
          onChange={setReason}
          placeholder="مثال: المبنى يمتد على الصكين وفق قرار مركز الإسناد"
        />

        {error ? <Note tone="warn">{error}</Note> : null}
      </div>
    </AppModal>
  );
}
