"use client";

/**
 * Brand-identity workflow — autosave like the valuers roster: size and margin edits save
 * after a short typing pause, uploads and resets save right after their confirmation. Each
 * card saves only its own fields, one save at a time, and reports its status. Letterhead
 * zoom lives in `useBrandLetterheadZoom`; pure decisions in `brand-identity-state.ts`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BRAND_IDENTITY_DEFAULTS,
  getOrganizationSettings,
  saveOrganizationSettings,
  type OrganizationBrandingSettings,
} from "@platform/api-client";
import { useCapability } from "@platform/app-shared/components/Can";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { todayIso } from "@platform/app-shared/format/date";
import { useToast } from "@platform/ui-kit";
import type { ConfirmActionSpec } from "../components/ConfirmActionModal";
import { refreshOrgCache } from "../lib/org-settings-ui";
import { organizationSettingsApiConfig } from "../lib/settings-api-config";
import {
  AUTOSAVE_DELAY_MS,
  BRAND_CARD_LABELS,
  BRAND_KEYS,
  BRAND_RESET_TARGETS,
  BRAND_UPLOAD_TARGETS,
  brandAssetView,
  cardSaveBlocker,
  cmFromInput,
  IDLE_SAVE_STATUS,
  isBrandCardDefault,
  letterheadMarginError,
  letterheadMetaText,
  lhFieldValue,
  LOAD_FAILED_MESSAGE,
  LOGIN_REQUIRED_MESSAGE,
  logoMetaText,
  resetConfirmCopy,
  resetToast,
  SAVE_FAILED_TOAST,
  stampMetaText,
  stampSizePatch,
  uploadConfirmCopy,
  uploadFileHint,
  uploadToast,
  withCardFields,
  type BrandChangeContext,
  type BrandKey,
  type BrandUploadTargetId,
  type CardSaveStatus,
} from "./brand-identity-state";
import { pickBrandImage } from "./brand-image-picker";
import { useBrandLetterheadZoom } from "./useBrandLetterheadZoom";

export type BrandIdentityWorkflow = ReturnType<typeof useBrandIdentityWorkflow>;

export function useBrandIdentityWorkflow() {
  const { showToast } = useToast();
  const canEdit = useCapability("manage-system-config");
  const { viewerDisplayName } = useAppAccess();
  const [brand, setBrand] = useState<OrganizationBrandingSettings>(BRAND_IDENTITY_DEFAULTS);
  const [saved, setSaved] = useState<OrganizationBrandingSettings>(BRAND_IDENTITY_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ConfirmActionSpec | null>(null);
  const [status, setStatus] = useState<Record<BrandKey, CardSaveStatus>>(IDLE_SAVE_STATUS);
  const [stampLocked, setStampLocked] = useState(true);
  const [stampRatio, setStampRatio] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Timers and queued saves run after later renders — they read the latest values from here.
  const latest = useRef({ brand, saved });
  latest.current = { brand, saved };
  const timers = useRef<Partial<Record<BrandKey, number>>>({});
  const revisions = useRef<Record<BrandKey, number>>({ logo: 0, stamp: 0, sig: 0, lh: 0 });
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const view = useMemo(() => brandAssetView(brand), [brand]);
  const busy = BRAND_KEYS.some((key) => ["pending", "saving"].includes(status[key].state));

  const setCardStatus = useCallback((key: BrandKey, next: CardSaveStatus) => {
    setStatus((s) => ({ ...s, [key]: next }));
  }, []);

  const zoom = useBrandLetterheadZoom({
    canEdit,
    onGuideCommitted: (key, value) => editCard("lh", { ...latest.current.brand, [key]: value }),
  });

  const reload = useCallback(async () => {
    const config = organizationSettingsApiConfig();
    if (!config) {
      setLoading(false);
      setError(LOGIN_REQUIRED_MESSAGE);
      return;
    }
    setLoading(true);
    const res = await getOrganizationSettings(config);
    setLoading(false);
    if (!res.ok) {
      setError(LOAD_FAILED_MESSAGE);
      return;
    }
    setError(null);
    setBrand(res.data.branding);
    setSaved(res.data.branding);
    setStatus(IDLE_SAVE_STATUS);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /**
   * Queue one card's save behind any save in flight, so every save starts from the
   * previous save's result. Returns whether it was saved.
   */
  function saveCard(
    key: BrandKey,
    options: { draft?: OrganizationBrandingSettings; toast?: string } = {},
  ): Promise<boolean> {
    const run = async () => {
      const draft = options.draft ?? latest.current.brand;
      const blocker = cardSaveBlocker(key, brandAssetView(draft));
      if (blocker) {
        setCardStatus(key, { state: "blocked", message: blocker });
        return false;
      }
      const config = organizationSettingsApiConfig();
      if (!config) return false;

      const revision = revisions.current[key];
      setCardStatus(key, { state: "saving" });
      const res = await saveOrganizationSettings(config, {
        branding: withCardFields(latest.current.saved, draft, key),
      });
      if (!res.ok) {
        const message = res.message ?? SAVE_FAILED_TOAST;
        setCardStatus(key, { state: "error", message });
        if (options.toast) showToast(message, "error");
        return false;
      }

      const server = res.data.branding;
      latest.current.saved = server;
      setSaved(server);
      // A newer edit to this card is already waiting for its own save — keep it.
      if (revisions.current[key] === revision) {
        setBrand((current) => withCardFields(current, server, key));
        setCardStatus(key, { state: "saved" });
      }
      await refreshOrgCache();
      if (options.toast) showToast(options.toast, "success");
      return true;
    };
    const next = queue.current.then(run, run);
    queue.current = next.catch(() => undefined);
    return next;
  }

  /** A size / margin edit: shown now, saved after the typing pause. */
  function editCard(key: BrandKey, next: OrganizationBrandingSettings) {
    latest.current.brand = next;
    setBrand(next);
    revisions.current[key] += 1;
    setCardStatus(key, { state: "pending" });
    window.clearTimeout(timers.current[key]);
    timers.current[key] = window.setTimeout(() => {
      delete timers.current[key];
      void saveCard(key);
    }, AUTOSAVE_DELAY_MS);
  }

  // Leaving the screen saves whatever is still waiting on its typing pause.
  useEffect(
    () => () => {
      for (const key of BRAND_KEYS) {
        if (timers.current[key] === undefined) continue;
        window.clearTimeout(timers.current[key]);
        void saveCard(key);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount flush reads refs only
    [],
  );

  // Closing or reloading the tab mid-save asks first.
  useEffect(() => {
    if (!busy) return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [busy]);

  function changeContext(): BrandChangeContext {
    return {
      today: todayIso(),
      actor: viewerDisplayName?.trim() || "مسؤول النظام",
      saved: latest.current.saved,
    };
  }

  /** Pick and check a file, show it, confirm, then save — cancel puts the card back. */
  function uploadAsset(id: BrandUploadTargetId) {
    if (!canEdit) return;
    pickBrandImage(id, (picked) => {
      if (!picked.ok) {
        showToast(picked.error, "error");
        return;
      }
      const target = BRAND_UPLOAD_TARGETS[id];
      const before = latest.current.brand;
      const statusBefore = status[target.key];
      const next = { ...before, ...target.patch(picked.dataUrl, changeContext()) };
      setBrand(next);
      if (id === "stamp") setStampRatio(null);
      setModal({
        ...uploadConfirmCopy(target.label, target.hint, uploadFileHint(picked.name, picked.kb)),
        onConfirm: () => {
          revisions.current[target.key] += 1;
          void saveCard(target.key, { draft: next, toast: uploadToast(target.label) });
        },
        onCancel: () => {
          setBrand((b) => withCardFields(b, before, target.key));
          setCardStatus(target.key, statusBefore);
        },
      });
    });
  }

  /** Put one card back to the system defaults — confirmed, then saved. */
  function resetAsset(key: BrandKey) {
    const label = BRAND_CARD_LABELS[key];
    setModal({
      ...resetConfirmCopy(label),
      danger: true,
      onConfirm: () => {
        window.clearTimeout(timers.current[key]);
        delete timers.current[key];
        const next = { ...latest.current.brand, ...BRAND_RESET_TARGETS[key](changeContext()) };
        latest.current.brand = next;
        setBrand(next);
        revisions.current[key] += 1;
        void saveCard(key, { draft: next, toast: resetToast(label) });
      },
    });
  }

  function setStampSize(axis: "width" | "height", raw: string) {
    const cm = cmFromInput(raw);
    if (cm == null) return;
    editCard("stamp", {
      ...brand,
      ...stampSizePatch(axis, cm, stampLocked ? stampRatio : null),
    });
  }

  function setSignatureHeight(raw: string) {
    const cm = cmFromInput(raw);
    if (cm == null) return;
    editCard("sig", { ...brand, signatureHeightCm: cm });
  }

  function patchLh(field: keyof OrganizationBrandingSettings, value: string) {
    editCard("lh", { ...brand, [field]: lhFieldValue(value) });
  }

  return {
    canEdit,
    brand,
    loading,
    error,
    status,
    busy,
    retrySave: (key: BrandKey) => void saveCard(key, { toast: "تم الحفظ." }),
    modal,
    closeModal: () => setModal(null),
    view,
    logoMeta: logoMetaText(brand),
    stampMeta: stampMetaText(brand),
    lhMeta: letterheadMetaText(brand),
    marginError: letterheadMarginError(view),
    isDefault: (key: BrandKey) => isBrandCardDefault(key, brand),
    uploadAsset,
    resetAsset,
    setStampSize,
    setSignatureHeight,
    patchLh,
    stampLocked,
    setStampLocked,
    stampRatio,
    onStampImageLoaded: (width: number, height: number) =>
      setStampRatio(width > 0 && height > 0 ? height / width : null),
    previewOpen,
    openPreview: () => setPreviewOpen(true),
    closePreview: () => setPreviewOpen(false),
    zoom,
  };
}
