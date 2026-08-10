"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  FormGroup,
  Input,
  Label,
  ModalBody,
  ModalCard,
  ModalClose,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Note,
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
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import {
  activatePartyFeePricingTable,
  createPartyFeePricingTable,
  deletePartyFeePricingTable,
  loadPartyFeePricingById,
  loadPartyFeePricingTables,
  revisePartyFeePricingConfig,
  savePartyFeePricingAssignments,
  savePartyFeePricingConfig,
} from "../lib/financial-api";

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
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      dir="ltr"
      readOnly={locked}
      disabled={locked}
      className={cn("text-start tabular-nums", className)}
      value={value === 0 ? "" : String(value)}
      placeholder="0"
      onChange={(e) => onChange(num(e.target.value))}
    />
  );
}

export function FinancePartyFeePricing() {
  const { showToast } = useToast();
  const isSystemAdmin = useCapability("manage-system-config");
  const canEditOps = useCapability("manage-operations");
  const canEditSpecialist = useCapability("manage-work-orders");
  /** مسؤول النظام · مشرف · أخصائي دراسة حالة */
  const canEdit = isSystemAdmin || canEditOps || canEditSpecialist;
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];
  const [selectedCategory, setSelectedCategory] =
    useState<PartyFeePricingCategory>("engineering-survey");
  const [tables, setTables] = useState<PartyFeePricingTableSummaryDto[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<PartyFeePricingDto>(
    emptyDraft("engineering-survey"),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignDraft, setAssignDraft] = useState<string[]>([]);
  /** After data lands, drive a short enter animation */
  const [panelEpoch, setPanelEpoch] = useState(0);
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

  const pickTableId = (
    list: PartyFeePricingTableSummaryDto[],
    preferId?: string,
  ) =>
    preferId && list.some((t) => t.id === preferId)
      ? preferId
      : (list.find((t) => t.isActive)?.id ?? list[0]?.id ?? "");

  const refreshTables = async (
    category: PartyFeePricingCategory,
    preferId?: string,
  ) => {
    const list = await loadPartyFeePricingTables(category);
    setTables(list);
    const nextId = pickTableId(list, preferId);
    setSelectedId(nextId);
    return nextId;
  };

  const loadTable = async (id: string, category: PartyFeePricingCategory) => {
    if (!id) {
      setDraft(emptyDraft(category));
      return;
    }
    setDraft(await loadPartyFeePricingById(id));
  };

  useEffect(() => {
    let cancelled = false;
    const category = selectedCategory;
    setLoading(true);

    void (async () => {
      try {
        const list = await loadPartyFeePricingTables(category);
        if (cancelled) return;
        setTables(list);
        const id = pickTableId(list);
        setSelectedId(id);
        if (id) {
          const detail = await loadPartyFeePricingById(id);
          if (cancelled) return;
          setDraft(detail);
        } else {
          setDraft(emptyDraft(category));
        }
        if (!cancelled) setPanelEpoch((n) => n + 1);
      } catch {
        if (!cancelled) showToast("تعذّر تحميل تسعير الأتعاب", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedCategory, showToast]);

  const selectCategory = (category: PartyFeePricingCategory) => {
    if (category === selectedCategory || busy || saving) return;
    // Do not wipe draft/tables — keep previous content for a smooth hold until fetch lands.
    setSelectedCategory(category);
    setLoading(true);
  };

  const selectTable = async (id: string) => {
    if (!id || id === selectedId || loading) return;
    setSelectedId(id);
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
      setDraft(saved);
      setTables((prev) =>
        prev.map((t) =>
          t.id === saved.id ? { ...t, name: saved.name, isActive: saved.isActive } : t,
        ),
      );
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
      setDraft(created);
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
      setDraft(activated);
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
      setDraft(saved);
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
      const nextId = await refreshTables(selectedCategory);
      if (nextId) await loadTable(nextId, selectedCategory);
      else setDraft(emptyDraft(selectedCategory));
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
    <div className="w-full pb-8">
      {/* رأس بسيط — خطوة واحدة واضحة */}
      <header className="mb-6 space-y-1">
        <h1 className="m-0 text-[1.35rem] font-bold tracking-tight text-heading">
          التسعيرة
        </h1>
        <p className="m-0 text-[13px] leading-relaxed text-text-2">
          اختر الفئة، عدّل الأسعار، احفظ. الإسناد للمستحقين اختياري من زر «من يخصّه
          الجدول».
        </p>
        {!canEdit ? (
          <p className="m-0 pt-1 text-[12px] text-text-3">
            وضع العرض فقط — لا صلاحية للتعديل.
          </p>
        ) : null}
      </header>

      {/* 1) الفئة — شريط أفقي بدل قائمة جانبية */}
      <div
        className="mb-5 flex flex-wrap gap-2"
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
              className={cn(
                "rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors duration-200 ease-out",
                on
                  ? "border-heading bg-heading text-white"
                  : "border-border bg-surface text-text-2 hover:border-border-md hover:bg-surface-2",
              )}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* 2) الجدول — صف واحد: قائمة + إضافة */}
      <div
        className={cn(
          "mb-5 flex flex-col gap-2 transition-opacity duration-200 sm:flex-row sm:items-center",
          holdingPrevious ? "opacity-55" : "opacity-100",
        )}
      >
        <label className="sr-only" htmlFor="pricing-table-select">
          الجدول
        </label>
        <select
          id="pricing-table-select"
          className={cn(
            "min-h-11 w-full flex-1 rounded-lg border border-border bg-surface px-3 text-[13px] font-medium text-text",
            "transition-[border-color,box-shadow] duration-200",
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
          )}
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
                {(t.assignedCount ?? 0) > 0 ? ` · ${t.assignedCount} مسند` : ""}
              </option>
            ))
          )}
        </select>
        {canEdit ? (
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={locked}
              onClick={() => void createTable("party-rates")}
            >
              جدول جديد
            </Button>
            {selectedCategory === "field-inspector" && draftMatchesCategory ? (
              <Button
                type="button"
                variant="ghost"
                disabled={locked}
                onClick={() => void createTable("flat")}
              >
                جدول حوافز
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* 3) مساحة العمل — hold + fade بدل skeleton عند التنقل */}
      <div
        className={cn(
          "relative min-h-[240px] overflow-hidden rounded-xl border border-border bg-surface",
          "transition-[box-shadow,border-color] duration-300 ease-out",
          holdingPrevious && "border-border-md shadow-none",
        )}
        aria-busy={loading || busy}
      >
        {isInitialLoad ? (
          <div className="space-y-3 px-5 py-10" aria-live="polite">
            <div className="mx-auto h-3 w-32 animate-pulse rounded bg-surface-2" />
            <div className="mx-auto h-10 max-w-md animate-pulse rounded-lg bg-surface-2" />
            <div className="mx-auto h-10 max-w-md animate-pulse rounded-lg bg-surface-2" />
            <p className="m-0 pt-2 text-center text-[12px] text-text-3">
              جاري تحميل {activeCategory?.label ?? "التسعيرة"}…
            </p>
          </div>
        ) : showEmpty ? (
          <div
            key={`empty-${panelEpoch}`}
            className="px-5 py-12 text-center animate-[pricing-panel-in_0.28s_ease-out]"
          >
            <p className="m-0 text-[14px] font-medium text-text">
              لا يوجد جدول في هذه الفئة
            </p>
            {canEdit ? (
              <Button
                type="button"
                variant="primary"
                className="mt-4"
                disabled={locked}
                onClick={() => void createTable("party-rates")}
              >
                إنشاء أول جدول
              </Button>
            ) : null}
          </div>
        ) : showEditor ? (
          <div
            key={`${draft.id}-${panelEpoch}`}
            className={cn(
              "divide-y divide-border transition-opacity duration-200 ease-out",
              holdingPrevious
                ? "pointer-events-none select-none opacity-45"
                : "animate-[pricing-panel-in_0.28s_ease-out] opacity-100",
            )}
          >
            {/* هوية الجدول */}
            <div className="space-y-4 px-5 py-5">
              <FormGroup>
                <Label
                  htmlFor="pricing-name"
                  className="mb-1.5 text-[12px] font-semibold text-text-2"
                >
                  اسم الجدول
                </Label>
                <Input
                  id="pricing-name"
                  className="text-[15px]"
                  value={draft.name}
                  readOnly={locked}
                  disabled={locked}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, name: e.target.value }))
                  }
                />
              </FormGroup>

              <div className="flex flex-wrap items-center gap-2">
                {draft.isActive ? (
                  <span className="rounded-md bg-success-bg px-2.5 py-1 text-[11px] font-semibold text-success">
                    الافتراضي للفئة
                  </span>
                ) : canEdit ? (
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => void activate()}
                    className="rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-text-2 hover:bg-surface-2 disabled:opacity-50"
                  >
                    اجعله الافتراضي
                  </button>
                ) : null}

                {canEdit ? (
                  <button
                    type="button"
                    disabled={locked}
                    onClick={openAssign}
                    className="rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-text-2 hover:bg-surface-2 disabled:opacity-50"
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
                    className="ms-auto rounded-md px-2.5 py-1 text-[11px] font-semibold text-danger-text hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    حذف الجدول
                  </button>
                ) : null}
              </div>

              {assignedNames.length > 0 ? (
                <p className="m-0 text-[12px] text-text-3">
                  مسند إلى: {assignedNames.map((p) => p.name).join("، ")}
                </p>
              ) : contentCategory === "engineering-survey" ? (
                <p className="m-0 text-[12px] text-amber">
                  لم يُسند لأي مكتب — لن يُستخدم حتى تسنده من «من يخصّه الجدول».
                </p>
              ) : (
                <p className="m-0 text-[12px] text-text-3">
                  بلا إسناد — يُستخدم الافتراضي عند الاحتساب.
                </p>
              )}
            </div>

            {/* الأسعار */}
            <div className="space-y-4 px-5 py-5">
              {hasAssignments ? (
                <p className="m-0 rounded-lg bg-surface-2 px-3 py-2.5 text-[12px] leading-relaxed text-text-2">
                  مرتبط بمستحقين: الحفظ ينشئ{" "}
                  <strong className="font-semibold">نسخة جديدة</strong> وينقل
                  الإسناد إليها (بدون كسر الأرقام السابقة).
                </p>
              ) : null}

              {contentCategory === "engineering-survey" ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="m-0 text-[14px] font-bold text-heading">
                      شرائح المساحة
                    </h2>
                    {canEdit ? (
                      <button
                        type="button"
                        disabled={locked}
                        onClick={addTier}
                        className="text-[12px] font-semibold text-primary hover:underline disabled:opacity-50"
                      >
                        + شريحة
                      </button>
                    ) : null}
                  </div>
                  <p className="m-0 -mt-2 text-[12px] text-text-3">
                    من / حتى بالمتر، والسعر بالريال. الأخير = فأكثر.
                  </p>

                  <div className="space-y-2">
                    {draft.areaTiers.map((tier, index) => {
                      const isLast = index === draft.areaTiers.length - 1;
                      return (
                        <div
                          key={`${tier.sortOrder}-${index}`}
                          className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2 rounded-lg border border-border bg-bg/40 px-3 py-3 sm:gap-3"
                        >
                          <div>
                            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-3">
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
                            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-3">
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
                            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-3">
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
                          <div className="pb-1">
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
                <>
                  <h2 className="m-0 text-[14px] font-bold text-heading">
                    أتعاب زيارة المحكمة
                  </h2>
                  <p className="m-0 -mt-2 text-[12px] text-text-3">
                    للمراجع المتعاون عند إكمال الزيارة. الموظف بلا أتعاب زيارة
                    هنا.
                  </p>
                  <FormGroup className="max-w-xs">
                    <Label
                      htmlFor="fee-court-visit"
                      className="mb-1.5 text-[12px] font-semibold text-text-2"
                    >
                      المبلغ (ر.س)
                    </Label>
                    <MoneyInput
                      id="fee-court-visit"
                      value={draft.courtVisitFeeSar}
                      locked={locked}
                      onChange={(n) =>
                        setDraft((d) => ({ ...d, courtVisitFeeSar: n }))
                      }
                    />
                  </FormGroup>
                </>
              ) : null}

              {contentCategory === "field-inspector" &&
              draft.pricingKind === "flat" ? (
                <>
                  <h2 className="m-0 text-[14px] font-bold text-heading">
                    حافز موظف (مقطوع)
                  </h2>
                  <FormGroup className="max-w-xs">
                    <Label
                      htmlFor="fee-flat"
                      className="mb-1.5 text-[12px] font-semibold text-text-2"
                    >
                      المبلغ (ر.س)
                    </Label>
                    <MoneyInput
                      id="fee-flat"
                      value={draft.flatAmountSar ?? 0}
                      locked={locked}
                      onChange={(n) =>
                        setDraft((d) => ({ ...d, flatAmountSar: n }))
                      }
                    />
                  </FormGroup>
                </>
              ) : null}

              {contentCategory === "field-inspector" &&
              draft.pricingKind !== "flat" ? (
                <>
                  <h2 className="m-0 text-[14px] font-bold text-heading">
                    أتعاب المعاين
                  </h2>
                  <div className="grid max-w-lg grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormGroup>
                      <Label
                        htmlFor="fee-insp-ind"
                        className="mb-1.5 text-[12px] font-semibold text-text-2"
                      >
                        متعاون فرد (ر.س)
                      </Label>
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
                      <Label
                        htmlFor="fee-insp-org"
                        className="mb-1.5 text-[12px] font-semibold text-text-2"
                      >
                        منشأة (ر.س)
                      </Label>
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
                </>
              ) : null}
            </div>

            {/* حفظ واضح */}
            {canEdit ? (
              <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-2/60 px-5 py-4">
                <p className="m-0 text-[12px] text-text-3">
                  {
                    CATEGORIES.find((c) => c.id === contentCategory)?.hint ??
                    activeCategory?.hint
                  }
                </p>
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  loading={saving}
                  disabled={locked || !draft.id}
                  showActionToast={false}
                  onClick={() => void save()}
                >
                  {hasAssignments ? "حفظ كنسخة جديدة" : "حفظ"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

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
                          ? "border-heading/30 bg-heading/5"
                          : "border-border hover:bg-surface-2",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="size-4"
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
