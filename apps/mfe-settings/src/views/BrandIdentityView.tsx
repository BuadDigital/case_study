"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BRAND_IDENTITY_DEFAULTS,
  getOrganizationSettings,
  saveOrganizationSettings,
  type OrganizationBrandingSettings,
} from "@platform/api-client";
import { Can, useCapability } from "@platform/app-shared/components/Can";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Label,
  ModalBody,
  ModalCard,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Note,
  PageShell,
  Spinner,
  cn,
  useToast,
} from "@platform/ui-kit";
import { organizationSettingsApiConfig } from "../lib/settings-api-config";

type BrandKey = "logo" | "stamp" | "sig" | "lh";

const D = BRAND_IDENTITY_DEFAULTS;

function filled(value: string | null | undefined, fallback: string): string {
  return value?.trim() ? value : fallback;
}

function mm(n: number | null | undefined, fallback: number): number {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function pickImage(onPicked: (dataUrl: string, name: string, kb: number) => void): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/svg+xml";
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onPicked(reader.result, file.name, Math.round(file.size / 1024));
      }
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

export function BrandIdentityView() {
  const { showToast } = useToast();
  const canEdit = useCapability("manage-system-config");
  const [brand, setBrand] = useState<OrganizationBrandingSettings>(D);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lhZoom, setLhZoom] = useState(false);
  const [lhPan, setLhPan] = useState(false);
  const [lhX, setLhX] = useState(0);
  const [lhY, setLhY] = useState(0);
  const [modal, setModal] = useState<{
    title: string;
    body: string;
    confirm: string;
    onConfirm: () => void;
  } | null>(null);
  const dirtyRef = useRef({ logo: false, stamp: false, sig: false, lh: false });
  const [dirty, setDirty] = useState({ logo: false, stamp: false, sig: false, lh: false });

  const mark = useCallback((key: BrandKey, next: OrganizationBrandingSettings) => {
    setBrand(next);
    setDirty((d) => ({ ...d, [key]: true }));
    dirtyRef.current = { ...dirtyRef.current, [key]: true };
  }, []);

  const reload = useCallback(async () => {
    const config = organizationSettingsApiConfig();
    if (!config) {
      setLoading(false);
      setError("يلزم تسجيل الدخول");
      return;
    }
    setLoading(true);
    const res = await getOrganizationSettings(config);
    setLoading(false);
    if (!res.ok) {
      setError("تعذّر تحميل الهوية البصرية");
      return;
    }
    setError(null);
    setBrand(res.data.branding);
    setDirty({ logo: false, stamp: false, sig: false, lh: false });
    dirtyRef.current = { logo: false, stamp: false, sig: false, lh: false };
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!lhZoom) {
      setLhPan(false);
      return;
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const typing = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
    };

    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || typing(e.target)) return;
      e.preventDefault();
      if (!e.repeat) setLhPan(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || typing(e.target)) return;
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
      showToast(res.message ?? "تعذّر اعتماد الأصل", "error");
      return;
    }
    setBrand(res.data.branding);
    setDirty((d) => ({ ...d, [key]: false }));
    dirtyRef.current = { ...dirtyRef.current, [key]: false };
    const { clearOrganizationSettingsCache, ensureOrganizationSettingsLoaded } =
      await import("@platform/app-shared/organization/organization-settings-cache");
    clearOrganizationSettingsCache();
    await ensureOrganizationSettingsLoaded();
    showToast(toast, "success");
  }

  function confirmApply(key: BrandKey, label: string, hint: string, next: OrganizationBrandingSettings) {
    setModal({
      title: `اعتماد ${label}`,
      body: `${hint} التقارير السابقة تحتفظ بنسختها، والإجراء يُقيَّد في سجل التدقيق.`,
      confirm: "اعتماد وتطبيق",
      onConfirm: () => void persist(next, key, `تم اعتماد ${label} وتطبيقه.`),
    });
  }

  function confirmUpload(
    key: BrandKey,
    label: string,
    hint: string,
    fileHint: string,
    patch: Partial<OrganizationBrandingSettings>,
  ) {
    const next = { ...brand, ...patch };
    setBrand(next);
    setDirty((d) => ({ ...d, [key]: true }));
    setModal({
      title: `تأكيد رفع ${label}`,
      body: `${fileHint} ${hint} الرفع يستبدل المعروض في كل ما يُصدَر لاحقاً — التقارير السابقة تحتفظ بنسختها، والإجراء يُقيَّد في سجل التدقيق.`,
      confirm: "رفع واعتماد",
      onConfirm: () => void persist(next, key, `تم رفع ${label} وقُيّد في سجل التدقيق.`),
    });
  }

  function confirmDelete(key: BrandKey, patch: Partial<OrganizationBrandingSettings>) {
    setModal({
      title: "حذف الأصل",
      body: "حذف الأصل يوقف استخدامه في كل ما يُصدَر لاحقاً — التقارير السابقة تحتفظ بنسختها. الإجراء يُقيَّد في سجل التدقيق.",
      confirm: "حذف",
      onConfirm: () => {
        const next = { ...brand, ...patch };
        void persist(next, key, "تم حذف الأصل وقُيّد في سجل التدقيق.");
      },
    });
  }

  const logoColor = filled(brand.logoColorUrl, D.logoColorUrl!);
  const logoWhite = filled(brand.logoWhiteUrl, D.logoWhiteUrl!);
  const stamp = filled(brand.stampUrl, D.stampUrl);
  const signature = filled(brand.signatureUrl, D.signatureUrl);
  const letterhead = filled(brand.letterheadUrl, D.letterheadUrl!);
  const head = mm(brand.letterheadHeadMm, D.letterheadHeadMm!);
  const footTop = mm(brand.letterheadFootTopMm, D.letterheadFootTopMm!);
  const pad = mm(brand.letterheadPadMm, D.letterheadPadMm!);
  const padStart = mm(brand.letterheadPadStartMm, D.letterheadPadStartMm!);
  const stampW = mm(brand.stampWidthCm, D.stampWidthCm!);
  const stampH = mm(brand.stampHeightCm, D.stampHeightCm!);
  const sigW = mm(brand.signatureWidthCm, D.signatureWidthCm!);
  const sigH = mm(brand.signatureHeightCm, D.signatureHeightCm!);

  const logoMeta = useMemo(
    () =>
      `الإصدار ${filled(brand.logoVersion, D.logoVersion!)} · ${filled(brand.logoUpdatedAt, D.logoUpdatedAt!)} · رفعه ${filled(brand.logoUploadedBy, D.logoUploadedBy!)}`,
    [brand.logoVersion, brand.logoUpdatedAt, brand.logoUploadedBy],
  );
  const stampMeta = useMemo(
    () =>
      `آخر رفع: ${filled(brand.stampUpdatedAt, D.stampUpdatedAt!)} · ${filled(brand.stampUploadedBy, D.stampUploadedBy!)} · قُيّد في سجل التدقيق`,
    [brand.stampUpdatedAt, brand.stampUploadedBy],
  );
  const lhMeta = useMemo(
    () =>
      `الإصدار ${filled(brand.letterheadVersion, D.letterheadVersion!)} · ${filled(brand.letterheadUpdatedAt, D.letterheadUpdatedAt!)} · ثلاث شرائح`,
    [brand.letterheadVersion, brand.letterheadUpdatedAt],
  );

  function patchLh(field: keyof OrganizationBrandingSettings, value: string) {
    mark("lh", { ...brand, [field]: Number(value) || 0 });
  }

  function startDrag(
    ev: React.MouseEvent<HTMLDivElement>,
    key: "letterheadHeadMm" | "letterheadFootTopMm" | "letterheadPadMm" | "letterheadPadStartMm",
    axis: "y" | "x" | "xs",
  ) {
    ev.preventDefault();
    const box = ev.currentTarget.parentElement?.getBoundingClientRect();
    if (!box) return;
    const move = (e: MouseEvent) => {
      const raw =
        axis === "y"
          ? ((e.clientY - box.top) / box.height) * 297
          : axis === "xs"
            ? ((box.right - e.clientX) / box.width) * 210
            : ((e.clientX - box.left) / box.width) * 210;
      const max = axis === "y" ? 297 : 210;
      const n = Math.min(max, Math.max(0, Math.round(raw)));
      setBrand((b) => ({ ...b, [key]: n }));
      setDirty((d) => ({ ...d, lh: true }));
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  function startPan(ev: React.MouseEvent) {
    ev.preventDefault();
    const sx = ev.clientX;
    const sy = ev.clientY;
    const ox = lhX;
    const oy = lhY;
    const move = (e: MouseEvent) => {
      setLhX(ox + (e.clientX - sx));
      setLhY(oy + (e.clientY - sy));
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  if (loading) {
    return (
      <PageShell variant="canvas" className="gap-0 p-4 sm:p-6" dir="rtl">
        <div className="flex items-center justify-center gap-2 py-20 text-text-3">
          <Spinner />
          <span className="text-[13px]">جاري التحميل…</span>
        </div>
      </PageShell>
    );
  }

  const fieldCls = "h-[30px] text-xs";
  const cardFootCls =
    "mt-auto flex flex-wrap items-center justify-between gap-2.5 border-t border-border px-4 py-3 text-xs text-text-2";
  const previewBoxCls =
    "grid h-[110px] w-[150px] shrink-0 place-items-center rounded-lg border border-dashed border-border-md bg-surface-2 p-2";

  return (
    <PageShell variant="canvas" className="gap-0 p-4 sm:p-6" dir="rtl">
      {!canEdit ? (
        <Note tone="warn" className="mb-3 max-w-[560px]">
          الرابط صحيح، لكن دورك الحالي لا يملك صلاحية هذا البند. اطلب الصلاحية من مسؤول النظام.
        </Note>
      ) : null}
      {error ? <Note tone="warn">{error}</Note> : null}

      <p className="m-0 mx-0.5 mb-4 text-[11.5px] leading-relaxed text-text-3">
        التغييرات لا تسري إلا باعتماد كل مكوّن على حدة — والاعتماد يُقيَّد في سجل التدقيق.
      </p>

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
        <Card className="flex h-full flex-col">
          <CardHeader>
            <h2 className="m-0 text-sm font-bold">الشعار</h2>
          </CardHeader>
          <CardBody className="flex flex-1 flex-col">
            <div className="mb-3 grid grid-cols-2 gap-2.5">
              <div>
                <div
                  className="grid h-[110px] place-items-center rounded-lg border border-dashed border-border-md bg-surface-2"
                >
                  <img src={logoColor} alt="الشعار الملون" style={{ height: 40 }} />
                </div>
                <div className="mt-1.5 text-[11.5px] text-text-2">
                  الشعار الملون — للخلفيات الفاتحة
                </div>
                <div className="mt-1.5 flex gap-1.5">
                  <Button
                    variant="default"
                    size="sm"
                    disabled={!canEdit}
                    onClick={() =>
                      pickImage((url, name, kb) =>
                        confirmUpload(
                          "logo",
                          "الشعار الملون",
                          "المقاس الملزم: متجه SVG.",
                          `الملف: ${name} (${kb}KB).`,
                          {
                            logoColorUrl: url,
                            logoVersion: "v3",
                            logoUpdatedAt: todayIso(),
                          },
                        ),
                      )
                    }
                  >
                    استبدال
                  </Button>
                  <Button
                    variant="dangerOutline"
                    size="sm"
                    disabled={!canEdit}
                    onClick={() => confirmDelete("logo", { logoColorUrl: "" })}
                  >
                    حذف
                  </Button>
                </div>
              </div>
              <div>
                <div
                  className="grid h-[110px] place-items-center rounded-lg border border-dashed border-border-md"
                  style={{ background: "var(--ink)" }}
                >
                  <img src={logoWhite} alt="الشعار الأبيض" style={{ height: 40 }} />
                </div>
                <div className="mt-1.5 text-[11.5px] text-text-2">
                  الشعار الأبيض — للخلفيات الداكنة
                </div>
                <div className="mt-1.5 flex gap-1.5">
                  <Button
                    variant="default"
                    size="sm"
                    disabled={!canEdit}
                    onClick={() =>
                      pickImage((url, name, kb) =>
                        confirmUpload(
                          "logo",
                          "الشعار الأبيض",
                          "المقاس الملزم: متجه SVG على خلفية شفافة.",
                          `الملف: ${name} (${kb}KB).`,
                          {
                            logoWhiteUrl: url,
                            logoVersion: "v3",
                            logoUpdatedAt: todayIso(),
                          },
                        ),
                      )
                    }
                  >
                    استبدال
                  </Button>
                  <Button
                    variant="dangerOutline"
                    size="sm"
                    disabled={!canEdit}
                    onClick={() => confirmDelete("logo", { logoWhiteUrl: "" })}
                  >
                    حذف
                  </Button>
                </div>
              </div>
            </div>
            <div className="mt-auto text-xs leading-relaxed text-text-2">
              المقاس الملزم: متجه SVG — ارتفاع <bdi className="font-[inherit]">48px</bdi> في
              الترويسة. لكل نسخة رفع مستقل.
            </div>
          </CardBody>
          <div className={cardFootCls}>
            <span>{logoMeta}</span>
            <Button
              variant="primary"
              size="sm"
              disabled={!canEdit || !dirty.logo || saving}
              onClick={() =>
                confirmApply(
                  "logo",
                  "الشعار",
                  "تُعتمد نسختا الشعار (الملونة والبيضاء) في كل ما يُصدَر لاحقاً.",
                  { ...brand, logoUpdatedAt: todayIso() },
                )
              }
            >
              اعتماد وتطبيق
            </Button>
          </div>
        </Card>

        <Card className="flex h-full flex-col">
          <CardHeader>
            <h2 className="m-0 text-sm font-bold">مقاس الختم على صفحة A4</h2>
          </CardHeader>
          <CardBody className="flex flex-1 flex-wrap items-start gap-4">
            <div className={previewBoxCls}>
              <img
                src={stamp}
                alt="ختم المنشأة"
                draggable={false}
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                  pointerEvents: "none",
                  userSelect: "none",
                }}
              />
            </div>
            <div className="grid min-w-[14rem] flex-1 grid-cols-2 gap-2.5">
              <div className="flex flex-col">
                <Label size="field">عرض الختم في A4 (cm)</Label>
                <Input
                  className={fieldCls}
                  type="number"
                  dir="ltr"
                  disabled={!canEdit}
                  value={String(stampW)}
                  onChange={(e) =>
                    mark("stamp", { ...brand, stampWidthCm: Number(e.target.value) })
                  }
                />
              </div>
              <div className="flex flex-col">
                <Label size="field">ارتفاع الختم في A4 (cm)</Label>
                <Input
                  className={fieldCls}
                  type="number"
                  dir="ltr"
                  disabled={!canEdit}
                  value={String(stampH)}
                  onChange={(e) =>
                    mark("stamp", { ...brand, stampHeightCm: Number(e.target.value) })
                  }
                />
              </div>
              <p className="col-span-2 m-0 text-[11.5px] leading-relaxed text-text-3">
                المقاس يسري على الصفحات المطبوعة فقط — رفع الختم نفسه من هنا.
              </p>
              <div className="col-span-2">
                <Button
                  variant="default"
                  size="sm"
                  disabled={!canEdit}
                  onClick={() =>
                    pickImage((url, name, kb) =>
                      confirmUpload(
                        "stamp",
                        "ختم المنشأة",
                        "أداة اعتماد — صلاحية أضيق وتأكيد مزدوج.",
                        `الملف: ${name} (${kb}KB).`,
                        {
                          stampUrl: url,
                          stampUpdatedAt: todayIso(),
                        },
                      ),
                    )
                  }
                >
                  رفع ختم جديد
                </Button>
              </div>
            </div>
          </CardBody>
          <div className={cardFootCls}>
            <span>يُطبع في قسم الاعتماد (27) من كل تقرير</span>
            <Button
              variant="primary"
              size="sm"
              disabled={!canEdit || !dirty.stamp || saving}
              onClick={() =>
                confirmApply(
                  "stamp",
                  "ختم المنشأة",
                  "أداة اعتماد — يُطبَّق الختم ومقاسه في A4 على كل تقرير جديد، بصلاحية أضيق وتأكيد مزدوج.",
                  brand,
                )
              }
            >
              اعتماد وتطبيق
            </Button>
          </div>
        </Card>

        <Card className="flex h-full flex-col">
          <CardHeader>
            <h2 className="m-0 text-sm font-bold">مقاس التوقيع على صفحة A4</h2>
          </CardHeader>
          <CardBody className="flex flex-1 flex-wrap items-start gap-4">
            <div className={previewBoxCls}>
              <img
                src={signature}
                alt="توقيع المقيم المعتمد"
                draggable={false}
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                  pointerEvents: "none",
                  userSelect: "none",
                }}
              />
            </div>
            <div className="grid min-w-[14rem] flex-1 grid-cols-2 gap-2.5">
              <div className="flex flex-col">
                <Label size="field">عرض التوقيع في A4 (cm)</Label>
                <Input
                  className={fieldCls}
                  type="number"
                  dir="ltr"
                  disabled={!canEdit}
                  value={String(sigW)}
                  onChange={(e) =>
                    mark("sig", {
                      ...brand,
                      signatureWidthCm: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="flex flex-col">
                <Label size="field">ارتفاع التوقيع في A4 (cm)</Label>
                <Input
                  className={fieldCls}
                  type="number"
                  dir="ltr"
                  disabled={!canEdit}
                  value={String(sigH)}
                  onChange={(e) =>
                    mark("sig", {
                      ...brand,
                      signatureHeightCm: Number(e.target.value),
                    })
                  }
                />
              </div>
              <p className="col-span-2 m-0 text-[11.5px] leading-relaxed text-text-3">
                المقاس يسري على الصفحات المطبوعة فقط — رفع التوقيع نفسه من هنا.
              </p>
              <div className="col-span-2">
                <Button
                  variant="default"
                  size="sm"
                  disabled={!canEdit}
                  onClick={() =>
                    pickImage((url, name, kb) =>
                      confirmUpload(
                        "sig",
                        "توقيع المقيم المعتمد",
                        "يُطبَّق التوقيع ومقاسه في A4 على كل تقرير جديد.",
                        `الملف: ${name} (${kb}KB).`,
                        {
                          signatureUrl: url,
                        },
                      ),
                    )
                  }
                >
                  رفع توقيع جديد
                </Button>
              </div>
            </div>
          </CardBody>
          <div className={cardFootCls}>
            <span>يُطبع في المشاركين (26) وإعتماد التقرير (27)</span>
            <Button
              variant="primary"
              size="sm"
              disabled={!canEdit || !dirty.sig || saving}
              onClick={() =>
                confirmApply(
                  "sig",
                  "توقيع المقيم المعتمد",
                  "يُطبَّق التوقيع ومقاسه في A4 على كل تقرير جديد.",
                  brand,
                )
              }
            >
              اعتماد وتطبيق
            </Button>
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <CardHeader className="items-baseline gap-2">
            <h2 className="m-0 text-sm font-bold">كليشة التقرير</h2>
            <span className="text-[11.5px] font-normal text-text-3">
              معاينة A4 مع ضبط الهوامش الأربعة
            </span>
          </CardHeader>
          <CardBody className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
            <div className="flex shrink-0 flex-col items-center gap-2">
              <button
                type="button"
                className="group relative h-[300px] w-[212px] cursor-zoom-in overflow-hidden rounded-lg border border-border-md bg-white p-0 shadow-[0_1px_0_rgba(16,43,78,.04),0_8px_24px_rgba(16,43,78,.08)] transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_2px_0_rgba(16,43,78,.04),0_14px_32px_rgba(16,43,78,.12)]"
                onClick={() => {
                  setLhZoom(true);
                  setLhX(0);
                  setLhY(0);
                }}
              >
                <img
                  src={letterhead}
                  alt="معاينة الكليشة على A4"
                  className="absolute inset-0 size-full object-cover"
                />
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 border-b-2 border-dashed border-gold"
                  style={{
                    height: head * 0.9,
                    background: "color-mix(in srgb, var(--gold) 12%, transparent)",
                  }}
                />
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 border-t-2 border-dashed border-gold"
                  style={{
                    top: footTop * 0.9,
                    background: "color-mix(in srgb, var(--gold) 12%, transparent)",
                  }}
                />
                <span
                  className="pointer-events-none absolute inset-x-0 bottom-2 mx-auto w-fit rounded px-2 py-0.5 text-[10.5px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ background: "color-mix(in srgb, var(--ink) 72%, transparent)" }}
                >
                  اضغط للتكبير وضبط الهوامش
                </span>
              </button>
              <span className="text-[11px] text-text-3">نسبة العرض مطابقة لصفحة A4</span>
            </div>
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-3">
              <div className="flex flex-col">
                <Label size="field">الهامش الأعلى (mm)</Label>
                <Input
                  className={fieldCls}
                  type="number"
                  dir="ltr"
                  disabled={!canEdit}
                  value={String(head)}
                  onChange={(e) => patchLh("letterheadHeadMm", e.target.value)}
                />
              </div>
              <div className="flex flex-col">
                <Label size="field">الهامش الأسفل — يبدأ من (mm)</Label>
                <Input
                  className={fieldCls}
                  type="number"
                  dir="ltr"
                  disabled={!canEdit}
                  value={String(footTop)}
                  onChange={(e) => patchLh("letterheadFootTopMm", e.target.value)}
                />
              </div>
              <div className="flex flex-col">
                <Label size="field">الهامش الأيسر (mm)</Label>
                <Input
                  className={fieldCls}
                  type="number"
                  dir="ltr"
                  disabled={!canEdit}
                  value={String(pad)}
                  onChange={(e) => patchLh("letterheadPadMm", e.target.value)}
                />
              </div>
              <div className="flex flex-col">
                <Label size="field">الهامش الأيمن (mm)</Label>
                <Input
                  className={fieldCls}
                  type="number"
                  dir="ltr"
                  disabled={!canEdit}
                  value={String(padStart)}
                  onChange={(e) => patchLh("letterheadPadStartMm", e.target.value)}
                />
              </div>
              <p className="m-0 text-[11.5px] leading-relaxed text-text-3 sm:col-span-2">
                اضغط على الصفحة لتكبيرها وسحب الأشرطة لضبط الهوامش بدقة — الباترن يبقى خارج
                منطقة المحتوى.
              </p>
              <div className="flex flex-wrap gap-1.5 sm:col-span-2">
                <Button
                  variant="default"
                  size="sm"
                  disabled={!canEdit}
                  onClick={() =>
                    pickImage((url, name, kb) =>
                      confirmUpload(
                        "lh",
                        "كليشة التقرير",
                        "ثلاث شرائح بمقاسات A4.",
                        `الملف: ${name} (${kb}KB).`,
                        {
                          letterheadUrl: url,
                          letterheadVersion: "v2",
                          letterheadUpdatedAt: todayIso(),
                        },
                      ),
                    )
                  }
                >
                  استبدال الكليشة
                </Button>
                <Button
                  variant="dangerOutline"
                  size="sm"
                  disabled={!canEdit}
                  onClick={() => confirmDelete("lh", { letterheadUrl: "" })}
                >
                  حذف
                </Button>
              </div>
            </div>
          </CardBody>
          <div className={cardFootCls}>
            <span>{lhMeta}</span>
            <Button
              variant="primary"
              size="sm"
              disabled={!canEdit || !dirty.lh || saving}
              onClick={() =>
                confirmApply(
                  "lh",
                  "كليشة التقرير",
                  "تُطبَّق الكليشة وهوامش الصفحة الأربعة على كل ما يُصدَر لاحقاً.",
                  {
                    ...brand,
                    letterheadUrl: brand.letterheadUrl?.trim() ? brand.letterheadUrl : D.letterheadUrl,
                    letterheadUpdatedAt: todayIso(),
                  },
                )
              }
            >
              اعتماد وتطبيق
            </Button>
          </div>
        </Card>
      </div>

      {lhZoom ? (
        <div
          className="fixed inset-0 z-[1400] grid place-items-center p-6"
          style={{ background: "rgba(16,43,78,.45)" }}
        >
          <div className="flex max-h-[92vh] items-start gap-4 rounded-xl bg-surface p-4">
            <div className="relative h-[70vh] w-[540px] overflow-hidden border border-border-md bg-surface-2">
              <div
                className="absolute bg-white shadow-[0_6px_24px_rgba(16,43,78,.18)]"
                style={{
                  top: 0,
                  insetInlineStart: 0,
                  width: 794,
                  height: 1123,
                  transform: `translate(${lhX}px, ${lhY}px)`,
                  cursor: lhPan ? "grab" : "default",
                }}
              >
                {lhPan ? (
                  <div
                    className="absolute inset-0 z-[5] cursor-grab"
                    onMouseDown={startPan}
                  />
                ) : null}
                <img
                  src={letterhead}
                  alt="معاينة الكليشة على A4"
                  className="absolute inset-0 size-full object-cover"
                />
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 border-b-2 border-gold"
                  style={{
                    height: `${(head / 297) * 100}%`,
                    background: "color-mix(in srgb, var(--gold) 14%, transparent)",
                  }}
                />
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 border-t-2 border-gold"
                  style={{
                    top: `${(footTop / 297) * 100}%`,
                    background: "color-mix(in srgb, var(--gold) 14%, transparent)",
                  }}
                />
                <div
                  className="absolute inset-x-0 h-2.5 cursor-ns-resize"
                  style={{
                    top: `calc(${(head / 297) * 100}% - 5px)`,
                    background:
                      "repeating-linear-gradient(90deg, var(--gold) 0 4px, transparent 4px 8px) center/100% 2px no-repeat",
                  }}
                  onMouseDown={(e) => startDrag(e, "letterheadHeadMm", "y")}
                />
                <div
                  className="absolute inset-x-0 h-2.5 cursor-ns-resize"
                  style={{
                    top: `calc(${(footTop / 297) * 100}% - 5px)`,
                    background:
                      "repeating-linear-gradient(90deg, var(--gold) 0 4px, transparent 4px 8px) center/100% 2px no-repeat",
                  }}
                  onMouseDown={(e) => startDrag(e, "letterheadFootTopMm", "y")}
                />
                <div
                  className="absolute inset-y-0 cursor-ew-resize border-s-2 border-dotted border-gold"
                  style={{
                    insetInlineEnd: 0,
                    width: `${(pad / 210) * 100}%`,
                    background: "color-mix(in srgb, var(--gold) 14%, transparent)",
                  }}
                  onMouseDown={(e) => startDrag(e, "letterheadPadMm", "x")}
                />
                <div
                  className="absolute inset-y-0 cursor-ew-resize border-e-2 border-dotted border-gold"
                  style={{
                    insetInlineStart: 0,
                    width: `${(padStart / 210) * 100}%`,
                    background: "color-mix(in srgb, var(--gold) 14%, transparent)",
                  }}
                  onMouseDown={(e) => startDrag(e, "letterheadPadStartMm", "xs")}
                />
              </div>
            </div>
            <div className="flex w-[180px] shrink-0 flex-col gap-2">
              <div className="text-[13px] font-bold text-heading">ضبط هوامش الكليشة</div>
              <div className="flex flex-col">
                <Label size="field">الهامش الأعلى (mm)</Label>
                <Input
                  className={fieldCls}
                  type="number"
                  dir="ltr"
                  value={String(head)}
                  onChange={(e) => patchLh("letterheadHeadMm", e.target.value)}
                />
              </div>
              <div className="flex flex-col">
                <Label size="field">الهامش الأسفل — يبدأ من (mm)</Label>
                <Input
                  className={fieldCls}
                  type="number"
                  dir="ltr"
                  value={String(footTop)}
                  onChange={(e) => patchLh("letterheadFootTopMm", e.target.value)}
                />
              </div>
              <div className="flex flex-col">
                <Label size="field">الهامش الأيسر (mm)</Label>
                <Input
                  className={fieldCls}
                  type="number"
                  dir="ltr"
                  value={String(pad)}
                  onChange={(e) => patchLh("letterheadPadMm", e.target.value)}
                />
              </div>
              <div className="flex flex-col">
                <Label size="field">الهامش الأيمن (mm)</Label>
                <Input
                  className={fieldCls}
                  type="number"
                  dir="ltr"
                  value={String(padStart)}
                  onChange={(e) => patchLh("letterheadPadStartMm", e.target.value)}
                />
              </div>
              <p className="m-0 text-[11.5px] text-text-3">
                الصفحة بالحجم الطبيعي <span>A4</span>. اسحب الشريط الذهبي أو اكتب القيمة، واضغط{" "}
                <strong>مسافة</strong> مع السحب لتحريك الصفحة.
              </p>
              <Button
                variant="primary"
                onClick={() => {
                  setLhPan(false);
                  setLhZoom(false);
                }}
              >
                تم
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {modal ? (
        <ModalOverlay onClick={() => setModal(null)}>
          <ModalCard
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal
            aria-labelledby="brand-modal-title"
          >
            <ModalHeader>
              <ModalTitle id="brand-modal-title">{modal.title}</ModalTitle>
            </ModalHeader>
            <ModalBody>
              <p className="m-0 text-[13px] leading-relaxed text-text-2">{modal.body}</p>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" onClick={() => setModal(null)}>
                إلغاء
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const fn = modal.onConfirm;
                  setModal(null);
                  fn();
                }}
              >
                {modal.confirm}
              </Button>
            </ModalFooter>
          </ModalCard>
        </ModalOverlay>
      ) : null}

      <Can capability="manage-system-config">
        <span className="sr-only">{saving ? "جاري الحفظ" : ""}</span>
      </Can>
    </PageShell>
  );
}
