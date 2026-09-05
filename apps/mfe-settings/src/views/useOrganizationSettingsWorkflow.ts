"use client";

/**
 * Organization-settings workflow: tab routing via `?tab=`, draft load / save
 * and the communications test. Pure mapping lives in
 * `organization-settings-state.ts`.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getOrganizationSettings,
  saveOrganizationSettings,
  testOrganizationCommunication,
  type OrganizationSettingsDto,
} from "@platform/api-client";
import { useCapability } from "@platform/app-shared/components/Can";
import { useToast } from "@platform/ui-kit";
import { refreshOrgCache } from "../lib/org-settings-ui";
import { organizationSettingsApiConfig } from "../lib/settings-api-config";
import {
  buildSettingsSavePayload,
  communicationTestToast,
  emptySettings,
  loadErrorMessage,
  LOGIN_REQUIRED_MESSAGE,
  SAVE_SUCCESS_TOAST,
  saveErrorMessage,
  tabFromSearch,
  tabHref,
  TEST_FAILED_TOAST,
  type TabId,
} from "./organization-settings-state";

export type OrganizationSettingsWorkflow = ReturnType<
  typeof useOrganizationSettingsWorkflow
>;

export function useOrganizationSettingsWorkflow() {
  const { showToast } = useToast();
  const canEdit = useCapability("manage-system-config");
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = tabFromSearch(searchParams.get("tab"));
  const setTab = useCallback(
    (id: TabId) => {
      router.replace(tabHref(id), { scroll: false });
    },
    [router],
  );
  const [draft, setDraft] = useState<OrganizationSettingsDto>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [testDestination, setTestDestination] = useState("");
  const [testing, setTesting] = useState(false);

  const refresh = useCallback(async () => {
    const config = organizationSettingsApiConfig();
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

  function patchCommunications(
    patch: Partial<OrganizationSettingsDto["communications"]>,
  ) {
    setDraft((d) => ({ ...d, communications: { ...d.communications, ...patch } }));
  }

  function patchSla(patch: Partial<OrganizationSettingsDto["sla"]>) {
    setDraft((d) => ({ ...d, sla: { ...d.sla, ...patch } }));
  }

  function patchValuation(patch: Partial<OrganizationSettingsDto["valuation"]>) {
    setDraft((d) => ({ ...d, valuation: { ...d.valuation, ...patch } }));
  }

  async function onSave() {
    const config = organizationSettingsApiConfig();
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

  async function runTest() {
    const config = organizationSettingsApiConfig();
    if (!config || !testDestination.trim()) return;
    setTesting(true);
    try {
      const result = await testOrganizationCommunication(config, {
        channel: draft.communications.defaultOtpChannel || "sms",
        destination: testDestination.trim(),
      });
      if (!result.ok) {
        showToast(result.message ?? TEST_FAILED_TOAST, "error");
        return;
      }
      const toast = communicationTestToast(result.data);
      showToast(toast.text, toast.tone);
    } finally {
      setTesting(false);
    }
  }

  return {
    canEdit,
    tab,
    setTab,
    draft,
    loading,
    saving,
    loadError,
    testDestination,
    setTestDestination,
    testing,
    patchCommunications,
    patchSla,
    patchValuation,
    onSave,
    runTest,
  };
}
