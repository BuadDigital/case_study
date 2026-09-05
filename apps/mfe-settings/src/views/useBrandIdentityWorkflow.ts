"use client";

/**
 * Brand-identity workflow: load/save branding, per-asset dirty tracking,
 * confirm dialogs and the letterhead zoom/drag/pan interaction. Pure
 * decisions live in `brand-identity-state.ts`; regions render the bag.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  BRAND_IDENTITY_DEFAULTS,
  getOrganizationSettings,
  saveOrganizationSettings,
  type OrganizationBrandingSettings,
} from "@platform/api-client";
import { useCapability } from "@platform/app-shared/components/Can";
import { todayIso } from "@platform/app-shared/format/date";
import { useToast } from "@platform/ui-kit";
import type { ConfirmActionSpec } from "../components/ConfirmActionModal";
import { pickImage, refreshOrgCache } from "../lib/org-settings-ui";
import { organizationSettingsApiConfig } from "../lib/settings-api-config";
import {
  applyConfirmCopy,
  applyToast,
  BRAND_APPLY_TARGETS,
  BRAND_DELETE_TARGETS,
  BRAND_UPLOAD_TARGETS,
  brandAssetView,
  CLEAN_BRAND_DIRTY,
  DELETE_CONFIRM_COPY,
  DELETE_TOAST,
  dragToMm,
  isTypingTarget,
  letterheadMetaText,
  LH_GUIDES,
  lhFieldValue,
  lhGuidePercent,
  LOAD_FAILED_MESSAGE,
  LOGIN_REQUIRED_MESSAGE,
  logoMetaText,
  SAVE_FAILED_TOAST,
  stampMetaText,
  uploadConfirmCopy,
  uploadFileHint,
  uploadToast,
  type BrandDeleteTargetId,
  type BrandDirty,
  type BrandKey,
  type BrandUploadTargetId,
  type LhDragAxis,
  type LhGuideKey,
} from "./brand-identity-state";

export type BrandIdentityWorkflow = ReturnType<typeof useBrandIdentityWorkflow>;

export function useBrandIdentityWorkflow() {
  const { showToast } = useToast();
  const canEdit = useCapability("manage-system-config");
  const [brand, setBrand] = useState<OrganizationBrandingSettings>(
    BRAND_IDENTITY_DEFAULTS,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lhZoom, setLhZoom] = useState(false);
  const [lhPan, setLhPan] = useState(false);
  const [lhX, setLhX] = useState(0);
  const [lhY, setLhY] = useState(0);
  const [modal, setModal] = useState<ConfirmActionSpec | null>(null);
  const lhZoomRef = useRef<HTMLDivElement>(null);
  const lhPaperRef = useRef<HTMLDivElement>(null);
  const [dirty, setDirty] = useState<BrandDirty>(CLEAN_BRAND_DIRTY);

  const mark = useCallback((key: BrandKey, next: OrganizationBrandingSettings) => {
    setBrand(next);
    setDirty((d) => ({ ...d, [key]: true }));
  }, []);

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
    setDirty(CLEAN_BRAND_DIRTY);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Zoom mode: lock body scroll, hold Space to pan the page.
  useEffect(() => {
    if (!lhZoom) {
      setLhPan(false);
      return;
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTypingTarget(e.target)) return;
      e.preventDefault();
      if (!e.repeat) setLhPan(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTypingTarget(e.target)) return;
      e.preventDefault();
      setLhPan(false);
    };

    window.addEventListener("keydown", down, { capture: true });
    window.addEventListener("keyup", up, { capture: true });
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", down, { capture: true });
      window.removeEventListener("keyup", up, { capture: true });
    };
  }, [lhZoom]);

  async function persist(
    next: OrganizationBrandingSettings,
    key: BrandKey,
    toast: string,
  ) {
    const config = organizationSettingsApiConfig();
    if (!config) return;
    setSaving(true);
    const res = await saveOrganizationSettings(config, { branding: next });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? SAVE_FAILED_TOAST, "error");
      return;
    }
    setBrand(res.data.branding);
    setDirty((d) => ({ ...d, [key]: false }));
    await refreshOrgCache();
    showToast(toast, "success");
  }

  /** "اعتماد وتطبيق" on one card — payload is built now, persisted on confirm. */
  function applyAsset(key: BrandKey) {
    const target = BRAND_APPLY_TARGETS[key];
    const next = target.payload(brand, todayIso());
    setModal({
      ...applyConfirmCopy(target.label, target.hint),
      onConfirm: () => void persist(next, key, applyToast(target.label)),
    });
  }

  /** Pick a file, show it immediately (dirty), then confirm before persisting. */
  function uploadAsset(id: BrandUploadTargetId) {
    pickImage((url, name, kb) => {
      const target = BRAND_UPLOAD_TARGETS[id];
      const next = { ...brand, ...target.patch(url, todayIso()) };
      setBrand(next);
      setDirty((d) => ({ ...d, [target.key]: true }));
      setModal({
        ...uploadConfirmCopy(target.label, target.hint, uploadFileHint(name, kb)),
        onConfirm: () => void persist(next, target.key, uploadToast(target.label)),
      });
    });
  }

  function deleteAsset(id: BrandDeleteTargetId) {
    const { key, patch } = BRAND_DELETE_TARGETS[id];
    setModal({
      ...DELETE_CONFIRM_COPY,
      onConfirm: () => {
        const next = { ...brand, ...patch };
        void persist(next, key, DELETE_TOAST);
      },
    });
  }

  /** Marks one card dirty with a partial branding patch (stamp / signature sizes). */
  function patchAsset(key: BrandKey, patch: Partial<OrganizationBrandingSettings>) {
    mark(key, { ...brand, ...patch });
  }

  function patchLh(field: keyof OrganizationBrandingSettings, value: string) {
    mark("lh", { ...brand, [field]: lhFieldValue(value) });
  }

  function paintLhGuide(key: LhGuideKey, n: number) {
    const root = lhZoomRef.current;
    if (!root) return;
    root.style.setProperty(LH_GUIDES[key].cssVar, lhGuidePercent(key, n));
    const field = root.querySelector<HTMLInputElement>(`[data-lh-input="${key}"]`);
    if (field) field.value = String(n);
  }

  function startDrag(
    ev: ReactMouseEvent<HTMLDivElement>,
    key: LhGuideKey,
    axis: LhDragAxis,
  ) {
    ev.preventDefault();
    const box = ev.currentTarget.parentElement?.getBoundingClientRect();
    if (!box) return;
    let dragged = 0;
    let moved = false;
    const move = (e: MouseEvent) => {
      dragged = dragToMm(axis, e.clientX, e.clientY, box);
      moved = true;
      paintLhGuide(key, dragged);
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      if (!moved) return;
      setBrand((b) => ({ ...b, [key]: dragged }));
      setDirty((d) => ({ ...d, lh: true }));
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  function startPan(ev: ReactMouseEvent) {
    ev.preventDefault();
    const sx = ev.clientX;
    const sy = ev.clientY;
    const ox = lhX;
    const oy = lhY;
    let nx = ox;
    let ny = oy;
    const move = (e: MouseEvent) => {
      nx = ox + (e.clientX - sx);
      ny = oy + (e.clientY - sy);
      const paper = lhPaperRef.current;
      if (paper) paper.style.transform = `translate(${nx}px, ${ny}px)`;
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      setLhX(nx);
      setLhY(ny);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  function openZoom() {
    setLhZoom(true);
    setLhX(0);
    setLhY(0);
  }

  function closeZoom() {
    setLhPan(false);
    setLhZoom(false);
  }

  return {
    canEdit,
    brand,
    loading,
    saving,
    error,
    dirty,
    modal,
    closeModal: () => setModal(null),
    view: brandAssetView(brand),
    logoMeta: logoMetaText(brand),
    stampMeta: stampMetaText(brand),
    lhMeta: letterheadMetaText(brand),
    applyAsset,
    uploadAsset,
    deleteAsset,
    patchAsset,
    patchLh,
    lhZoom,
    lhPan,
    lhX,
    lhY,
    lhZoomRef,
    lhPaperRef,
    openZoom,
    closeZoom,
    startDrag,
    startPan,
  };
}
