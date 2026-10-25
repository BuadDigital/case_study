"use client";

import { filled } from "../lib/filled";

import { pickImage, refreshOrgCache } from "../lib/org-settings-ui";
import { todayIso } from "@platform/app-shared/format/date";
import { certifiedBlockMessage } from "./users/report-seat-state";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BRAND_IDENTITY_DEFAULTS,
  ORG_COMPANY_DEFAULTS,
  getOrganizationSettings,
  saveOrganizationSettings,
  type OrganizationBrandingSettings,
  type OrganizationCompanySettings,
  type OrganizationSettingsDto,
  type OrganizationValuerRosterEntry,
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
  cn,
  opsDropzone,
  useToast,
} from "@platform/ui-kit";
import {
  SettingsAccessNotes,
  SettingsLoadingShell,
  SettingsSaveBar,
} from "../components/SettingsPageParts";
import { apiConfig } from "@platform/app-shared/auth/api-config";

const D = ORG_COMPANY_DEFAULTS;



function daysUntil(iso: string): number | null {
  const end = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(end.getTime())) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}



export function OrganizationDataView() {
  const { showToast } = useToast();
  const canEdit = useCapability("manage-system-config");
  const [org, setOrg] = useState<OrganizationSettingsDto | null>(null);
  const [company, setCompany] = useState<OrganizationCompanySettings>(D);
  /** Roster row chosen as المقيّم المعتمد; saved by moving the role, never by copying data. */
  const [certifiedId, setCertifiedId] = useState<string>("");
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
    const config = apiConfig();
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
    setCertifiedId(res.data.valuers.find((v) => v.role === "certified")?.id ?? "");
    setBranding(res.data.branding);
    setDirty(false);
    setStampDirty(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- server fetch: reload() is shared with the retry/refresh handlers and flips loading/error before its first await
    void reload();
  }, [reload]);

  const patchCompany = (patch: Partial<OrganizationCompanySettings>) => {
    setCompany((c) => ({ ...c, ...patch }));
    setDirty(true);
  };

  const valuers = useMemo(() => org?.valuers ?? [], [org]);
  const certOptions = useMemo(
    () =>
      valuers
        .filter((v) => v.isActive || v.id === certifiedId)
        .map((v) => ({
          id: v.id,
          label: `${v.nameAr}${v.membershipNumber ? ` — عضوية ${v.membershipNumber}` : ""}`,
        })),
    [valuers, certifiedId],
  );
  const selectedCertId = certifiedId;
  const certifiedBlock = useMemo(
    () => certifiedBlockMessage(valuers, todayIso()),
    [valuers],
  );

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
    const config = apiConfig();
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
      address: filled(company.address, D.address!),
      email: "",
      phone: filled(company.phone, D.phone!),
      website: filled(company.website, D.website!),
    };
    const storedCertifiedId = valuers.find((v) => v.role === "certified")?.id ?? "";
    const nextValuers: OrganizationValuerRosterEntry[] | undefined =
      certifiedId && certifiedId !== storedCertifiedId
        ? valuers.map((v) => ({
            ...v,
            role:
              v.id === certifiedId
                ? "certified"
                : v.role === "certified"
                  ? "valuer"
                  : v.role,
          }))
        : undefined;
    const res = await saveOrganizationSettings(config, {
      company: nextCompany,
      ...(nextValuers ? { valuers: nextValuers } : {}),
    });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ بيانات المنشأة", "error");
      return;
    }
    setOrg(res.data);
    setCompany(res.data.company);
    setCertifiedId(res.data.valuers.find((v) => v.role === "certified")?.id ?? "");
    setDirty(false);
    await refreshOrgCache();
    showToast("تم الحفظ وقُيّد في سجل التدقيق.", "success");
  }

  async function persistStamp(next: OrganizationBrandingSettings) {
    const config = apiConfig();
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
    return <SettingsLoadingShell />;
  }

  return (
    <PageShell variant="canvas" className="gap-0 px-4 pb-4 pt-2 sm:px-6 sm:pb-6" dir="rtl">
      <SettingsAccessNotes canEdit={canEdit} error={error} />

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
              <Label size="field">المقيّم المعتمد</Label>
              <Select
                disabled={!canEdit}
                value={selectedCertId}
                onChange={(e) => {
                  setCertifiedId(e.target.value);
                  setDirty(true);
                }}
              >
                {certOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <p className="m-0 mt-1 text-[11px] text-text-3">
                مرجع لا نسخة — بياناته وتوقيعه تُعدَّل من بطاقته في{" "}
                <Link href="/users" className="font-semibold text-primary">
                  «المستخدمون»
                </Link>
                .
              </p>
              {certifiedBlock ? (
                <Note tone="danger" className="mt-2">
                  {certifiedBlock}
                </Note>
              ) : null}
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
              className={cn(opsDropzone, "h-[130px] w-[210px] shrink-0 overflow-hidden p-2.5")}
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
              className="max-lg:h-11 max-lg:w-full max-lg:text-sm"
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
        <SettingsSaveBar
          dirty={dirty}
          saving={saving}
          onSave={() => void persistCompany()}
          buttonClassName="max-lg:h-11 max-lg:w-full"
        />
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
