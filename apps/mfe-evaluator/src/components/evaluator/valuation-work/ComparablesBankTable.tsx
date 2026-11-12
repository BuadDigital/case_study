// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 2 (1b19bedc)
//  • Button and doc comment read «إضافة مقارن» (the hamza was missing).
//  • Wording  «تاريخ العملية» prints as yyyy/mm/dd (ymd) on the desktop table and the phone cards.
//  • Comparable codes are whitespace-nowrap so a CMP-… code never breaks across lines.
// ──────────────────────────────────────────────────────────────────────────────────────────────

"use client";

import { memo, useRef, useState } from "react";
import type {
  ComparablePropertyDto,
  ValuationComparableSelectionDto,
} from "@platform/api-client";
import { createComparableProperty } from "@platform/api-client";
import { useCommandMutation } from "@platform/app-shared";
import { UnsavedChangesDialog } from "@platform/app-shared/registration/UnsavedChangesDialog";
import {
  comparableDraftToUpsert,
  comparableTypeLabel,
  emptyComparableEntryDraft,
  firstComparableEntryError,
  firstComparableEntryErrorTarget,
  sourceCardLine,
  validateComparableEntry,
  type ComparableEntryDraft,
  type ComparableEntryFieldErrors,
} from "@platform/app-shared/app-data/comparable-entry";
import { parseLatLng } from "@platform/app-shared/domain/geo";
import { ymd } from "@platform/app-shared/format/date";
import { fmtMax } from "@platform/app-shared/format/number";
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
  TdAction,
  TdLtr,
  Th,
  ThAction,
  THead,
  Tr,
  useToast,
} from "@platform/ui-kit";
import { Card } from "./atoms";
import { ComparablesBankMoneyCells, ComparablesBankMoneyReadOnly } from "./ComparablesBankMoneyCells";
import { ComparableEntryWithBank } from "./ComparableEntryWithBank";
import {
  areaRatio,
  areaRatioValue,
  isVacantLandComparable,
  type BankDisplayRow,
} from "./lib/bank-ranking";
import { apiConfig, fmt } from "./lib/shell-utils";

type ComparablesBankRow = BankDisplayRow;

/**
 * How many comparables a transaction's table holds (Omar 2026-11-12: up to eight are added, up to
 * five of them adopted — the organisation's «الحد الأقصى للمقارنات المعتمدة» — and the adjustments
 * need two at least).
 */
const MAX_TRANSACTION_COMPARABLES = 8;
const TABLE_FULL_AR = `في المعاملة ${MAX_TRANSACTION_COMPARABLES} مقارنات وهو الحد الأقصى — احذف مقارناً غير معتمد قبل إضافة آخر`;

/**
 * Empty table: say why and what to do next — never a dead end. A transaction with no comparables
 * yet points at «إضافة مقارن», the one window for a new comparable or one from the bank.
 */
function BankEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="grid justify-items-center gap-2.5">
      <span className="font-semibold text-text-2">لا مقارنات لهذه المعاملة بعد.</span>
      <span>أضف مقارناً جديداً، أو اختر مقارناً من البنك.</span>
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

/**
 * A transaction's comparables table: its own comparables (entered for the property or chosen for
 * it) — the system suggests none (ruling 2026-11-11).
 *
 * How it works: price/area drafts stay local so typing does not re-render the valuation shell.
 * «إضافة مقارن» is the one window for a comparable (Omar 2026-11-11, it replaced the separate
 * «خريطة المقارنات»): its map shows the bank — search by reference code or district, filter, adopt
 * or un-adopt a pressed pin, several in a row — and a spot pinned on it opens the fields of a
 * new comparable, which is written to the shared bank.
 */
export const ComparablesBankTable = memo(function ComparablesBankTable({
  rows,
  subjectSqm,
  distanceKm,
  landOnly = false,
  onAdopt,
  onRemove,
  onCopyLandValuation,
  copyLandSource,
  onSaveOverride,
  seed,
  sourceWorkOrderNumber,
  sourcePropertyId,
  onCreated,
}: {
  rows: ComparablesBankRow[];
  subjectSqm: number | null;
  distanceKm: Record<string, number>;
  /** The cost approach's land table: only a land comparable can be chosen. */
  landOnly?: boolean;
  /** Resolves once the save (and the reload it triggers) settles — the checkbox reverts to
   * `rows` truth then. Adopting a comparable for the first time has no server round trip to
   * flip early on, so the checkbox owns its own optimistic draft meanwhile (rerender-defer-reads). */
  onAdopt: (comparableId: string, adopted: boolean) => Promise<void>;
  /** Takes a comparable that is not adopted out of this transaction's table. */
  onRemove: (comparableId: string) => Promise<void>;
  /**
   * «انسخ طريقة المبيعات المشابهة للأرض»: copies the land valuation of the other table into this
   * one (`replace` once the appraiser confirmed replacing what it holds). Absent = nothing to copy
   * here, and the button is not shown.
   */
  onCopyLandValuation?: (replace: boolean) => Promise<boolean>;
  /** Where the copy comes from, for the button's hint and the confirmation. */
  copyLandSource?: { label: string; count: number };
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
  const [copyConfirmOpen, setCopyConfirmOpen] = useState(false);
  const [copying, setCopying] = useState(false);
  async function copyLandValuation(replace: boolean) {
    if (!onCopyLandValuation || copying) return;
    setCopying(true);
    try {
      await onCopyLandValuation(replace);
    } finally {
      setCopying(false);
      setCopyConfirmOpen(false);
    }
  }
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
  const onCreatedRef = useLatestRef(onCreated);

  // Rows being removed, so «حذف» cannot be pressed twice.
  const [removing, setRemoving] = useState<ReadonlySet<string>>(new Set());
  function removeRow(compId: string) {
    setRemoving((prev) => new Set(prev).add(compId));
    void onRemove(compId).finally(() => {
      setRemoving((prev) => {
        const copy = new Set(prev);
        copy.delete(compId);
        return copy;
      });
    });
  }

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

  /** A comparable of this table pressed on the entry map is adopted, or un-adopted, without
   * leaving the window. */
  function adoptFromMap(comp: ComparablePropertyDto, next: boolean) {
    if (saving) return;
    if (next && landOnly && !isVacantLandComparable(comp.comparablePropertyType)) {
      showToast("هذا الجدول للأراضي فقط — المقارن المختار ليس أرضاً", "error");
      return;
    }
    toggleAdopt(comp.id, next);
  }

  /**
   * A bank comparable pressed on the entry map joins this transaction's table, not adopted
   * (Omar 2026-11-12: adding is apart from adopting — it used to adopt at once, so nothing could
   * be added past the adopted ceiling).
   *
   * How it works: the server links a comparable that is not in the table when its adoption is
   * set — here to «not adopted»; the appraiser adopts it from the table or from the map.
   * Edge cases: a full table (eight) refuses and says how to make room; the land table takes
   * lands only.
   */
  function addFromMap(comp: ComparablePropertyDto) {
    if (saving) return;
    if (landOnly && !isVacantLandComparable(comp.comparablePropertyType)) {
      showToast("هذا الجدول للأراضي فقط — المقارن المختار ليس أرضاً", "error");
      return;
    }
    if (rows.length >= MAX_TRANSACTION_COMPARABLES) {
      showToast(TABLE_FULL_AR, "error");
      return;
    }
    toggleAdopt(comp.id, false);
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
    // A new comparable is entered for this property and joins its table: the same ceiling.
    if (rows.length >= MAX_TRANSACTION_COMPARABLES) {
      showToast(TABLE_FULL_AR, "error");
      return;
    }
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
      onCreatedRef.current?.();
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
            مقارنات هذه المعاملة — المُدخلة لها أو المختارة من البنك
          </span>
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
            إضافة مقارن
          </Button>
          {onCopyLandValuation ? (
            <Button
              type="button"
              size="sm"
              showActionToast={false}
              loading={copying}
              disabled={copying || saving}
              title={
                copyLandSource
                  ? `ينسخ ${copyLandSource.count} مقارن معتمد من ${copyLandSource.label} بتسوياته وأوزانه ومبرراته`
                  : undefined
              }
              // A table that already holds comparables is replaced only after the appraiser confirms.
              onClick={() => (rows.length > 0 ? setCopyConfirmOpen(true) : void copyLandValuation(false))}
            >
              انسخ طريقة المبيعات المشابهة للأرض
            </Button>
          ) : null}
        </div>
      </div>
      <AppModal
        open={copyConfirmOpen}
        title="انسخ طريقة المبيعات المشابهة للأرض"
        onClose={() => (copying ? undefined : setCopyConfirmOpen(false))}
        footer={
          <>
            <Button type="button" disabled={copying} onClick={() => setCopyConfirmOpen(false)}>
              إلغاء
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={copying}
              disabled={copying}
              showActionToast={false}
              onClick={() => void copyLandValuation(true)}
            >
              استبدال ونسخ
            </Button>
          </>
        }
      >
        <p className="m-0 text-[13px] leading-6 text-text-2">
          هذا الجدول فيه {rows.length} مقارن. النسخ يستبدلها بمقارنات{" "}
          {copyLandSource?.label ?? "الجدول الآخر"} المعتمدة ({copyLandSource?.count ?? 0}) بتسوياتها
          وأوزانها ومبرراتها، وتُحذف مقارنات هذا الجدول الحالية وتسوياتها. بعد النسخ يبقى الجدولان
          مستقلين وتعدّل هذا بحرية.
        </p>
      </AppModal>
      <AppModal
        open={formOpen}
        title="إضافة مقارن"
        wide
        maxWidthPx={860}
        look="ops-html"
        onClose={requestClose}
        footer={
          // «حفظ في البنك» belongs to a new comparable: it appears once its location is pinned.
          // Until then the window only chooses from the bank, and closes with «تم».
          locationConfirmed ? (
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
          ) : (
            <Button type="button" variant="primary" showActionToast={false} onClick={requestClose}>
              تم
            </Button>
          )
        }
      >
        <ComparableEntryWithBank
          key={formKey}
          draft={draft}
          saving={saving}
          fieldErrors={fieldErrors}
          subjectPin={parseLatLng(seed?.latitude, seed?.longitude)}
          propertyId={sourcePropertyId}
          subjectSqm={subjectSqm}
          landOnly={landOnly}
          rows={rows}
          pendingAdopt={pendingAdopt}
          onToggleAdopt={adoptFromMap}
          onAdd={addFromMap}
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
          empty={<BankEmptyState onAdd={openForm} />}
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
                title={<bdi dir="ltr" className="whitespace-nowrap text-gold-d">{comp.referenceCode}</bdi>}
                subtitle={[comparableTypeLabel(comp.comparablePropertyType), comp.district]
                  .filter(Boolean)
                  .join(" · ")}
                status={
                  <span className="inline-flex items-center rounded-md border border-border-md bg-surface-2 px-2.5 py-[3px] text-[11.5px] font-medium text-text-2">
                    {comp.transactionKindLabelAr}
                  </span>
                }
                fields={[
                  { label: "تاريخ العملية", value: ymd(comp.transactionDate), ltr: true },
                  { label: "المسافة", value: distanceLabel(distanceKm[comp.id]), ltr: true },
                  ...(row.item
                    ? []
                    : [
                        { label: "سعر المتر", value: fmtMax(comp.pricePerSqm), ltr: true },
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
                  <>
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
                  {adopted ? null : (
                    <Button
                      type="button"
                      variant="dangerOutline"
                      showActionToast={false}
                      disabled={pending !== undefined || removing.has(comp.id)}
                      onClick={() => removeRow(comp.id)}
                    >
                      حذف من المعاملة
                    </Button>
                  )}
                  </>
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
      <Card framed className="mb-6 max-lg:hidden">
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
              <ThAction aria-label="حذف" />
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
                  valueClassName="whitespace-nowrap text-[13.5px] font-bold text-gold-d"
                >
                  {row.comp.referenceCode}
                </TdLtr>
                <Td className="text-center">
                  <span className="text-[13px] text-text">
                    {comparableTypeLabel(row.comp.comparablePropertyType)}
                  </span>
                </Td>
                <Td className="text-center">
                  <span className="inline-flex items-center rounded-md border border-border-md bg-surface-2 px-[11px] py-[3px] text-[12px] font-medium text-text-2">
                    {row.comp.transactionKindLabelAr}
                  </span>
                </Td>
                <TdLtr className="text-center" valueClassName="text-[13px] text-text-2">
                  {ymd(row.comp.transactionDate)}
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
                <TdAction>
                  {adopted ? null : (
                    <Button
                      type="button"
                      size="sm"
                      variant="dangerOutline"
                      showActionToast={false}
                      title="حذف المقارن من مقارنات هذه المعاملة — يبقى في بنك المقارنات"
                      disabled={pending !== undefined || removing.has(row.comp.id)}
                      onClick={() => removeRow(row.comp.id)}
                    >
                      حذف
                    </Button>
                  )}
                </TdAction>
              </Tr>
              );
            })}
            {rows.length === 0 ? (
              <TableEmptyRow colSpan={13}>
                <BankEmptyState onAdd={openForm} />
              </TableEmptyRow>
            ) : null}
          </TBody>
        </Table>
      </Card>
      ) : null}
    </>
  );
});
