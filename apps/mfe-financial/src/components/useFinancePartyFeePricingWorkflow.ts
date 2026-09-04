"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@platform/ui-kit";
import { useCapability } from "@platform/app-shared/components/Can";
import type {
  PartyFeePricingCategory,
  PartyFeePricingDto,
  PartyFeePricingTierDto,
} from "@platform/api-client";
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
import {
  CATEGORIES,
  EMPTY_STAFF_USERS,
  EMPTY_TABLES,
  PRICING_STALE_MS,
  defaultTableName,
  emptyDraft,
  partiesForCategory,
  pickTableId,
  reindexTiers,
  tierFromValue,
} from "../lib/party-fee-pricing-state";

/**
 * Owns the party fee pricing screen: the table list and detail queries, the
 * editable draft, the tier edits and every write (save, revise, activate,
 * create, delete, assignments).
 */
export function useFinancePartyFeePricingWorkflow() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const isSystemAdmin = useCapability("manage-system-config");
  const canEditOps = useCapability("manage-operations");
  const canEditSpecialist = useCapability("manage-work-orders");
  /** System admin · supervisor · case-study specialist */
  const canEdit = isSystemAdmin || canEditOps || canEditSpecialist;
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? EMPTY_STAFF_USERS;
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
  const tables = tablesQuery.data ?? EMPTY_TABLES;

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

  /** Draft assignment membership — Set instead of includes in the render loop */
  const assignSet = useMemo(() => new Set(assignDraft), [assignDraft]);

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
  return {
    canEdit,
    tables,
    tablesQuery,
    selectedCategory,
    selectedId,
    draft,
    setDraft,
    saving,
    busy,
    loading,
    locked,
    panelEpoch,
    contentCategory,
    draftMatchesCategory,
    categoryParties,
    assignedNames,
    assignSet,
    assignOpen,
    setAssignOpen,
    holdingPrevious,
    isInitialLoad,
    activeCategory,
    hasAssignments,
    showEditor,
    showEmpty,
    selectValue,
    selectCategory,
    selectTable,
    save,
    createTable,
    activate,
    openAssign,
    toggleAssignee,
    saveAssignments,
    removeTable,
    updateTier,
    updateTierFrom,
    addTier,
    removeTier,
  };
}

export type FinancePartyFeePricingWorkflow = ReturnType<
  typeof useFinancePartyFeePricingWorkflow
>;
