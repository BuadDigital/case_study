"use client";

import { memo, useEffect, useRef, useState } from "react";
import type { ValuationComparableSelectionDto } from "@platform/api-client";
import { createComparableProperty } from "@platform/api-client";
import { useCommandMutation } from "@platform/app-shared";
import { UnsavedChangesDialog } from "@platform/app-shared/registration/UnsavedChangesDialog";
import { ComparablePropertyEntryFields } from "../ComparablePropertyEntryFieldsSlot";
import {
  comparableDraftToUpsert,
  emptyComparableEntryDraft,
  firstComparableEntryError,
  firstComparableEntryErrorTarget,
  parseComparableCoords,
  validateComparableEntry,
  type ComparableEntryDraft,
  type ComparableEntryFieldErrors,
} from "@platform/app-shared/app-data/comparable-entry";
import { scheduleScrollToFormField } from "@platform/app-shared/form-ux";
import {
  AppModal,
  Button,
  cn,
  Table,
  TableEmptyRow,
  TBody,
  Td,
  TdLtr,
  Th,
  THead,
  Tr,
  useToast,
} from "@platform/ui-kit";
import { Card } from "./atoms";
import {
  areaRatio,
  areaRatioValue,
  NEARBY_RADIUS_KM,
  sourceCardLine,
  type BankDisplayRow,
} from "./lib/bank-ranking";
import { apiConfig, fmt } from "./lib/shell-utils";

export type ComparablesBankRow = BankDisplayRow;

/**
 * Nearby bank table — search and price/area drafts stay local so typing does
 * not re-render the valuation shell. «اضافة مقارن» writes to the shared bank.
 */
export type ComparableBankSeed = {
  type?: string;
  city?: string;
  district?: string;
  latitude?: string;
  longitude?: string;
};

export const ComparablesBankTable = memo(function ComparablesBankTable({
  rows,
  subjectSqm,
  distanceKm,
  onAdopt,
  onSearch,
  onSaveOverride,
  seed,
  sourceWorkOrderNumber,
  sourcePropertyId,
  onCreated,
}: {
  rows: ComparablesBankRow[];
  subjectSqm: number | null;
  distanceKm: Record<string, number>;
  /** Resolves once the save (and the reload it triggers) settles — the checkbox reverts to
   * `rows` truth then. Adopting a comparable for the first time has no server round trip to
   * flip early on, so the checkbox owns its own optimistic draft meanwhile (rerender-defer-reads). */
  onAdopt: (comparableId: string, adopted: boolean) => Promise<void>;
  /** Market context only — when absent, show a vacant-land badge instead of the search field. */
  onSearch?: (q: string) => void;
  /** Returns true on successful save — the cell draft is cleared then. */
  onSaveOverride: (
    item: ValuationComparableSelectionDto,
    field: "price" | "area",
    raw: string,
  ) => Promise<boolean>;
  seed?: ComparableBankSeed;
  sourceWorkOrderNumber?: string;
  sourcePropertyId?: string;
  onCreated?: () => void;
}) {
  const { showToast } = useToast();
  const [q, setQ] = useState("");
  // Optimistic checkbox draft, keyed by comparable id — cleared once onAdopt settles and
  // `rows` (server truth) catches up. Only a brand-new adoption lacks an earlier optimistic
  // flip upstream, so without this the checkbox visibly waits on the full save + reload.
  const [pendingAdopt, setPendingAdopt] = useState<Map<string, boolean>>(new Map());
  const [formOpen, setFormOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [draft, setDraft] = useState<ComparableEntryDraft>(() =>
    emptyComparableEntryDraft(),
  );
  const [fieldErrors, setFieldErrors] = useState<ComparableEntryFieldErrors>(
    {},
  );
  const initialDraftRef = useRef<ComparableEntryDraft | null>(null);
  const { run: runCreate, loading: saving } = useCommandMutation(
    async (next: ComparableEntryDraft) => {
      const config = apiConfig();
      if (!config) throw new Error("يلزم تسجيل الدخول");
      const res = await createComparableProperty(
        config,
        comparableDraftToUpsert(next, {
          intakeChannel: "office",
          sourceWorkOrderNumber: sourceWorkOrderNumber ?? null,
          sourcePropertyId: sourcePropertyId || null,
        }),
      );
      if (!res.ok) throw new Error(res.message ?? "تعذّر حفظ المقارن");
      return res.data;
    },
  );
  /** compEdit: price/area edit drafts for the comparable — local to the table. */
  const [editDraft, setEditDraft] = useState<Record<string, string>>({});
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;
  const onCreatedRef = useRef(onCreated);
  onCreatedRef.current = onCreated;
  const firstSearch = useRef(true);

  // Soft refresh when bank search query changes (no full-screen blank).
  useEffect(() => {
    if (firstSearch.current) {
      firstSearch.current = false;
      return;
    }
    const t = window.setTimeout(() => onSearchRef.current?.(q), 280);
    return () => window.clearTimeout(t);
  }, [q]);

  function openForm() {
    const next = emptyComparableEntryDraft();
    initialDraftRef.current = next;
    setDraft(next);
    setFieldErrors({});
    setLocationConfirmed(false);
    setFormKey((n) => n + 1);
    setDiscardOpen(false);
    setFormOpen(true);
  }

  function isDirty() {
    return JSON.stringify(draft) !== JSON.stringify(initialDraftRef.current);
  }

  function closeForm() {
    if (saving) return;
    setDiscardOpen(false);
    setFormOpen(false);
  }

  function requestClose() {
    if (saving || discardOpen) return;
    if (isDirty()) {
      setDiscardOpen(true);
      return;
    }
    closeForm();
  }

  async function saveComparable() {
    const errors = validateComparableEntry(draft, locationConfirmed);
    setFieldErrors(errors);
    const message = firstComparableEntryError(errors);
    if (message) {
      showToast(message, "error");
      scheduleScrollToFormField(firstComparableEntryErrorTarget(errors), 80);
      return;
    }
    try {
      const outcome = await runCreate(draft);
      if (outcome.status === "skipped") return;
      const anomaly = outcome.value.pricePerSqmAnomalyNoteAr;
      showToast(
        anomaly ? `أُضيف المقارن إلى البنك — ${anomaly}` : "أُضيف المقارن إلى البنك",
        anomaly ? "error" : "success",
      );
      setDraft(emptyComparableEntryDraft());
      setFieldErrors({});
      setLocationConfirmed(false);
      setFormOpen(false);
      setDiscardOpen(false);
      if (q.trim()) onSearchRef.current?.(q);
      else onCreatedRef.current?.();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "تعذّر حفظ المقارن",
        "error",
      );
    }
  }

  const saveOverride = (
    item: ValuationComparableSelectionDto,
    field: "price" | "area",
    raw: string,
  ) => {
    void onSaveOverride(item, field, raw).then((ok) => {
      if (!ok) return;
      // Draft served its purpose — effective server value shows after silent reload.
      setEditDraft((prev) => {
        const next = { ...prev };
        delete next[`${item.id}:${field}`];
        return next;
      });
    });
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <h2 className="m-0 text-[17px] font-extrabold text-heading">
            بنك المقارنات
          </h2>
          <span className="hidden text-[11.5px] text-text-3 md:inline">
            {q.trim()
              ? "نتائج البحث في البنك — الأقرب أولاً"
              : `ضمن ${NEARBY_RADIUS_KM} كم من موقع العقار — الأقرب أولاً`}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="primary"
            actionLabel="إضافة مقارن"
            disabled={saving}
            onClick={openForm}
          >
            اضافة مقارن
          </Button>
          {onSearch ? (
            <input
              placeholder="بحث حي / نوع / رقم مرجعي"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-[248px] rounded-lg border border-border-md bg-surface px-3.5 py-2 text-[13px] font-medium text-text outline-none transition-[border-color,box-shadow] placeholder:text-text-3 focus:border-gold focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--gold)_22%,transparent)]"
            />
          ) : (
            <span className="text-[12px] text-text-3">
              أراضٍ فضاء فقط — لا استيراد من أسلوب السوق
            </span>
          )}
        </div>
      </div>
      <AppModal
        open={formOpen}
        title="إضافة مقارن"
        subtitle="الدبوس الذهبي موقع العقار موضوع التقييم. ثبّت موقع المقارن ثم اختر أرضاً أو مبنى."
        wide
        maxWidthPx={720}
        look="ops-html"
        onClose={requestClose}
        footer={
          <>
            <Button type="button" onClick={requestClose} disabled={saving}>
              إلغاء
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={saving}
              disabled={saving}
              showActionToast={false}
              onClick={() => void saveComparable()}
            >
              حفظ في البنك
            </Button>
          </>
        }
      >
        <ComparablePropertyEntryFields
          key={formKey}
          draft={draft}
          disabled={saving}
          fieldErrors={fieldErrors}
          subjectPin={parseComparableCoords(seed?.latitude, seed?.longitude)}
          onChange={(next) => {
            setDraft(next);
            setFieldErrors({});
          }}
          onLocationConfirmedChange={setLocationConfirmed}
        />
      </AppModal>
      <UnsavedChangesDialog
        open={discardOpen}
        onStay={() => setDiscardOpen(false)}
        onLeave={closeForm}
      />
      <Card className="mb-6">
        <Table className="min-w-[1180px]" wrapClassName="rounded-xl">
          <THead>
            <Tr hoverable={false}>
              <Th className="w-[70px] text-center">اعتماد</Th>
              <Th className="min-w-[132px]">الرقم المرجعي</Th>
              <Th className="min-w-[100px] text-center">نوع العقار</Th>
              <Th className="min-w-[122px] text-center">نوع المقارن</Th>
              <Th className="w-[112px] text-center">تاريخ المقارن</Th>
              <Th className="min-w-[96px] bg-gold-soft text-center">
                سعر المتر
              </Th>
              <Th className="min-w-[108px] text-center">سعر العقار</Th>
              <Th className="w-[92px] text-center">المساحة (م²)</Th>
              <Th className="w-[88px] text-center">نسبة المساحة</Th>
              <Th className="w-[72px] text-center">المسافة</Th>
              <Th className="min-w-[84px]">الحي</Th>
              <Th className="min-w-[120px]">المصدر</Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((row) => {
              const pending = pendingAdopt.get(row.comp.id);
              const adopted = pending ?? row.adopted;
              return (
              <Tr
                key={row.key}
                hoverable={!adopted}
                className={cn(adopted && "bg-gold-soft")}
              >
                <Td className="text-center">
                  <input
                    type="checkbox"
                    checked={adopted}
                    disabled={pending !== undefined}
                    onChange={(e) => {
                      const next = e.target.checked;
                      const compId = row.comp.id;
                      setPendingAdopt((prev) => new Map(prev).set(compId, next));
                      void onAdopt(compId, next).finally(() => {
                        setPendingAdopt((prev) => {
                          const copy = new Map(prev);
                          copy.delete(compId);
                          return copy;
                        });
                      });
                    }}
                    className="size-[17px] cursor-pointer accent-[var(--ink)] disabled:cursor-wait"
                  />
                </Td>
                <TdLtr
                  valueClassName="text-[13.5px] font-bold text-gold-d"
                >
                  {row.comp.referenceCode}
                </TdLtr>
                <Td className="text-center">
                  <span className="text-[13px] text-text">
                    {row.comp.comparablePropertyType}
                  </span>
                </Td>
                <Td className="text-center">
                  <span className="inline-flex items-center rounded-md border border-border-md bg-surface-2 px-[11px] py-[3px] text-[12px] font-medium text-text-2">
                    {row.comp.transactionKindLabelAr}
                  </span>
                </Td>
                <TdLtr className="text-center" valueClassName="text-[13px] text-text-2">
                  {row.comp.transactionDate?.slice(0, 10) || "—"}
                </TdLtr>
                <TdLtr
                  className="bg-gold-soft text-center"
                  valueClassName="text-[14px] font-extrabold text-heading"
                >
                  {fmt(row.item?.effectivePricePerSqm ?? row.comp.pricePerSqm)}
                </TdLtr>
                <Td className="text-center">
                  {row.item ? (
                    <input
                      dir="ltr"
                      type="text"
                      title="سعر العقار الإجمالي — تجاوز لهذا التقييم فقط، لا يمس بنك المقارنات"
                      value={
                        editDraft[`${row.item.id}:price`] ??
                        String(row.item.effectivePriceSar ?? row.comp.price)
                      }
                      onChange={(e) =>
                        setEditDraft((prev) => ({
                          ...prev,
                          [`${row.item!.id}:price`]: e.target.value.replace(
                            /[^\d.]/g,
                            "",
                          ),
                        }))
                      }
                      onBlur={(e) =>
                        saveOverride(row.item!, "price", e.target.value)
                      }
                      className={cn(
                        "w-[104px] rounded-md border px-2 py-1.5 text-center text-[13.5px] font-extrabold outline-none",
                        row.item.priceOverrideSar != null
                          ? "border-border-md bg-surface text-heading"
                          : "border-border bg-surface-2 text-text-2",
                      )}
                    />
                  ) : (
                    <span dir="ltr" className="text-[14px] font-extrabold text-heading">
                      {fmt(row.comp.price)}
                    </span>
                  )}
                </Td>
                {row.item ? (
                  <Td className="text-center">
                    <input
                      dir="ltr"
                      type="text"
                      title="مساحة المقارن — تجاوز لهذا التقييم فقط"
                      value={
                        editDraft[`${row.item.id}:area`] ??
                        String(row.item.effectiveAreaSqm ?? row.comp.areaSqm)
                      }
                      onChange={(e) =>
                        setEditDraft((prev) => ({
                          ...prev,
                          [`${row.item!.id}:area`]: e.target.value.replace(
                            /[^\d.]/g,
                            "",
                          ),
                        }))
                      }
                      onBlur={(e) =>
                        saveOverride(row.item!, "area", e.target.value)
                      }
                      className={cn(
                        "w-[84px] rounded-md border px-2 py-1.5 text-center text-[13px] font-bold outline-none",
                        row.item.areaOverrideSqm != null
                          ? "border-border-md bg-surface text-heading"
                          : "border-border bg-surface-2 text-text-2",
                      )}
                    />
                  </Td>
                ) : (
                  <TdLtr
                    bare
                    className="text-center text-[13.5px] font-bold text-text-2"
                  >
                    {fmt(row.comp.areaSqm)}
                  </TdLtr>
                )}
                {(() => {
                  const effArea = row.item?.effectiveAreaSqm ?? row.comp.areaSqm;
                  const ratio = areaRatioValue(subjectSqm, effArea);
                  return (
                    <TdLtr
                      bare
                      className={cn(
                        "text-center text-[13.5px] font-bold",
                        ratio != null && ratio >= 2
                          ? "text-red-text"
                          : "text-heading",
                      )}
                      title={
                        ratio != null && ratio >= 2
                          ? "نسبة ≥ ٢ — تُفعِّل طريقة المضاعف على الجدول كاملاً"
                          : undefined
                      }
                    >
                      {areaRatio(subjectSqm, effArea)}
                    </TdLtr>
                  );
                })()}
                {(() => {
                  const km = distanceKm[row.comp.id];
                  return (
                    <TdLtr
                      bare
                      className="text-center text-[12.5px] text-text-2"
                    >
                      {km != null && Number.isFinite(km)
                        ? `${km.toFixed(km < 1 ? 2 : 1)} كم`
                        : "—"}
                    </TdLtr>
                  );
                })()}
                <Td>
                  <span className="truncate text-[13px] text-text-2">
                    {row.comp.district}
                  </span>
                </Td>
                <Td>
                  <span className="truncate text-[11.5px] text-text-3">
                    {sourceCardLine(row.comp)}
                  </span>
                </Td>
              </Tr>
              );
            })}
            {rows.length === 0 ? (
              <TableEmptyRow colSpan={12}>
                {q.trim()
                  ? "لا نتائج مطابقة لهذا البحث"
                  : `لا مقارنات ضمن ${NEARBY_RADIUS_KM} كم — اضغط «اضافة مقارن» (مدينة + إحداثيات).`}
              </TableEmptyRow>
            ) : null}
          </TBody>
        </Table>
      </Card>
    </>
  );
});
