"use client";

/**
 * Valuers-roster workflow: load the organization, derive editable rows,
 * guard role / remove actions, and persist through the organization
 * settings endpoint. Pure rules live in `valuers-roster-state.ts`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getOrganizationSettings,
  saveOrganizationSettings,
  type OrganizationSettingsDto,
  type OrganizationValuerRosterEntry,
} from "@platform/api-client";
import { useCapability } from "@platform/app-shared/components/Can";
import { todayIso } from "@platform/app-shared/format/date";
import { useToast } from "@platform/ui-kit";
import type { ConfirmActionSpec } from "../components/ConfirmActionModal";
import { pickImage, refreshOrgCache } from "../lib/org-settings-ui";
import { organizationSettingsApiConfig } from "../lib/settings-api-config";
import {
  buildRosterSavePayload,
  CERTIFIED_REMOVE_BLOCKED,
  certBlockMessage,
  deleteRowCopy,
  disableRowCopy,
  discardEditCopy,
  filterRoster,
  FINISH_EDIT_BEFORE_ADD,
  finishEditBlockedMessage,
  incompleteActiveRows,
  incompleteBeforeAddMessage,
  initialRows,
  newValuer,
  removeNewRowCopy,
  rolePatchGuard,
  ROSTER_TOASTS,
  rostersEqual,
  sigOk,
  signatureUploadCopy,
} from "./valuers-roster-state";

export type ValuersRosterWorkflow = ReturnType<typeof useValuersRosterWorkflow>;

export function useValuersRosterWorkflow() {
  const { showToast } = useToast();
  const canEdit = useCapability("manage-system-config");
  const [org, setOrg] = useState<OrganizationSettingsDto | null>(null);
  const [rows, setRows] = useState<OrganizationValuerRosterEntry[]>([]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const [baseline, setBaseline] = useState<OrganizationValuerRosterEntry[]>([]);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ConfirmActionSpec | null>(null);

  const mark = (next: OrganizationValuerRosterEntry[]) => {
    setRows(next);
    setDirty(!rostersEqual(next, baseline));
  };

  /** Server truth wins: rebuild rows + baseline from the returned organization. */
  const adoptSaved = useCallback((data: OrganizationSettingsDto) => {
    setOrg(data);
    const next = initialRows(data);
    setRows(next);
    setBaseline(next.map((r) => ({ ...r })));
    setDirty(false);
    setEditingId(null);
  }, []);

  const reload = useCallback(async () => {
    const config = organizationSettingsApiConfig();
    if (!config) {
      setLoading(false);
      setError(ROSTER_TOASTS.loginRequired);
      return;
    }
    setLoading(true);
    const res = await getOrganizationSettings(config);
    setLoading(false);
    if (!res.ok) {
      setError(ROSTER_TOASTS.loadFailed);
      return;
    }
    setError(null);
    adoptSaved(res.data);
  }, [adoptSaved]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const certifiedHolderId = useMemo(
    () => rows.find((v) => v.role === "certified")?.id ?? null,
    [rows],
  );

  const patch = (id: string, next: Partial<OrganizationValuerRosterEntry>) => {
    const blocked = rolePatchGuard(rows, id, next);
    if (blocked) {
      showToast(blocked, "error");
      return;
    }
    mark(rows.map((v) => (v.id === id ? { ...v, ...next } : v)));
  };

  const isNewRow = (id: string) => !baseline.some((b) => b.id === id);

  const discardOrRemove = (id: string): OrganizationValuerRosterEntry[] => {
    const saved = baseline.find((b) => b.id === id);
    if (!saved) {
      const next = rows.filter((r) => r.id !== id);
      mark(next);
      if (editingId === id) setEditingId(null);
      return next;
    }
    const next = rows.map((r) => (r.id === id ? { ...saved } : r));
    mark(next);
    if (editingId === id) setEditingId(null);
    return next;
  };

  const confirmDiscardOrRemove = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const isNew = isNewRow(id);
    const isEditing = editingId === id;

    if (!isNew && !isEditing && row.role === "certified") {
      showToast(CERTIFIED_REMOVE_BLOCKED, "error");
      return;
    }

    if (isNew) {
      setModal({
        ...removeNewRowCopy(row.nameAr),
        onConfirm: () => {
          const next = discardOrRemove(id);
          void persistRows(next);
        },
      });
      return;
    }

    if (isEditing) {
      setModal({
        ...discardEditCopy(row.nameAr),
        onConfirm: () => {
          discardOrRemove(id);
        },
      });
      return;
    }

    setModal({
      ...deleteRowCopy(row.nameAr),
      onConfirm: () => {
        const next = rows.filter((r) => r.id !== id);
        if (editingId === id) setEditingId(null);
        void persistRows(next);
      },
    });
  };

  const visible = useMemo(() => filterRoster(rows, query), [rows, query]);

  const today = todayIso();
  const certMsg = certBlockMessage(rows, today);

  const incompleteActive = useMemo(
    () => incompleteActiveRows(rows, today),
    [rows, today],
  );

  const canAddValuer = incompleteActive.length === 0 && editingId == null;

  function tryAddValuer() {
    if (editingId) {
      showToast(FINISH_EDIT_BEFORE_ADD, "error");
      return;
    }
    if (incompleteActive.length > 0) {
      showToast(incompleteBeforeAddMessage(incompleteActive, today), "error");
      return;
    }
    const row = newValuer();
    mark([...rows, row]);
    setEditingId(row.id);
  }

  async function persistRows(
    nextRows: OrganizationValuerRosterEntry[],
    successToast: string = ROSTER_TOASTS.saved,
  ) {
    const config = organizationSettingsApiConfig();
    if (!config || !org) return false;
    setSaving(true);
    const res = await saveOrganizationSettings(
      config,
      buildRosterSavePayload(org, nextRows),
    );
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? ROSTER_TOASTS.saveFailed, "error");
      return false;
    }
    adoptSaved(res.data);
    await refreshOrgCache();
    showToast(successToast, "success");
    return true;
  }

  function finishEdit(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) {
      setEditingId(null);
      return;
    }
    const blocked = finishEditBlockedMessage(row, today);
    if (blocked) {
      showToast(blocked, "error");
      return;
    }
    void persistRows(rows, ROSTER_TOASTS.rowSaved);
  }

  /** "تم" while editing saves the row; "تعديل" opens it. */
  function toggleEdit(id: string) {
    if (editingId === id) finishEdit(id);
    else setEditingId(id);
  }

  function toggleActive(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const nextRows = rows.map((v) =>
      v.id === id ? { ...v, isActive: !v.isActive } : v,
    );
    void persistRows(
      nextRows,
      row.isActive ? ROSTER_TOASTS.disabled : ROSTER_TOASTS.enabled,
    );
  }

  /** Disabling asks first; enabling saves straight away. */
  function confirmToggleActive(row: OrganizationValuerRosterEntry) {
    if (row.isActive) {
      setModal({
        ...disableRowCopy(row.nameAr),
        onConfirm: () => toggleActive(row.id),
      });
    } else {
      toggleActive(row.id);
    }
  }

  function uploadSignature(row: OrganizationValuerRosterEntry) {
    pickImage((url, name, kb) => {
      const valuerId = row.id;
      setModal({
        ...signatureUploadCopy(row.nameAr, sigOk(row), name, kb),
        onConfirm: () => {
          // Latest rows — avoid an upload race that drops other signatures.
          const nextRows = rowsRef.current.map((r) =>
            r.id === valuerId ? { ...r, signatureUrl: url } : r,
          );
          void persistRows(nextRows, ROSTER_TOASTS.signatureSaved);
        },
      });
    });
  }

  return {
    canEdit,
    loading,
    saving,
    dirty,
    error,
    certMsg,
    today,
    query,
    setQuery,
    visible,
    editingId,
    certifiedHolderId,
    canAddValuer,
    tryAddValuer,
    patch,
    isNewRow,
    toggleEdit,
    confirmToggleActive,
    confirmDiscardOrRemove,
    uploadSignature,
    modal,
    closeModal: () => setModal(null),
  };
}
