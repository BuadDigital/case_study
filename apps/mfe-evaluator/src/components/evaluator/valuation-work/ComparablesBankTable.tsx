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
  validateComparableEntry,
  type ComparableEntryDraft,
  type ComparableEntryFieldErrors,
} from "@platform/app-shared/app-data/comparable-entry";
import { parseLatLng } from "@platform/app-shared/domain/geo";
import { useViewportDesktop } from "@platform/app-shared/hooks/use-viewport-desktop";
import { useLatestRef } from "@platform/app-shared/hooks/use-latest-ref";
import { scheduleScrollToFormField } from "@platform/app-shared/form-ux";
import {
  AppModal,
  Button,
  cn,
  MobileRecordCard,
  MobileRecordList,
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
import { ComparablesBankMoneyCells, ComparablesBankMoneyReadOnly } from "./ComparablesBankMoneyCells";
import {
  areaRatio,
  areaRatioValue,
  BANK_RADIUS_OPTIONS_KM,
  NEARBY_RADIUS_KM,
  sourceCardLine,
  type BankBeyond,
  type BankDisplayRow,
} from "./lib/bank-ranking";
import { apiConfig, fmt } from "./lib/shell-utils";

type ComparablesBankRow = BankDisplayRow;

/**
 * Nearby bank table — search and price/area drafts stay local so typing does
 * not re-render the valuation shell. «اضافة مقارن» writes to the shared bank.
 */
function radiusLabel(radiusKm: number | null): string {
  return radiusKm == null ? "كل المقارنات المتاحة" : `ضمن ${radiusKm} كم`;
}

/** The smallest radius choice that reaches `nearestKm`; `null` (all) when none does. */
function radiusReaching(nearestKm: number): number | null {
  for (const option of BANK_RADIUS_OPTIONS_KM) {
    if (option != null && option >= nearestKm) return option;
  }
  return null;
}

/**
 * Empty table: say why and what to do next — never a dead end. A search with no hit offers to
 * clear it; an empty radius says how many comparables lie farther (and how far the nearest is)
 * with a one-click widen; an empty bank points at «إضافة مقارن».
 */
function BankEmptyState({
  searching,
  radiusKm,
  beyond,
  onClearSearch,
  onWiden,
  onAdd,
}: {
  searching: boolean;
  radiusKm: number | null;
  beyond?: BankBeyond;
  onClearSearch: () => void;
  onWiden?: (radiusKm: number | null) => void;
  onAdd: () => void;
}) {
  if (searching) {
    return (
      <div className="grid justify-items-center gap-2.5">
        <span>لا توجد نتائج مطابقة — جرّب كلمة أخرى (حي، نوع العقار أو رقم مرجعي).</span>
        <Button type="button" size="sm" onClick={onClearSearch}>
          مسح البحث
        </Button>
      </div>
    );
  }

  const nearest = beyond?.nearestKm ?? null;
  if (beyond && beyond.count > 0 && nearest != null && onWiden) {
    const target = radiusReaching(nearest);
    return (
      <div className="grid justify-items-center gap-2.5">
        <span className="font-semibold text-text-2">
          لا توجد مقارنات {radiusLabel(radiusKm)} من موقع العقار.
        </span>
        <span>
          يوجد {beyond.count} {beyond.count === 1 ? "مقارن أبعد" : "مقارنات أبعد"}، وأقربها على{" "}
          {nearest.toFixed(1)} كم.
        </span>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" size="sm" variant="primary" onClick={() => onWiden(target)}>
            {target == null ? "اعرض الكل" : `وسّع النطاق إلى ${target} كم`}
          </Button>
          <Button type="button" size="sm" onClick={onAdd}>
            إضافة مقارن
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid justify-items-center gap-2.5">
      <span className="font-semibold text-text-2">لا توجد مقارنات في البنك لهذا الموقع بعد.</span>
      <span>أضف مقارناً (مدينة + إحداثيات) ليظهر هنا ويمكنك اعتماده.</span>
      <Button type="button" size="sm" variant="primary" onClick={onAdd}>
        إضافة مقارن
      </Button>
    </div>
  );
}

function distanceLabel(km: number | undefined): string {
  return km != null && Number.isFinite(km) ? `${km.toFixed(km < 1 ? 2 : 1)} كم` : "—";
}

/** «اعتماد» checkbox — table cell and phone card share the optimistic-draft wiring. */
function AdoptCheckbox({
  checked,
  pending,
  onToggle,
  className,
}: {
  checked: boolean;
  pending: boolean;
  onToggle: (next: boolean) => void;
  className?: string;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={pending}
      onChange={(e) => onToggle(e.target.checked)}
      className={cn("cursor-pointer accent-[var(--ink)] disabled:cursor-wait", className)}
    />
  );
}

type ComparableBankSeed = {
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
  radiusKm = NEARBY_RADIUS_KM,
  onRadiusChange,
  beyond,
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
  /** The radius around the property the table shows (3 km by default); `null` = all. */
  radiusKm?: number | null;
  /** Radius chips are shown only when this is given. */
  onRadiusChange?: (radiusKm: number | null) => void;
  /** What the chosen radius leaves out — drives the empty-state message. */
  beyond?: BankBeyond;
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
  const desktop = useViewportDesktop();
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
  const onSearchRef = useLatestRef(onSearch);
  const onCreatedRef = useLatestRef(onCreated);
  const firstSearch = useRef(true);

  // Soft refresh when bank search query changes (no full-screen blank).
  useEffect(() => {
    if (firstSearch.current) {
      firstSearch.current = false;
      return;
    }
    const t = window.setTimeout(() => onSearchRef.current?.(q), 280);
    return () => window.clearTimeout(t);
  }, [onSearchRef, q]);

  function toggleAdopt(compId: string, next: boolean) {
    setPendingAdopt((prev) => new Map(prev).set(compId, next));
    void onAdopt(compId, next).finally(() => {
      setPendingAdopt((prev) => {
        const copy = new Map(prev);
        copy.delete(compId);
        return copy;
      });
    });
  }

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

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="m-0 text-[17px] font-extrabold text-heading">
            بنك المقارنات
          </h2>
          <span className="hidden text-[11.5px] text-text-3 md:inline">
            {q.trim()
              ? "نتائج البحث في البنك — الأقرب أولاً"
              : `${radiusLabel(radiusKm)} من موقع العقار — الأقرب أولاً`}
          </span>
          {onRadiusChange && !q.trim() ? (
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="نطاق البحث حول العقار">
              {BANK_RADIUS_OPTIONS_KM.map((option) => (
                <button
                  key={option ?? "all"}
                  type="button"
                  aria-pressed={option === radiusKm}
                  onClick={() => onRadiusChange(option)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition-colors max-lg:min-h-11 max-lg:px-3.5 max-lg:text-[12.5px]",
                    option === radiusKm
                      ? "border-gold bg-gold-soft text-gold-d"
                      : "border-border-md bg-surface text-text-2 hover:border-gold",
                  )}
                >
                  {option == null ? "الكل" : `${option} كم`}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 max-lg:w-full max-lg:[&>*]:flex-1">
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
              className="min-w-0 rounded-lg border max-lg:min-h-11 max-lg:basis-full max-lg:text-[16px] lg:w-[248px] border-border-md bg-surface px-3.5 py-2 text-[13px] font-medium text-text outline-none transition-[border-color,box-shadow] placeholder:text-text-3 focus:border-gold focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--gold)_22%,transparent)]"
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
          subjectPin={parseLatLng(seed?.latitude, seed?.longitude)}
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
      {/* Phones: one card per comparable — the 12-column table ran 1180px wide.
          Price / unit / area stay editable as full-width inputs. */}
      {desktop !== true ? (
        <MobileRecordList
          className="mb-6 lg:hidden"
          isEmpty={rows.length === 0}
          empty={
            <BankEmptyState
              searching={q.trim().length > 0}
              radiusKm={radiusKm}
              beyond={beyond}
              onClearSearch={() => setQ("")}
              onWiden={onRadiusChange}
              onAdd={openForm}
            />
          }
        >
          {rows.map((row) => {
            const pending = pendingAdopt.get(row.comp.id);
            const adopted = pending ?? row.adopted;
            const comp = row.comp;
            const readOnlyRatio = areaRatioValue(subjectSqm, comp.areaSqm);
            return (
              <MobileRecordCard
                key={row.key}
                tone={adopted ? "gold" : undefined}
                className={cn(adopted && "bg-gold-soft")}
                title={<bdi dir="ltr" className="text-gold-d">{comp.referenceCode}</bdi>}
                subtitle={[comp.comparablePropertyType, comp.district].filter(Boolean).join(" · ")}
                status={
                  <span className="inline-flex items-center rounded-md border border-border-md bg-surface-2 px-2.5 py-[3px] text-[11.5px] font-medium text-text-2">
                    {comp.transactionKindLabelAr}
                  </span>
                }
                fields={[
                  { label: "تاريخ العملية", value: comp.transactionDate?.slice(0, 10) || "—", ltr: true },
                  { label: "المسافة", value: distanceLabel(distanceKm[comp.id]), ltr: true },
                  ...(row.item
                    ? []
                    : [
                        { label: "سعر المتر", value: fmt(comp.pricePerSqm), ltr: true },
                        { label: "سعر العقار", value: fmt(comp.price), ltr: true },
                        { label: "المساحة (م²)", value: fmt(comp.areaSqm), ltr: true },
                        {
                          label: "نسبة المساحة",
                          value: (
                            <span className={cn(readOnlyRatio != null && readOnlyRatio >= 2 && "text-red-text")}>
                              {areaRatio(subjectSqm, comp.areaSqm)}
                            </span>
                          ),
                          ltr: true,
                        },
                      ]),
                  { label: "المصدر", value: sourceCardLine(comp), wide: true },
                ]}
                actions={
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-[10px] border px-3 text-[13px] font-bold",
                      adopted ? "border-gold bg-surface text-gold-d" : "border-border-md bg-surface text-text-2",
                    )}
                  >
                    <AdoptCheckbox
                      checked={adopted}
                      pending={pending !== undefined}
                      onToggle={(next) => toggleAdopt(comp.id, next)}
                      className="size-5"
                    />
                    {adopted ? "معتمد في التقييم" : "اعتماد المقارن"}
                  </label>
                }
              >
                {row.item ? (
                  <ComparablesBankMoneyCells
                    touch
                    item={row.item}
                    comp={comp}
                    subjectSqm={subjectSqm}
                    onSaveOverride={onSaveOverride}
                  />
                ) : null}
              </MobileRecordCard>
            );
          })}
        </MobileRecordList>
      ) : null}

      {desktop !== false ? (
      <Card className="mb-6 max-lg:hidden">
        <Table className="min-w-[1180px]" wrapClassName="rounded-xl">
          <THead>
            <Tr hoverable={false}>
              <Th className="w-[70px] text-center">اعتماد</Th>
              <Th className="min-w-[132px]">الرقم المرجعي</Th>
              <Th className="min-w-[100px] text-center">نوع العقار</Th>
              <Th className="min-w-[122px] text-center">نوع المقارن</Th>
              <Th className="w-[112px] text-center">تاريخ العملية</Th>
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
                  <AdoptCheckbox
                    checked={adopted}
                    pending={pending !== undefined}
                    onToggle={(next) => toggleAdopt(row.comp.id, next)}
                    className="size-[17px]"
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
                {row.item ? (
                  <ComparablesBankMoneyCells
                    item={row.item}
                    comp={row.comp}
                    subjectSqm={subjectSqm}
                    onSaveOverride={onSaveOverride}
                  />
                ) : (
                  <ComparablesBankMoneyReadOnly
                    comp={row.comp}
                    subjectSqm={subjectSqm}
                  />
                )}
                <TdLtr
                  bare
                  className="text-center text-[12.5px] text-text-2"
                >
                  {distanceLabel(distanceKm[row.comp.id])}
                </TdLtr>
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
                <BankEmptyState
                  searching={q.trim().length > 0}
                  radiusKm={radiusKm}
                  beyond={beyond}
                  onClearSearch={() => setQ("")}
                  onWiden={onRadiusChange}
                  onAdd={openForm}
                />
              </TableEmptyRow>
            ) : null}
          </TBody>
        </Table>
      </Card>
      ) : null}
    </>
  );
});
