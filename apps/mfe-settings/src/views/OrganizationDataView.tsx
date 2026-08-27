"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BRAND_IDENTITY_DEFAULTS,
  ORG_COMPANY_DEFAULTS,
  getOrganizationSettings,
  saveOrganizationSettings,
  type OrganizationBrandingSettings,
  type OrganizationCompanySettings,
  type OrganizationEvaluatorSettings,
  type OrganizationSettingsDto,
} from "@platform/api-client";
import { useCapability } from "@platform/app-shared/components/Can";
import {
  Badge,
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
  Select,
  Spinner,
  useToast,
} from "@platform/ui-kit";
import { organizationSettingsApiConfig } from "../lib/settings-api-config";

const D = ORG_COMPANY_DEFAULTS;

function filled(value: string | null | undefined, fallback: string): string {
  return value?.trim() ? value : fallback;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(iso: string): number | null {
  const end = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(end.getTime())) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
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

async function refreshOrgCache() {
  const { clearOrganizationSettingsCache, ensureOrganizationSettingsLoaded } =
    await import("@platform/app-shared/organization/organization-settings-cache");
  clearOrganizationSettingsCache();
  await ensureOrganizationSettingsLoaded();
}

export function OrganizationDataView() {
  const { showToast } = useToast();
  const canEdit = useCapability("manage-system-config");
  const [org, setOrg] = useState<OrganizationSettingsDto | null>(null);
  const [company, setCompany] = useState<OrganizationCompanySettings>(D);
  const [evaluator, setEvaluator] = useState<OrganizationEvaluatorSettings>({});
  const [branding, setBranding] = useState<OrganizationBrandingSettings>(
    BRAND_IDENTITY_DEFAULTS,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [stampDirty, setStampDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{
    title: string;
    body: string;
    confirm: string;
    onConfirm: () => void;
  } | null>(null);

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
      setError("تعذّر تحميل بيانات المنشأة");
      return;
    }
    setError(null);
    setOrg(res.data);
    setCompany(res.data.company);
    setEvaluator(res.data.evaluator);
    setBranding(res.data.branding);
    setDirty(false);
    setStampDirty(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const patchCompany = (patch: Partial<OrganizationCompanySettings>) => {
    setCompany((c) => ({ ...c, ...patch }));
    setDirty(true);
  };

  const valuers = org?.valuers ?? [];
  const certOptions = useMemo(() => {
    const rows: { id: string; label: string; evaluator: OrganizationEvaluatorSettings }[] =
      [];
    const certName = filled(evaluator.name, "");
    rows.push({
      id: "certified",
      label: certName
        ? `${certName}${evaluator.membershipNumber ? ` — عضوية ${evaluator.membershipNumber}` : ""}`
        : "المقيّم المعتمد الحالي",
      evaluator,
    });
    for (const v of valuers) {
      if (!v.isActive) continue;
      rows.push({
        id: v.id,
        label: `${v.nameAr}${v.membershipNumber ? ` — عضوية ${v.membershipNumber}` : ""}`,
        evaluator: {
          name: v.nameAr,
          licenseNumber: v.licenseNumber,
          membershipNumber: v.membershipNumber,
          membershipCategory: v.membershipCategory,
          licenseExpiresAt: v.licenseExpiresAt,
          membershipExpiresAt: v.membershipExpiresAt,
        },
      });
    }
    return rows;
  }, [evaluator, valuers]);

  const selectedCertId = filled(company.certifiedValuerId, "certified");

  const licExp = filled(company.practiceLicenseExpiresAt, D.practiceLicenseExpiresAt!);
  const licIssued = filled(
    company.practiceLicenseIssuedAt,
    D.practiceLicenseIssuedAt!,
  );
  const daysLeft = daysUntil(licExp);
  const warn = daysLeft != null && daysLeft <= 120;
  const licStripText =
    daysLeft == null
      ? "أدخل تاريخ انتهاء ترخيص المزاولة لعرض حالة الإصدار."
      : warn
        ? `ترخيص المزاولة ينتهي خلال ${daysLeft} يوماً (${licExp}) — جدّد قبل انقطاع الإصدار.`
        : `الإصدار متاح حتى ${licExp} — ترخيص المزاولة ساري (تبقّى ${daysLeft} يوماً).`;

  const stamp = filled(branding.stampUrl, BRAND_IDENTITY_DEFAULTS.stampUrl);
  const licNo = filled(company.practiceLicenseNumber, D.practiceLicenseNumber!);

  async function persistCompany() {
    const config = organizationSettingsApiConfig();
    if (!config) return;
    setSaving(true);
    const nextCompany: OrganizationCompanySettings = {
      name: filled(company.name, D.name),
      commercialRegistration: filled(
        company.commercialRegistration,
        D.commercialRegistration!,
      ),
      taxNumber: filled(company.taxNumber, D.taxNumber!),
      practiceLicenseNumber: filled(
        company.practiceLicenseNumber,
        D.practiceLicenseNumber!,
      ),
      practiceLicenseIssuedAt: filled(
        company.practiceLicenseIssuedAt,
        D.practiceLicenseIssuedAt!,
      ),
      practiceLicenseExpiresAt: filled(
        company.practiceLicenseExpiresAt,
        D.practiceLicenseExpiresAt!,
      ),
      certifiedValuerId: selectedCertId,
      address: filled(company.address, D.address!),
      email: filled(company.email, D.email!),
      phone: filled(company.phone, D.phone!),
      website: filled(company.website, D.website!),
    };
    const res = await saveOrganizationSettings(config, {
      company: nextCompany,
      evaluator,
    });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ بيانات المنشأة", "error");
      return;
    }
    setOrg(res.data);
    setCompany(res.data.company);
    setEvaluator(res.data.evaluator);
    setDirty(false);
    await refreshOrgCache();
    showToast("تم الحفظ وقُيّد في سجل التدقيق.", "success");
  }

  async function persistStamp(next: OrganizationBrandingSettings) {
    const config = organizationSettingsApiConfig();
    if (!config) return;
    setSaving(true);
    const res = await saveOrganizationSettings(config, { branding: next });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر اعتماد الختم", "error");
      return;
    }
    setBranding(res.data.branding);
    setStampDirty(false);
    await refreshOrgCache();
    showToast("تم اعتماد ختم المنشأة وتطبيقه.", "success");
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

  return (
    <PageShell variant="canvas" className="gap-0 px-4 pb-4 pt-2 sm:px-6 sm:pb-6" dir="rtl">
      {!canEdit ? (
        <Note tone="warn" className="mb-3 max-w-[560px]">
          الرابط صحيح، لكن دورك الحالي لا يملك صلاحية هذا البند. اطلب الصلاحية من مسؤول النظام.
        </Note>
      ) : null}
      {error ? <Note tone="warn">{error}</Note> : null}

      <div
        className="mb-4 flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-[12.5px] font-medium"
        style={{
          background: warn ? "var(--warning-bg, #fdf3e0)" : "var(--navy-soft)",
          color: warn ? "#784212" : "var(--ink)",
          borderInlineStart: `3px solid ${warn ? "var(--warning, #d9a441)" : "var(--ink)"}`,
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
          aria-hidden
        >
          <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2" />
        </svg>
        <span>{licStripText}</span>
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <h2 className="m-0 text-sm font-bold">البيانات الرسمية</h2>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div className="flex flex-col sm:col-span-2">
              <Label size="field">الاسم الرسمي للمنشأة</Label>
              <Input
                disabled={!canEdit}
                value={filled(company.name, D.name)}
                onChange={(e) => patchCompany({ name: e.target.value })}
              />
            </div>
            <div className="flex flex-col">
              <Label size="field">السجل التجاري</Label>
              <Input
                dir="ltr"
                disabled={!canEdit}
                value={filled(company.commercialRegistration, D.commercialRegistration!)}
                onChange={(e) => patchCompany({ commercialRegistration: e.target.value })}
              />
              <p className="m-0 mt-1 text-[11px] text-text-3">
                سجل تجاري صادر بموجب ترخيص المزاولة رقم{" "}
                <bdi>{licNo}</bdi>
              </p>
            </div>
            <div className="flex flex-col">
              <Label size="field">الرقم الضريبي</Label>
              <Input
                dir="ltr"
                disabled={!canEdit}
                value={filled(company.taxNumber, D.taxNumber!)}
                onChange={(e) => patchCompany({ taxNumber: e.target.value })}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="m-0 text-sm font-bold">ترخيص المزاولة</h2>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div className="flex flex-col">
              <Label size="field">رقم الترخيص (الهيئة السعودية للمقيمين المعتمدين)</Label>
              <Input
                dir="ltr"
                disabled={!canEdit}
                value={licNo}
                onChange={(e) => patchCompany({ practiceLicenseNumber: e.target.value })}
              />
            </div>
            <div className="flex flex-col">
              <Label size="field">تاريخ إصدار الترخيص</Label>
              <Input
                type="date"
                dir="ltr"
                disabled={!canEdit}
                value={licIssued}
                onChange={(e) =>
                  patchCompany({ practiceLicenseIssuedAt: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col">
              <Label size="field">تاريخ انتهاء الترخيص</Label>
              <Input
                type="date"
                dir="ltr"
                disabled={!canEdit}
                value={licExp}
                onChange={(e) =>
                  patchCompany({ practiceLicenseExpiresAt: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col sm:col-span-2">
              <Label size="field">المقيّم المعتمد (مرجع من سجل المقيّمين)</Label>
              <Select
                disabled={!canEdit}
                value={selectedCertId}
                onChange={(e) => {
                  const id = e.target.value;
                  const row = certOptions.find((o) => o.id === id);
                  patchCompany({ certifiedValuerId: id });
                  if (row) setEvaluator(row.evaluator);
                }}
              >
                {certOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <p className="m-0 mt-1 text-[11px] text-text-3">
                مرجع لا نسخة — بياناته تُقرأ من شاشة{" "}
                <Link
                  href="/organization-settings?tab=evaluator"
                  className="font-semibold text-primary"
                >
                  «المقيّمون»
                </Link>
                .
              </p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="gap-2">
            <h2 className="m-0 text-sm font-bold">ختم المنشأة</h2>
            <Badge tone="danger" className="text-[10.5px]">
              أداة اعتماد
            </Badge>
          </CardHeader>
          <CardBody className="flex flex-wrap items-start gap-[18px]">
            <div
              className="grid h-[130px] w-[210px] shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed border-border-md bg-surface-2 p-2.5"
            >
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
            <div className="flex min-w-[16rem] flex-1 flex-col gap-2.5">
              <p className="m-0 text-xs leading-[1.7] text-text-2">
                يُطبع في قسم الاعتماد (27) من كل تقرير. يُعرض ولا يُحمَّل من الواجهة ولا يُحذف،
                وتبديله بصلاحية أضيق وتأكيد مزدوج ويُقيَّد في سجل التدقيق. ضبط مقاسه على صفحة{" "}
                <span>A4</span> من تبويب{" "}
                <Link
                  href="/organization-settings?tab=branding"
                  className="font-semibold text-primary"
                >
                  «الهوية البصرية»
                </Link>
                .
              </p>
              <Button
                variant="default"
                className="self-start"
                disabled={!canEdit}
                onClick={() =>
                  pickImage((url, name, kb) => {
                    const next = {
                      ...branding,
                      stampUrl: url,
                      stampUpdatedAt: todayIso(),
                    };
                    setBranding(next);
                    setStampDirty(true);
                    setModal({
                      title: "تأكيد رفع ختم المنشأة",
                      body: `الملف: ${name} (${kb}KB). أداة اعتماد — صلاحية أضيق وتأكيد مزدوج. الرفع يستبدل المعروض في كل ما يُصدَر لاحقاً — التقارير السابقة تحتفظ بنسختها، والإجراء يُقيَّد في سجل التدقيق.`,
                      confirm: "رفع واعتماد",
                      onConfirm: () => void persistStamp(next),
                    });
                  })
                }
              >
                رفع ختم جديد
              </Button>
            </div>
          </CardBody>
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-border px-4 py-3 text-xs text-text-2">
            <span>
              آخر رفع: <bdi>{filled(branding.stampUpdatedAt, "2026-03-14")}</bdi> ·{" "}
              {filled(branding.stampUploadedBy, "مسؤول النظام")} · قُيّد في سجل التدقيق
            </span>
            <Button
              variant="primary"
              size="sm"
              disabled={!canEdit || !stampDirty || saving}
              onClick={() =>
                setModal({
                  title: "اعتماد ختم المنشأة",
                  body: "أداة اعتماد — يُطبَّق الختم ومقاسه في A4 على كل تقرير جديد، بصلاحية أضيق وتأكيد مزدوج. التقارير السابقة تحتفظ بنسختها، والإجراء يُقيَّد في سجل التدقيق.",
                  confirm: "اعتماد وتطبيق",
                  onConfirm: () => void persistStamp(branding),
                })
              }
            >
              اعتماد وتطبيق
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="m-0 text-sm font-bold">بيانات الاتصال</h2>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div className="flex flex-col sm:col-span-2">
              <Label size="field">العنوان الوطني</Label>
              <Input
                disabled={!canEdit}
                value={filled(company.address, D.address!)}
                onChange={(e) => patchCompany({ address: e.target.value })}
              />
            </div>
            <div className="flex flex-col">
              <Label size="field">البريد الإلكتروني</Label>
              <Input
                dir="ltr"
                disabled={!canEdit}
                value={filled(company.email, D.email!)}
                onChange={(e) => patchCompany({ email: e.target.value })}
              />
            </div>
            <div className="flex flex-col">
              <Label size="field">الهاتف</Label>
              <Input
                dir="ltr"
                disabled={!canEdit}
                value={filled(company.phone, D.phone!)}
                onChange={(e) => patchCompany({ phone: e.target.value })}
              />
            </div>
            <div className="flex flex-col">
              <Label size="field">الموقع الإلكتروني</Label>
              <Input
                dir="ltr"
                disabled={!canEdit}
                value={filled(company.website, D.website!)}
                onChange={(e) => patchCompany({ website: e.target.value })}
              />
            </div>
          </CardBody>
        </Card>
      </div>

      {canEdit ? (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2.5">
          {dirty ? (
            <span className="flex items-center gap-1.5 text-[11.5px] text-amber-text">
              <span className="size-1.5 rounded-full bg-warning" />
              تعديل غير محفوظ
            </span>
          ) : null}
          <Button variant="primary" loading={saving} onClick={() => void persistCompany()}>
            حفظ
          </Button>
        </div>
      ) : null}

      {modal ? (
        <ModalOverlay onClick={() => setModal(null)}>
          <ModalCard
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal
            aria-labelledby="org-data-modal-title"
          >
            <ModalHeader>
              <ModalTitle id="org-data-modal-title">{modal.title}</ModalTitle>
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
    </PageShell>
  );
}
