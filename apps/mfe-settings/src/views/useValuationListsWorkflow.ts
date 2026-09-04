"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getOrganizationSettings,
  getValuationLists,
  saveOrganizationSettings,
  saveValuationLists,
  type OrganizationSettingsDto,
  type ValuationListItemDto,
  type ValuationListsDto,
} from "@platform/api-client";
import { useToast } from "@platform/ui-kit";

import { organizationSettingsApiConfig } from "../lib/settings-api-config";
import {
  TABLE_META,
  TABS,
  buildNewItem,
  emptyAddDraft,
  type AddItemDraft,
} from "../lib/valuation-lists-view-state";

/**
 * Owns the valuation lists screen: the catalogue and organization settings
 * load, the debounced autosave, row edits with their confirm modal, and the
 * add-item flow.
 */
export function useValuationListsWorkflow() {
  const { showToast } = useToast();
  const [tab, setTab] = useState("purposes");
  const [catalog, setCatalog] = useState<ValuationListsDto | null>(null);
  const [org, setOrg] = useState<OrganizationSettingsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [modal, setModal] = useState<{
    title: string;
    body: string;
    confirm: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addDraft, setAddDraft] = useState<AddItemDraft>(() => emptyAddDraft("purposes"));
  const [addSaving, setAddSaving] = useState(false);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const reload = useCallback(async () => {
    const config = organizationSettingsApiConfig();
    if (!config) {
      setLoading(false);
      setError("يلزم تسجيل الدخول");
      return;
    }
    setLoading(true);
    const [listsRes, orgRes] = await Promise.all([
      getValuationLists(config),
      getOrganizationSettings(config),
    ]);
    setLoading(false);
    if (!listsRes.ok) {
      setError("تعذّر تحميل قوائم التقييم");
      return;
    }
    setError(null);
    setCatalog(listsRes.data);
    if (orgRes.ok) setOrg(orgRes.data);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const meta = TABS.find((t) => t.id === tab) ?? TABS[0];
  const tableMeta = TABLE_META[tab];
  const rows = catalog?.lists[tab] ?? [];

  function patchList(listId: string, nextRows: ValuationListItemDto[]) {
    if (!catalog) return;
    scheduleAutosave({
      ...catalog,
      lists: { ...catalog.lists, [listId]: nextRows },
    });
  }

  function scheduleAutosave(next: ValuationListsDto) {
    setCatalog(next);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persistCatalog(next, { quiet: true });
    }, 400);
  }

  async function persistCatalog(
    next: ValuationListsDto,
    options?: { quiet?: boolean },
  ): Promise<boolean> {
    const config = organizationSettingsApiConfig();
    if (!config) return false;
    setSaving(true);
    const res = await saveValuationLists(config, {
      ivsEffectiveDate: next.ivsEffectiveDate,
      photoPagesLand: next.photoPagesLand,
      photoPagesBuilt: next.photoPagesBuilt,
      lists: next.lists,
    });
    setSaving(false);
    if (!res.ok) {
      showToast("تعذّر حفظ قوائم التقييم", "error");
      return false;
    }
    setCatalog(res.data);
    if (!options?.quiet) showToast("تم الحفظ", "success");
    return true;
  }

  function patchRow(id: string, patch: Partial<ValuationListItemDto>) {
    patchList(
      tab,
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function openAddModal() {
    setAddDraft(emptyAddDraft(tab));
    setAddModalOpen(true);
  }

  async function confirmAddItem() {
    if (!catalog || !tableMeta) return;
    const name = addDraft.name.trim();
    if (!name) {
      showToast("أدخل الاسم قبل الحفظ", "error");
      return;
    }
    const newItem = buildNewItem(tab, addDraft, rows.length + 1);
    const next: ValuationListsDto = {
      ...catalog,
      lists: { ...catalog.lists, [tab]: [...rows, newItem] },
    };
    setAddSaving(true);
    const ok = await persistCatalog(next);
    setAddSaving(false);
    if (ok) setAddModalOpen(false);
  }

  async function removeRow(row: ValuationListItemDto) {
    if (!catalog) return;
    const next: ValuationListsDto = {
      ...catalog,
      lists: {
        ...catalog.lists,
        [tab]: rows.filter((r) => r.id !== row.id),
      },
    };
    await persistCatalog(next);
  }

  function requestDeleteRow(row: ValuationListItemDto) {
    const doDelete = () => void removeRow(row);
    if (row.usage > 0) {
      setModal({
        title: "حذف عنصر مستعمَل",
        body: `«${row.name}» مستعمَل في ${row.usage} معاملة. الحذف نهائي ولا يمكن التراجع عنه.`,
        confirm: "حذف",
        onConfirm: doDelete,
      });
      return;
    }
    if (row.isSystemDefault) {
      setModal({
        title: "حذف عنصر افتراضي",
        body: `«${row.name}» عنصر افتراضي في النظام. هل تريد حذفه نهائياً؟`,
        confirm: "حذف",
        onConfirm: doDelete,
      });
      return;
    }
    doDelete();
  }

  async function persistOrg(next: OrganizationSettingsDto) {
    const config = organizationSettingsApiConfig();
    if (!config) return;
    setSaving(true);
    const res = await saveOrganizationSettings(config, {
      evaluator: next.evaluator,
      valuers: next.valuers,
      valuationReport: next.valuationReport,
    });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ سجل المقيّمين", "error");
      return;
    }
    setOrg(res.data);
    showToast("تم الحفظ", "success");
  }

  return {
    tab,
    setTab,
    meta,
    tableMeta,
    catalog,
    org,
    rows,
    loading,
    saving,
    error,
    modal,
    setModal,
    addModalOpen,
    setAddModalOpen,
    addDraft,
    setAddDraft,
    addSaving,
    scheduleAutosave,
    patchRow,
    openAddModal,
    confirmAddItem,
    requestDeleteRow,
    persistOrg,
    persistCatalog,
  };
}

export type ValuationListsWorkflow = ReturnType<typeof useValuationListsWorkflow>;
