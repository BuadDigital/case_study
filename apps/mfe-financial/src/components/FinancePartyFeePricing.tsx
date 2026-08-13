"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  FormGroup,
  ModalBody,
  ModalCard,
  ModalClose,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Note,
  Spinner,
  cn,
  useToast,
} from "@platform/design-system";
import { useCapability } from "@platform/app-shared/components/Can";
import type {
  PartyFeePricingCategory,
  PartyFeePricingDto,
  PartyFeePricingTableSummaryDto,
  PartyFeePricingTierDto,
} from "@platform/api-client";
import {
  getEngineeringOffices,
  getFieldInspectors,
  getGovernmentAuditors,
  type DistributionAssignee,
} from "@case-study/mfe/lib/distribution-assignees";
import {
  opsBtnGhost,
  opsBtnPrimary,
  opsFldControl,
  opsIconBoxGold,
  opsLetterCard,
  opsLetterHead,
  opsLetterSub,
  opsLetterTitle,
  opsPpBadge,
  opsTfActions,
  opsTfLbl,
  opsTfNote,
  opsTfSeg,
  opsTfSegActive,
  opsTfSegRow,
} from "@case-study/mfe/lib/prototype/ops-tasks-tw";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import {
  activatePartyFeePricingTable,
  createPartyFeePricingTable,
  deletePartyFeePricingTable,
  loadPartyFeePricingById,
  loadPartyFeePricingTables,
  partyFeePricingTableQueryKey,
  partyFeePricingTablesQueryKey,
  revisePartyFeePricingConfig,
  savePartyFeePricingAssignments,
  savePartyFeePricingConfig,
} from "../lib/financial-api";

const PRICING_STALE_MS = 60_000;

const PRICING_ICON = "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6";

function OpsIcon({ path, size = 20 }: { path: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

const CATEGORIES: {
  id: PartyFeePricingCategory;
  label: string;
  hint: string;
  partyLabel: string;
}[] = [
  {
    id: "engineering-survey",
    label: "المكاتب الهندسية",
    hint: "شرائح المساحة والأتعاب",
    partyLabel: "المكاتب",
  },
  {
    id: "court-visit",
    label: "زيارات المحكمة",
    hint: "أتعاب الزيارة للمراجع المتعاون",
    partyLabel: "المراجعون",
  },
  {
    id: "field-inspector",
    label: "المعاينين الميدانيين",
    hint: "متعاون فرد أو منشأة",
    partyLabel: "المعاينون",
  },
];

function partiesForCategory(
  category: PartyFeePricingCategory,
  staffUsers: Parameters<typeof getEngineeringOffices>[0],
): DistributionAssignee[] {
  if (category === "engineering-survey") return getEngineeringOffices(staffUsers);
  if (category === "court-visit") return getGovernmentAuditors(staffUsers);
  return getFieldInspectors(staffUsers);
}

function emptyDraft(
  category: PartyFeePricingCategory,
  partial?: Partial<PartyFeePricingDto>,
): PartyFeePricingDto {
  return {
    id: "",
    category,
    name: "",
    isActive: false,
    assignedCount: 0,
    assignedAssigneeIds: [],
    areaTiers:
      category === "engineering-survey"
        ? [
            { sortOrder: 0, maxAreaM2: 500, feeSar: 0 },
            { sortOrder: 1, maxAreaM2: null, feeSar: 0 },
          ]
        : [],
    courtVisitFeeSar: 0,
    fieldInspectorIndividualFeeSar: 0,
    fieldInspectorOrganizationFeeSar: 0,
    ...partial,
  };
}

function num(value: string): number {
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function reindexTiers(tiers: PartyFeePricingTierDto[]): PartyFeePricingTierDto[] {
  return tiers.map((t, i) => ({
    ...t,
    sortOrder: i,
    maxAreaM2: i === tiers.length - 1 ? null : t.maxAreaM2,
  }));
}

function tierFromValue(tiers: PartyFeePricingTierDto[], index: number): number {
  if (index === 0) return 0;
  const prev = tiers[index - 1]?.maxAreaM2;
  if (prev == null || prev <= 0) return 0;
  return prev;
}

function defaultTableName(count: number): string {
  return count === 0 ? "افتراضي" : `جدول ${count + 1}`;
}

function pickTableId(
  list: PartyFeePricingTableSummaryDto[],
  preferId?: string,
): string {
  return preferId && list.some((t) => t.id === preferId)
    ? preferId
    : (list.find((t) => t.isActive)?.id ?? list[0]?.id ?? "");
}

function MoneyInput({
  id,
  value,
  locked,
  onChange,
  className,
}: {
  id?: string;
  value: number;
  locked: boolean;
  onChange: (n: number) => void;
  className?: string;
}) {
  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      dir="ltr"
      readOnly={locked}
      disabled={locked}
      className={cn(
        opsFldControl,
        "text-start tabular-nums disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      value={value === 0 ? "" : String(value)}
      placeholder="0"
      onChange={(e) => onChange(num(e.target.value))}
    />
  );
}

export function FinancePartyFeePricing() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const isSystemAdmin = useCapability("manage-system-config");
  const canEditOps = useCapability("manage-operations");
  const canEditSpecialist = useCapability("manage-work-orders");
  /** مسؤول النظام · مشرف · أخصائي دراسة حالة */
  const canEdit = isSystemAdmin || canEditOps || canEditSpecialist;
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];
  const [selectedCategory, setSelectedCategory] =
    useState<PartyFeePricingCategory>("engineering-survey");
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<PartyFeePricingDto>(
    emptyDraft("engineering-survey"),
  );
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignDraft, setAssignDraft] = useState<string[]>([]);
  /** After data lands, drive a short enter animation */
  const [panelEpoch, setPanelEpoch] = useState(0);
  /** Prefer this table after create/activate/save (before lists settle). */
  const preferTableIdRef = useRef<string | undefined>(undefined);
  const syncedDetailIdRef = useRef("");

  const tablesQuery = useQuery({
    queryKey: partyFeePricingTablesQueryKey(selectedCategory),
    queryFn: () => loadPartyFeePricingTables(selectedCategory),
    staleTime: PRICING_STALE_MS,
  });
  const tables = tablesQuery.data ?? [];

  // Resolve which table to open (prefer ref after mutations, else active/first).
  useEffect(() => {
    if (!tablesQuery.isSuccess) return;
    const prefer = preferTableIdRef.current;
    const next = pickTableId(tables, prefer ?? (selectedId || undefined));
    if (prefer && tables.some((t) => t.id === prefer)) {
      preferTableIdRef.current = undefined;
    }
    if (next !== selectedId) setSelectedId(next);
  }, [tablesQuery.isSuccess, tables, selectedCategory, selectedId]);

  const detailQuery = useQuery({
    queryKey: partyFeePricingTableQueryKey(selectedId),
    queryFn: () => loadPartyFeePricingById(selectedId),
    enabled: Boolean(selectedId),
    staleTime: PRICING_STALE_MS,
  });

  // Apply server detail only when the selected table changes (not background refetch).
  useEffect(() => {
    if (!detailQuery.isSuccess || !detailQuery.data) return;
    if (detailQuery.data.id !== selectedId) return;
    if (syncedDetailIdRef.current === selectedId) return;
    syncedDetailIdRef.current = selectedId;
    setDraft(detailQuery.data);
    setPanelEpoch((n) => n + 1);
  }, [selectedId, detailQuery.isSuccess, detailQuery.data]);

  // Tables loading, or detail for the selected table not yet applied to the draft.
  const loading =
    tablesQuery.isPending ||
    (Boolean(selectedId) &&
      draft.id !== selectedId &&
      !detailQuery.isSuccess);
  const locked = loading || saving || busy || !canEdit;

  /** Category that the on-screen draft belongs to (kept while the next fetch runs). */
  const contentCategory: PartyFeePricingCategory =
    draft.id && draft.category
      ? (draft.category as PartyFeePricingCategory)
      : selectedCategory;

  const categoryParties = useMemo(
    () => partiesForCategory(contentCategory, staffUsers),
    [contentCategory, staffUsers],
  );

  const assignedNames = useMemo(() => {
    const ids = new Set(draft.assignedAssigneeIds ?? []);
    return categoryParties.filter((p) => ids.has(p.id));
  }, [categoryParties, draft.assignedAssigneeIds]);

  const draftMatchesCategory =
    Boolean(draft.id) &&
    (draft.category === selectedCategory || !draft.category);

  /** Keep previous panel while the next category loads — no layout flash. */
  const holdingPrevious = loading && Boolean(draft.id);
  const isInitialLoad = loading && !draft.id;

  const invalidateTables = (category: PartyFeePricingCategory) =>
    queryClient.invalidateQueries({
      queryKey: partyFeePricingTablesQueryKey(category),
    });

  const cacheTable = (dto: PartyFeePricingDto) => {
    queryClient.setQueryData(partyFeePricingTableQueryKey(dto.id), dto);
    syncedDetailIdRef.current = dto.id;
    setDraft(dto);
  };

  const refreshTables = async (
    category: PartyFeePricingCategory,
    preferId?: string,
  ) => {
    if (preferId) preferTableIdRef.current = preferId;
    await invalidateTables(category);
    const list = await queryClient.fetchQuery({
      queryKey: partyFeePricingTablesQueryKey(category),
      queryFn: () => loadPartyFeePricingTables(category),
      staleTime: PRICING_STALE_MS,
    });
    const nextId = pickTableId(list, preferId);
    if (nextId !== selectedId) setSelectedId(nextId);
    return nextId;
  };

  const loadTable = async (id: string, category: PartyFeePricingCategory) => {
    if (!id) {
      setDraft(emptyDraft(category));
      syncedDetailIdRef.current = "";
      return;
    }
    syncedDetailIdRef.current = "";
    setSelectedId(id);
    const detail = await queryClient.fetchQuery({
      queryKey: partyFeePricingTableQueryKey(id),
      queryFn: () => loadPartyFeePricingById(id),
      staleTime: PRICING_STALE_MS,
    });
    cacheTable(detail);
  };

  const selectCategory = (category: PartyFeePricingCategory) => {
    if (category === selectedCategory || busy || saving) return;
    // Drop selection so we do not fetch the previous category's table id.
    syncedDetailIdRef.current = "";
    preferTableIdRef.current = undefined;
    setSelectedId("");
    setSelectedCategory(category);
  };

  const selectTable = async (id: string) => {
    if (!id || id === selectedId || loading) return;
    setBusy(true);
    try {
      await loadTable(id, selectedCategory);
      setPanelEpoch((n) => n + 1);
    } catch {
      showToast("تعذّر تحميل الجدول", "error");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!draft.id) return;
    setSaving(true);
    try {
      const request = {
        ...draft,
        category: selectedCategory,
        areaTiers:
          selectedCategory === "engineering-survey"
            ? reindexTiers(draft.areaTiers)
            : [],
      };
      const createsRevision = (draft.assignedCount ?? 0) > 0;
      const saved = createsRevision
        ? await revisePartyFeePricingConfig(draft.id, request)
        : await savePartyFeePricingConfig(draft.id, request);
      cacheTable(saved);
      await refreshTables(selectedCategory, saved.id);
      showToast(
        createsRevision
          ? "تم إنشاء نسخة جديدة ونقل الإسنادات إليها"
          : "تم حفظ التسعيرة",
        "success",
      );
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "تعذّر حفظ التسعير",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const createTable = async (kind: "party-rates" | "flat" = "party-rates") => {
    setBusy(true);
    try {
      const created = await createPartyFeePricingTable(
        selectedCategory,
        kind === "flat"
          ? `حوافز موظفين ${tables.filter((t) => t.pricingKind === "flat").length + 1}`
          : defaultTableName(tables.length),
        kind === "flat" ? null : selectedId || null,
        kind === "flat"
          ? {
              pricingKind: "flat",
              managedBy: "supervisor",
              flatAmountSar: 0,
            }
          : undefined,
      );
      await refreshTables(selectedCategory, created.id);
      cacheTable(created);
      showToast(
        kind === "flat" ? "تم إنشاء جدول حوافز مقطوع" : "تم إنشاء جدول جديد",
        "success",
      );
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "تعذّر إنشاء الجدول",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const activate = async () => {
    if (!draft.id || draft.isActive) return;
    setBusy(true);
    try {
      const activated = await activatePartyFeePricingTable(draft.id);
      cacheTable(activated);
      await refreshTables(selectedCategory, activated.id);
      showToast("صار هذا الجدول هو الافتراضي للفئة", "success");
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "تعذّر تعيين الافتراضي",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const openAssign = () => {
    setAssignDraft([...(draft.assignedAssigneeIds ?? [])]);
    setAssignOpen(true);
  };

  const toggleAssignee = (id: string) => {
    setAssignDraft((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const saveAssignments = async () => {
    if (!draft.id) return;
    setBusy(true);
    try {
      const saved = await savePartyFeePricingAssignments(draft.id, assignDraft);
      cacheTable(saved);
      await refreshTables(selectedCategory, saved.id);
      setAssignOpen(false);
      showToast("تم حفظ الإسناد", "success");
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "تعذّر حفظ الإسناد",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const removeTable = async () => {
    if (!draft.id || tables.length <= 1) return;
    if (!window.confirm(`حذف جدول «${draft.name}»؟ لا يمكن التراجع.`)) return;
    setBusy(true);
    try {
      await deletePartyFeePricingTable(draft.id);
      queryClient.removeQueries({
        queryKey: partyFeePricingTableQueryKey(draft.id),
      });
      const nextId = await refreshTables(selectedCategory);
      if (nextId) await loadTable(nextId, selectedCategory);
      else {
        syncedDetailIdRef.current = "";
        setDraft(emptyDraft(selectedCategory));
      }
      showToast("تم حذف الجدول", "success");
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "تعذّر حذف الجدول",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const updateTier = (index: number, patch: Partial<PartyFeePricingTierDto>) => {
    setDraft((d) => {
      const next = d.areaTiers.map((t, i) =>
        i === index ? { ...t, ...patch } : t,
      );
      return { ...d, areaTiers: reindexTiers(next) };
    });
  };

  const updateTierFrom = (index: number, fromM2: number) => {
    if (index <= 0) return;
    setDraft((d) => {
      const next = d.areaTiers.map((t, i) =>
        i === index - 1 ? { ...t, maxAreaM2: fromM2 } : t,
      );
      return { ...d, areaTiers: reindexTiers(next) };
    });
  };

  const addTier = () => {
    setDraft((d) => {
      const closed = d.areaTiers.filter((t) => t.maxAreaM2 != null);
      const lastClosedMax =
        closed.length > 0
          ? Math.max(...closed.map((t) => t.maxAreaM2 ?? 0))
          : 500;
      const openFee =
        d.areaTiers.find((t) => t.maxAreaM2 == null)?.feeSar ?? 0;
      const next: PartyFeePricingTierDto[] = [
        ...closed,
        {
          sortOrder: closed.length,
          maxAreaM2: lastClosedMax + 500,
          feeSar: openFee,
        },
        { sortOrder: closed.length + 1, maxAreaM2: null, feeSar: openFee },
      ];
      return { ...d, areaTiers: reindexTiers(next) };
    });
  };

  const removeTier = (index: number) => {
    setDraft((d) => {
      if (d.areaTiers.length <= 1) return d;
      const next = d.areaTiers.filter((_, i) => i !== index);
      if (next.every((t) => t.maxAreaM2 != null)) {
        next[next.length - 1] = { ...next[next.length - 1], maxAreaM2: null };
      }
      return { ...d, areaTiers: reindexTiers(next) };
    });
  };

  const activeCategory = CATEGORIES.find((c) => c.id === selectedCategory);
  const hasAssignments = (draft.assignedCount ?? 0) > 0;
  /** Show held previous content while switching, or matched content when ready. */
  const showEditor = Boolean(draft.id) && (draftMatchesCategory || holdingPrevious);
  const showEmpty = !loading && !draft.id && !holdingPrevious;
  const selectValue =
    !loading && selectedId && tables.some((t) => t.id === selectedId)
      ? selectedId
      : "";

  return (
    <div className="w-full pb-10 sm:pb-12">
      {!canEdit ? (
        <p className={cn(opsTfNote, "m-0 mb-3.5")}>
          وضع العرض فقط — لا صلاحية للتعديل.
        </p>
      ) : null}

      {/* الفئة — أزرار مقسّمة بنمط المهام */}
      <div
        className={cn(opsTfSegRow, "mb-3.5")}
        role="tablist"
        aria-label="فئة التسعيرة"
      >
        {CATEGORIES.map((cat) => {
          const on = cat.id === selectedCategory;
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={on}
              disabled={busy || saving}
              onClick={() => selectCategory(cat.id)}
              className={on ? opsTfSegActive : opsTfSeg}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* بطاقة القسم — رأس فيه اختيار الجدول وأزرار الإنشاء */}
      <section className={opsLetterCard} aria-busy={loading || busy}>
        <div className={opsLetterHead}>
          <div className="flex items-center gap-[11px]">
            <span className={opsIconBoxGold}>
              <OpsIcon path={PRICING_ICON} />
            </span>
            <div>
              <div className={opsLetterTitle}>
                {activeCategory?.label ?? "التسعيرة"}
              </div>
              <div className={opsLetterSub}>{activeCategory?.hint}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 max-lg:w-full">
            <label className="sr-only" htmlFor="pricing-table-select">
              الجدول
            </label>
            <select
              id="pricing-table-select"
              className="min-h-11 w-full min-w-[210px] flex-1 rounded-[9px] border border-border-md bg-surface px-3 py-[9px] font-[inherit] text-[13px] font-medium text-text outline-none transition-[border-color,box-shadow] focus:border-gold focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--gold)_20%,transparent)] sm:w-auto"
              value={selectValue}
              disabled={
                loading || busy || tables.length === 0 || !draftMatchesCategory
              }
              onChange={(e) => void selectTable(e.target.value)}
            >
              {loading ? (
                <option value="">
                  جاري تحميل {activeCategory?.label ?? "الجداول"}…
                </option>
              ) : tables.length === 0 ? (
                <option value="">لا جداول بعد</option>
              ) : (
                tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name || "بدون اسم"}
                    {t.isActive ? " · افتراضي" : ""}
                    {(t.assignedCount ?? 0) > 0
                      ? ` · ${t.assignedCount} مسند`
                      : ""}
                  </option>
                ))
              )}
            </select>
            {canEdit ? (
              <>
                <button
                  type="button"
                  className={opsBtnGhost}
                  disabled={locked}
                  onClick={() => void createTable("party-rates")}
                >
                  ＋ جدول جديد
                </button>
                {selectedCategory === "field-inspector" && draftMatchesCategory ? (
                  <button
                    type="button"
                    className={opsBtnGhost}
                    disabled={locked}
                    onClick={() => void createTable("flat")}
                  >
                    جدول حوافز
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        <div className="min-h-[220px] px-4 pb-[18px] pt-4 sm:px-[18px]">
        {isInitialLoad ? (
          <div className="space-y-4 py-10" aria-live="polite">
            <div className="mx-auto h-3 w-32 animate-pulse rounded bg-surface-2" />
            <div className="mx-auto h-10 max-w-md animate-pulse rounded-lg bg-surface-2" />
            <div className="mx-auto h-10 max-w-md animate-pulse rounded-lg bg-surface-2" />
            <p className="m-0 pt-1 text-center text-[12px] text-text-3">
              جاري تحميل {activeCategory?.label ?? "التسعيرة"}…
            </p>
          </div>
        ) : showEmpty ? (
          <div
            key={`empty-${panelEpoch}`}
            className="py-12 text-center animate-[pricing-panel-in_0.28s_ease-out]"
          >
            <p className="m-0 text-[14px] font-medium text-text">
              لا يوجد جدول في هذه الفئة
            </p>
            {canEdit ? (
              <button
                type="button"
                className={cn(opsBtnPrimary, "mt-5")}
                disabled={locked}
                onClick={() => void createTable("party-rates")}
              >
                ＋ إنشاء أول جدول
              </button>
            ) : null}
          </div>
        ) : showEditor ? (
          <div
            key={`${draft.id}-${panelEpoch}`}
            className={cn(
              "transition-opacity duration-200 ease-out",
              holdingPrevious
                ? "pointer-events-none select-none opacity-45"
                : "animate-[pricing-panel-in_0.28s_ease-out] opacity-100",
            )}
          >
            {/* هوية الجدول */}
            <div className="space-y-5">
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor="pricing-name" className={opsTfLbl}>
                  اسم الجدول
                </label>
                <input
                  id="pricing-name"
                  className={cn(
                    opsFldControl,
                    "text-[15px] disabled:cursor-not-allowed disabled:opacity-60",
                  )}
                  value={draft.name}
                  readOnly={locked}
                  disabled={locked}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, name: e.target.value }))
                  }
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {draft.isActive ? (
                  <span className={opsPpBadge}>★ الافتراضي للفئة</span>
                ) : canEdit ? (
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => void activate()}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-[9px] border border-border-md bg-surface px-3.5 py-2 font-[inherit] text-[12.5px] font-semibold text-text-2 transition-colors enabled:hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    اجعله الافتراضي
                  </button>
                ) : null}

                {canEdit ? (
                  <button
                    type="button"
                    disabled={locked}
                    onClick={openAssign}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-[9px] border border-border-md bg-surface px-3.5 py-2 font-[inherit] text-[12.5px] font-semibold text-text-2 transition-colors enabled:hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    من يخصّه الجدول
                    {hasAssignments ? ` (${draft.assignedCount})` : ""}
                  </button>
                ) : null}

                {canEdit ? (
                  <button
                    type="button"
                    disabled={
                      locked || tables.length <= 1 || hasAssignments
                    }
                    onClick={() => void removeTable()}
                    className="ms-auto inline-flex cursor-pointer items-center rounded-[9px] border border-transparent bg-transparent px-3.5 py-2 font-[inherit] text-[12.5px] font-semibold text-[#d9694f] transition-colors enabled:hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    حذف الجدول
                  </button>
                ) : null}
              </div>

              {assignedNames.length > 0 ? (
                <p className={cn(opsTfNote, "m-0")}>
                  مسند إلى:{" "}
                  <span className="font-semibold text-heading">
                    {assignedNames.map((p) => p.name).join("، ")}
                  </span>
                </p>
              ) : contentCategory === "engineering-survey" ? (
                <p className="m-0 rounded-[10px] border border-dashed border-amber/50 bg-amber/10 px-3.5 py-3 text-[12.5px] leading-relaxed text-amber">
                  لم يُسند لأي مكتب — لن يُستخدم حتى تسنده من «من يخصّه الجدول».
                </p>
              ) : (
                <p className="m-0 text-[12px] leading-relaxed text-text-3">
                  بلا إسناد — يُستخدم الافتراضي عند الاحتساب.
                </p>
              )}
            </div>

            {/* الأسعار */}
            <div className="mt-6 space-y-5 border-t border-border pt-6">
              {hasAssignments ? (
                <p className={cn(opsTfNote, "m-0")}>
                  مرتبط بمستحقين: الحفظ ينشئ{" "}
                  <strong className="font-semibold text-heading">نسخة جديدة</strong>{" "}
                  وينقل الإسناد إليها (بدون كسر الأرقام السابقة).
                </p>
              ) : null}

              {contentCategory === "engineering-survey" ? (
                <>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="m-0 text-[13.5px] font-extrabold text-heading">
                        شرائح المساحة
                      </h2>
                      {canEdit ? (
                        <button
                          type="button"
                          disabled={locked}
                          onClick={addTier}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-[9px] border border-border-md bg-surface px-3.5 py-2 font-[inherit] text-[12.5px] font-semibold text-text-2 transition-colors enabled:hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          ＋ شريحة
                        </button>
                      ) : null}
                    </div>
                    <p className="m-0 text-[11.5px] leading-relaxed text-text-3">
                      من / حتى بالمتر، والسعر بالريال. الأخير = فأكثر.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {draft.areaTiers.map((tier, index) => {
                      const isLast = index === draft.areaTiers.length - 1;
                      return (
                        <div
                          key={`${tier.sortOrder}-${index}`}
                          className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2.5 rounded-[10px] border border-border bg-surface px-3.5 py-3.5 sm:gap-3.5 sm:px-4"
                        >
                          <div>
                            <span className={cn(opsTfLbl, "mb-1.5")}>
                              من
                            </span>
                            <MoneyInput
                              id={`tier-from-${index}`}
                              value={tierFromValue(draft.areaTiers, index)}
                              locked={locked || index === 0}
                              onChange={(n) => updateTierFrom(index, n)}
                            />
                          </div>
                          <div>
                            <span className={cn(opsTfLbl, "mb-1.5")}>
                              حتى
                            </span>
                            {isLast ? (
                              <div className="flex h-10 items-center text-[13px] font-medium text-text-2">
                                فأكثر
                              </div>
                            ) : (
                              <MoneyInput
                                id={`tier-max-${index}`}
                                value={tier.maxAreaM2 ?? 0}
                                locked={locked}
                                onChange={(n) =>
                                  updateTier(index, { maxAreaM2: n })
                                }
                              />
                            )}
                          </div>
                          <div>
                            <span className={cn(opsTfLbl, "mb-1.5")}>
                              أتعاب
                            </span>
                            <MoneyInput
                              id={`tier-fee-${index}`}
                              value={tier.feeSar}
                              locked={locked}
                              onChange={(n) =>
                                updateTier(index, { feeSar: n })
                              }
                            />
                          </div>
                          <div className="pb-0.5">
                            {canEdit ? (
                              <button
                                type="button"
                                title="حذف الشريحة"
                                disabled={
                                  locked || draft.areaTiers.length <= 1
                                }
                                onClick={() => removeTier(index)}
                                className="flex h-10 w-9 items-center justify-center rounded-md text-text-3 hover:bg-danger-bg hover:text-danger-text disabled:opacity-30"
                              >
                                ×
                              </button>
                            ) : (
                              <span className="inline-block w-9" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}

              {contentCategory === "court-visit" ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <h2 className="m-0 text-[13.5px] font-extrabold text-heading">
                      أتعاب زيارة المحكمة
                    </h2>
                    <p className="m-0 max-w-xl text-[11.5px] leading-relaxed text-text-3">
                      للمراجع المتعاون عند إكمال الزيارة. الموظف بلا أتعاب زيارة
                      هنا.
                    </p>
                  </div>
                  <FormGroup className="max-w-sm">
                    <label htmlFor="fee-court-visit" className={opsTfLbl}>
                      المبلغ (ر.س)
                    </label>
                    <MoneyInput
                      id="fee-court-visit"
                      value={draft.courtVisitFeeSar}
                      locked={locked}
                      onChange={(n) =>
                        setDraft((d) => ({ ...d, courtVisitFeeSar: n }))
                      }
                    />
                  </FormGroup>
                </div>
              ) : null}

              {contentCategory === "field-inspector" &&
              draft.pricingKind === "flat" ? (
                <div className="space-y-4">
                  <h2 className="m-0 text-[13.5px] font-extrabold text-heading">
                    حافز موظف (مقطوع)
                  </h2>
                  <FormGroup className="max-w-sm">
                    <label htmlFor="fee-flat" className={opsTfLbl}>
                      المبلغ (ر.س)
                    </label>
                    <MoneyInput
                      id="fee-flat"
                      value={draft.flatAmountSar ?? 0}
                      locked={locked}
                      onChange={(n) =>
                        setDraft((d) => ({ ...d, flatAmountSar: n }))
                      }
                    />
                  </FormGroup>
                </div>
              ) : null}

              {contentCategory === "field-inspector" &&
              draft.pricingKind !== "flat" ? (
                <div className="space-y-4">
                  <h2 className="m-0 text-[13.5px] font-extrabold text-heading">
                    أتعاب المعاين
                  </h2>
                  <div className="grid max-w-lg grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
                    <FormGroup>
                      <label htmlFor="fee-insp-ind" className={opsTfLbl}>
                        متعاون فرد (ر.س)
                      </label>
                      <MoneyInput
                        id="fee-insp-ind"
                        value={draft.fieldInspectorIndividualFeeSar}
                        locked={locked}
                        onChange={(n) =>
                          setDraft((d) => ({
                            ...d,
                            fieldInspectorIndividualFeeSar: n,
                          }))
                        }
                      />
                    </FormGroup>
                    <FormGroup>
                      <label htmlFor="fee-insp-org" className={opsTfLbl}>
                        منشأة (ر.س)
                      </label>
                      <MoneyInput
                        id="fee-insp-org"
                        value={draft.fieldInspectorOrganizationFeeSar}
                        locked={locked}
                        onChange={(n) =>
                          setDraft((d) => ({
                            ...d,
                            fieldInspectorOrganizationFeeSar: n,
                          }))
                        }
                      />
                    </FormGroup>
                  </div>
                </div>
              ) : null}
            </div>

            {/* حفظ واضح */}
            {canEdit ? (
              <div className={opsTfActions}>
                <button
                  type="button"
                  className={opsBtnPrimary}
                  disabled={locked || !draft.id}
                  aria-busy={saving || undefined}
                  data-no-action-toast
                  onClick={() => void save()}
                >
                  {saving ? <Spinner /> : null}
                  <span>
                    {saving
                      ? "جاري الحفظ…"
                      : hasAssignments
                        ? "✓ حفظ كنسخة جديدة"
                        : "✓ حفظ"}
                  </span>
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        </div>
      </section>

      {assignOpen ? (
        <ModalOverlay role="presentation" onClick={() => setAssignOpen(false)}>
          <ModalCard
            role="dialog"
            aria-modal="true"
            aria-labelledby="pricing-assign-title"
            className="max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <ModalHeader>
              <div className="min-w-0 flex-1">
                <ModalTitle id="pricing-assign-title">
                  من يخصّه «{draft.name}»
                </ModalTitle>
                <p className="m-0 mt-1 text-[12px] text-text-3">
                  {activeCategory?.partyLabel ?? "المستحقون"}
                </p>
              </div>
              <ModalClose onClick={() => setAssignOpen(false)} />
            </ModalHeader>
            <ModalBody className="max-h-[50vh] space-y-1 overflow-y-auto">
              {categoryParties.length === 0 ? (
                <Note tone="warn">
                  لا يوجد مستحقون لهذه الفئة (تحقق من معرّف التوزيع).
                </Note>
              ) : (
                categoryParties.map((party) => {
                  const checked = assignDraft.includes(party.id);
                  return (
                    <label
                      key={party.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 transition-colors",
                        checked
                          ? "border-gold-2 bg-gold-soft"
                          : "border-border hover:bg-surface-2",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-gold-d"
                        checked={checked}
                        onChange={() => toggleAssignee(party.id)}
                      />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold text-text">
                          {party.name}
                        </span>
                        {party.subtitle ? (
                          <span className="mt-0.5 block text-[11px] text-text-3">
                            {party.subtitle}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })
              )}
            </ModalBody>
            <ModalFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAssignOpen(false)}
              >
                إلغاء
              </Button>
              <Button
                type="button"
                variant="primary"
                loading={busy}
                showActionToast={false}
                onClick={() => void saveAssignments()}
              >
                تم
              </Button>
            </ModalFooter>
          </ModalCard>
        </ModalOverlay>
      ) : null}
    </div>
  );
}

