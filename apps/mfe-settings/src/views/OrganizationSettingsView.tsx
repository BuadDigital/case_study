"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getOrganizationSettings,
  saveOrganizationSettings,
  testOrganizationCommunication,
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
      smsApiUrl: "",
      smsApiKey: "",
      smsApiKeyConfigured: false,
      smtpHost: "",
      smtpPort: 587,
      smtpUsername: "",
      smtpPassword: "",
      smtpPasswordConfigured: false,
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
  const [testDestination, setTestDestination] = useState("");
  const [testing, setTesting] = useState(false);

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
        showToast(result.message ?? "تعذّر اختبار الإرسال", "error");
        return;
      }
      showToast(
        result.data.ok
          ? `${result.data.detail ?? "تم الإرسال"} (${result.data.provider})`
          : result.data.detail ?? "فشل الاختبار",
        result.data.ok ? "success" : "error",
      );
    } finally {
      setTesting(false);
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
                <Note tone="info" className="sm:col-span-2 text-xs">
                  واجهة موحّدة لإرسال OTP والدعوات. الافتراضي <code>dev-log</code> يكتب
                  الرمز في سجل الخادم. مفاتيح API وكلمات مرور SMTP لا تُعاد في الاستجابة —
                  اترك الحقل فارغاً للإبقاء على القيمة الحالية.
                </Note>
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
                <div className="sm:col-span-2">
                  <Label>عنوان API للرسائل (SMS)</Label>
                  <Input
                    dir="ltr"
                    placeholder="https://…"
                    value={draft.communications.smsApiUrl ?? ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        communications: {
                          ...d.communications,
                          smsApiUrl: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>
                    مفتاح API للرسائل
                    {draft.communications.smsApiKeyConfigured
                      ? " (محفوظ — اترك فارغاً للإبقاء)"
                      : ""}
                  </Label>
                  <Input
                    dir="ltr"
                    type="password"
                    autoComplete="new-password"
                    placeholder={
                      draft.communications.smsApiKeyConfigured ? "••••••••" : ""
                    }
                    value={draft.communications.smsApiKey ?? ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        communications: {
                          ...d.communications,
                          smsApiKey: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>خادم SMTP</Label>
                  <Input
                    dir="ltr"
                    value={draft.communications.smtpHost ?? ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        communications: {
                          ...d.communications,
                          smtpHost: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>منفذ SMTP</Label>
                  <Input
                    dir="ltr"
                    type="number"
                    value={String(draft.communications.smtpPort ?? 587)}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        communications: {
                          ...d.communications,
                          smtpPort: Number(e.target.value) || 587,
                        },
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>مستخدم SMTP</Label>
                  <Input
                    dir="ltr"
                    value={draft.communications.smtpUsername ?? ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        communications: {
                          ...d.communications,
                          smtpUsername: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>
                    كلمة مرور SMTP
                    {draft.communications.smtpPasswordConfigured
                      ? " (محفوظة)"
                      : ""}
                  </Label>
                  <Input
                    dir="ltr"
                    type="password"
                    autoComplete="new-password"
                    placeholder={
                      draft.communications.smtpPasswordConfigured
                        ? "••••••••"
                        : ""
                    }
                    value={draft.communications.smtpPassword ?? ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        communications: {
                          ...d.communications,
                          smtpPassword: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <div className="sm:col-span-2 flex flex-wrap items-end gap-2 border-t border-border pt-3">
                  <div className="min-w-[12rem] flex-1">
                    <Label>وجهة اختبار (جوال أو بريد)</Label>
                    <Input
                      dir="ltr"
                      value={testDestination}
                      disabled={!canEdit}
                      onChange={(e) => setTestDestination(e.target.value)}
                      placeholder="+9665… أو email@…"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!canEdit || testing || !testDestination.trim()}
                    onClick={() => void runTest()}
                  >
                    {testing ? "جاري الإرسال…" : "اختبار الإرسال"}
                  </Button>
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
