"use client";

/**
 * Organization-settings workflow: tab routing via `?tab=` and draft load /
 * save. Pure mapping lives in
 * `organization-settings-state.ts`.
 */

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  getOrganizationSettings,
  saveOrganizationSettings,
  type OrganizationSettingsDto,
} from "@platform/api-client";
import { useCapability } from "@platform/app-shared/components/Can";
import { useToast } from "@platform/ui-kit";
import { refreshOrgCache } from "../lib/org-settings-ui";
import { apiConfig } from "@platform/app-shared/auth/api-config";
import {
  buildSettingsSavePayload,
  emptySettings,
  loadErrorMessage,
  LOGIN_REQUIRED_MESSAGE,
  SAVE_SUCCESS_TOAST,
  saveErrorMessage,
  tabFromSearch,
} from "./organization-settings-state";

export type OrganizationSettingsWorkflow = ReturnType<
  typeof useOrganizationSettingsWorkflow
>;

export function useOrganizationSettingsWorkflow() {
  const { showToast } = useToast();
  const canEdit = useCapability("manage-system-config");
  const searchParams = useSearchParams();
  const tab = tabFromSearch(searchParams.get("tab"));
  const [draft, setDraft] = useState<OrganizationSettingsDto>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const config = apiConfig();
    if (!config) {
      setLoading(false);
      setLoadError(LOGIN_REQUIRED_MESSAGE);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const result = await getOrganizationSettings(config);
    if (!result.ok) {
      setLoadError(loadErrorMessage(result.kind));
      setLoading(false);
      return;
    }
    setDraft(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function patchSla(patch: Partial<OrganizationSettingsDto["sla"]>) {
    setDraft((d) => ({ ...d, sla: { ...d.sla, ...patch } }));
  }

  function patchValuation(patch: Partial<OrganizationSettingsDto["valuation"]>) {
    setDraft((d) => ({ ...d, valuation: { ...d.valuation, ...patch } }));
  }

  async function onSave() {
    const config = apiConfig();
    if (!config) return;
    setSaving(true);
    try {
      const result = await saveOrganizationSettings(
        config,
        buildSettingsSavePayload(draft),
      );
      if (!result.ok) {
        showToast(saveErrorMessage(result), "error");
        return;
      }
      setDraft(result.data);
      await refreshOrgCache();
      showToast(SAVE_SUCCESS_TOAST, "success");
    } finally {
      setSaving(false);
    }
  }

  return {
    canEdit,
    tab,
    draft,
    loading,
    saving,
    loadError,
    patchSla,
    patchValuation,
    onSave,
  };
}
