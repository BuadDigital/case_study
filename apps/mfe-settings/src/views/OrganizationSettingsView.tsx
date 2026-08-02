"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getOrganizationSettings,
  saveOrganizationSettings,
  type OrganizationSettingsDto,
} from "@platform/api-client";
import { Can, useCapability } from "@platform/app-shared/components/Can";
import {
  Button,
  Input,
  Label,
  Note,
  PageGutter,
  PageShell,
  PageShellHeader,
  Select,
  Spinner,
  useToast,
} from "@platform/design-system";
import { organizationSettingsApiConfig } from "../lib/settings-api-config";

type TabId = "company" | "evaluator" | "branding" | "communications" | "sla";

const TABS: { id: TabId; label: string }[] = [
  { id: "company", label: "بيانات الشركة" },
  { id: "evaluator", label: "المقيم المعتمد" },
  { id: "branding", label: "الهوية والأصول" },
  { id: "communications", label: "الاتصالات" },
  { id: "sla", label: "معايير المهل" },
];

function emptySettings(): OrganizationSettingsDto {
  return {
    company: { name: "شركة إجادة المهنية للتقييم", taxNumber: "", address: "" },
    evaluator: { name: "", licenseNumber: "", membershipNumber: "" },
    branding: {
      stampUrl: "/case-study/ejadah-stamp.png",
      signatureUrl: "/case-study/ejadah-signature.png",
      headerUrl: "",
      watermarkText: "EJADAH",
    },
    communications: {
      otpProvider: "dev-log",
      defaultOtpChannel: "sms",
      smsSenderId: "",
      emailFrom: "",
    },
    sla: { defaultBusinessDays: 4, privateSectorBusinessDays: 10 },
    updatedAtUtc: new Date().toISOString(),
  };
}

export function OrganizationSettingsView() {
  const { showToast } = useToast();
  const canEdit = useCapability("manage-system-config");
  const [tab, setTab] = useState<TabId>("company");
  const [draft, setDraft] = useState<OrganizationSettingsDto>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const config = organizationSettingsApiConfig();
    if (!config) {
      setLoading(false);
      setLoadError("يجب تسجيل الدخول أولاً");
      return;
    }
    setLoading(true);
    setLoadError(null);
    const result = await getOrganizationSettings(config);
    if (!result.ok) {
      setLoadError(
        result.kind === "forbidden"
          ? "لا تملك صلاحية عرض إعدادات المنشأة"
          : result.kind === "network"
            ? "تعذّر الاتصال بالخادم"
            : "تعذّر تحميل الإعدادات",
      );
      setLoading(false);
      return;
    }
    setDraft(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onSave() {
    const config = organizationSettingsApiConfig();
    if (!config) return;
    setSaving(true);
    try {
      const result = await saveOrganizationSettings(config, {
        company: draft.company,
        evaluator: draft.evaluator,
        branding: draft.branding,
        communications: draft.communications,
        sla: draft.sla,
      });
      if (!result.ok) {
        showToast(
          result.message ??
            (result.kind === "forbidden"
              ? "لا تملك صلاحية حفظ الإعدادات"
              : "تعذّر حفظ الإعدادات"),
          "error",
        );
        return;
      }
      setDraft(result.data);
      const { clearOrganizationSettingsCache, ensureOrganizationSettingsLoaded } =
        await import("@platform/app-shared/organization/organization-settings-cache");
      clearOrganizationSettingsCache();
      await ensureOrganizationSettingsLoaded();
      showToast("تم حفظ إعدادات المنشأة. المهل الجديدة تسري على المعاملات الجديدة فقط.", "success");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell variant="canvas" className="min-h-0 flex-1">
      <PageShellHeader
        title="إعدادات المنشأة"
        meta="بيانات الشركة والمقيم والأصول والاتصالات ومعايير المهل"
      />
      <PageGutter className="space-y-4 pb-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : loadError ? (
          <Note tone="danger">{loadError}</Note>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 border-b border-border pb-3">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                    tab === item.id
                      ? "bg-primary text-white"
                      : "bg-surface-2 text-text-2 hover:border-border-md"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {!canEdit ? (
              <Note tone="info">عرض فقط — حفظ الإعدادات يتطلّب صلاحية ضبط النظام.</Note>
            ) : null}

            {tab === "company" ? (
              <section className="grid max-w-2xl gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>اسم الشركة</Label>
                  <Input
                    value={draft.company.name}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        company: { ...d.company, name: e.target.value },
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>الرقم الضريبي</Label>
                  <Input
                    dir="ltr"
                    value={draft.company.taxNumber ?? ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        company: { ...d.company, taxNumber: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>العنوان</Label>
                  <Input
                    value={draft.company.address ?? ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        company: { ...d.company, address: e.target.value },
                      }))
                    }
                  />
                </div>
              </section>
            ) : null}

            {tab === "evaluator" ? (
              <section className="grid max-w-2xl gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>اسم المقيم المعتمد</Label>
                  <Input
                    value={draft.evaluator.name ?? ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        evaluator: { ...d.evaluator, name: e.target.value },
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>رقم الترخيص</Label>
                  <Input
                    dir="ltr"
                    value={draft.evaluator.licenseNumber ?? ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        evaluator: {
                          ...d.evaluator,
                          licenseNumber: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>رقم العضوية</Label>
                  <Input
                    dir="ltr"
                    value={draft.evaluator.membershipNumber ?? ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        evaluator: {
                          ...d.evaluator,
                          membershipNumber: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              </section>
            ) : null}

            {tab === "branding" ? (
              <section className="grid max-w-2xl gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>رابط الختم</Label>
                  <Input
                    dir="ltr"
                    value={draft.branding.stampUrl}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        branding: { ...d.branding, stampUrl: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>رابط التوقيع</Label>
                  <Input
                    dir="ltr"
                    value={draft.branding.signatureUrl}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        branding: { ...d.branding, signatureUrl: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>رابط الترويسة (اختياري)</Label>
                  <Input
                    dir="ltr"
                    value={draft.branding.headerUrl ?? ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        branding: { ...d.branding, headerUrl: e.target.value },
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>نص العلامة المائية</Label>
                  <Input
                    dir="ltr"
                    value={draft.branding.watermarkText}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        branding: {
                          ...d.branding,
                          watermarkText: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              </section>
            ) : null}

            {tab === "communications" ? (
              <section className="grid max-w-2xl gap-3 sm:grid-cols-2">
                <div>
                  <Label>مزوّد OTP</Label>
                  <Select
                    value={draft.communications.otpProvider}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        communications: {
                          ...d.communications,
                          otpProvider: e.target.value,
                        },
                      }))
                    }
                  >
                    <option value="dev-log">dev-log (تطوير)</option>
                    <option value="sms">sms</option>
                    <option value="email">email</option>
                  </Select>
                </div>
                <div>
                  <Label>قناة OTP الافتراضية</Label>
                  <Select
                    value={draft.communications.defaultOtpChannel}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        communications: {
                          ...d.communications,
                          defaultOtpChannel: e.target.value,
                        },
                      }))
                    }
                  >
                    <option value="sms">sms</option>
                    <option value="email">email</option>
                  </Select>
                </div>
                <div>
                  <Label>معرّف مرسل SMS</Label>
                  <Input
                    dir="ltr"
                    value={draft.communications.smsSenderId ?? ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        communications: {
                          ...d.communications,
                          smsSenderId: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>بريد المرسل</Label>
                  <Input
                    dir="ltr"
                    value={draft.communications.emailFrom ?? ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        communications: {
                          ...d.communications,
                          emailFrom: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              </section>
            ) : null}

            {tab === "sla" ? (
              <section className="grid max-w-xl gap-3 sm:grid-cols-2">
                <Note tone="info" className="sm:col-span-2 text-xs">
                  التعديل يسري على أوامر العمل الجديدة فقط. الجارية تحتفظ بمهلتها المحسوبة عند
                  الاستلام.
                </Note>
                <div>
                  <Label>أيام عمل — تنفيذ / تركات</Label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    dir="ltr"
                    value={String(draft.sla.defaultBusinessDays)}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        sla: {
                          ...d.sla,
                          defaultBusinessDays: Number(e.target.value) || 1,
                        },
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>أيام عمل — قطاع خاص</Label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    dir="ltr"
                    value={String(draft.sla.privateSectorBusinessDays)}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        sla: {
                          ...d.sla,
                          privateSectorBusinessDays: Number(e.target.value) || 1,
                        },
                      }))
                    }
                  />
                </div>
              </section>
            ) : null}

            <Can capability="manage-system-config">
              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  variant="primary"
                  disabled={saving}
                  loading={saving}
                  onClick={() => void onSave()}
                >
                  حفظ الإعدادات
                </Button>
              </div>
            </Can>
          </>
        )}
      </PageGutter>
    </PageShell>
  );
}
