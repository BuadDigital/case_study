"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getOrganizationSettings, saveOrganizationSettings, testOrganizationCommunication, emptyValuationReportSettings, BRAND_IDENTITY_DEFAULTS, ORG_COMPANY_DEFAULTS, type OrganizationSettingsDto } from "@platform/api-client";
import { Can, useCapability } from "@platform/app-shared/components/Can";
import { cn, Note, PageShell, Spinner, useToast } from "@platform/ui-kit";
import {
  opsBtnGhost,
  opsBtnPrimary,
  opsFld,
  opsFldControl,
  opsFldFull,
  opsFormGrid,
  opsIconBoxGold,
  opsLetterCard,
  opsLetterHead,
  opsLetterSub,
  opsLetterTitle,
  opsTfActions,
  opsTfLbl,
  opsTfNote,
  opsTfSeg,
  opsTfSegActive,
  opsTfSegRow,
} from "@case-study/mfe/lib/prototype/ops-tasks-tw";
import { BrandIdentityView } from "./BrandIdentityView";
import { OrganizationDataView } from "./OrganizationDataView";
import { ValuersRosterView } from "./ValuersRosterView";
import { ProfessionalValuationReportView } from "./ProfessionalValuationReportView";
import { organizationSettingsApiConfig } from "../lib/settings-api-config";

type TabId =
  | "company"
  | "evaluator"
  | "branding"
  | "communications"
  | "sla"
  | "report";

const TABS: { id: TabId; label: string }[] = [
  { id: "evaluator", label: "المقيّمون" },
  { id: "communications", label: "الاتصالات" },
  { id: "sla", label: "معايير المهل" },
  { id: "report", label: "تقرير التقييم المهني" },
];

const TAB_META: Record<TabId, { icon: string; sub: string }> = {
  company: {
    icon: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6",
    sub: "الاسم الرسمي والبيانات الضريبية المستخدمة في التقارير والمخرجات",
  },
  evaluator: {
    icon: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    sub: "المقيم المعتمد لبوابات الإصدار + قائمة المشاركين في التقرير",
  },
  branding: {
    icon: "M4 16l4.6-4.6a2 2 0 0 1 2.8 0L16 16m-2-2 1.6-1.6a2 2 0 0 1 2.8 0L20 14M14 8h.01M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z",
    sub: "الختم والتوقيع والترويسة والعلامة المائية للمستندات الصادرة",
  },
  communications: {
    icon: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6",
    sub: "قنوات إرسال رموز التحقق (OTP) والدعوات عبر SMS والبريد",
  },
  sla: {
    icon: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
    sub: "المهل الافتراضية بأيام العمل لأوامر العمل الجديدة",
  },
  report: {
    icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
    sub: "ثوابت ونصوص تقرير التقييم تُعبَّأ مرة وتُستهلك في كل تقرير — التعديل لا يغيّر ما سبق إصداره",
  },
};

function TabIcon({ path, size = 20 }: { path: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

function emptySettings(): OrganizationSettingsDto {
  return {
    company: { ...ORG_COMPANY_DEFAULTS },
    evaluator: {
      name: "",
      licenseNumber: "",
      membershipNumber: "",
      membershipCategory: "",
      licenseExpiresAt: "",
      membershipExpiresAt: "",
      licenseIssuedAt: "",
      licenseExpiresHijri: "",
      title: "",
    },
    valuers: [],
    branding: { ...BRAND_IDENTITY_DEFAULTS },
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
    valuation: { maxAdoptedComparables: 3, comparableTimeGapMonths: 6 },
    valuationReport: emptyValuationReportSettings(),
    updatedAtUtc: new Date().toISOString(),
  };
}

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("ar-SA", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return "—";
  }
}

const TAB_IDS = new Set<TabId>(TABS.map((t) => t.id));

function tabFromSearch(raw: string | null): TabId {
  if (raw === "branding") return "branding";
  if (raw && TAB_IDS.has(raw as TabId)) return raw as TabId;
  return "company";
}

export function OrganizationSettingsView() {
  const { showToast } = useToast();
  const canEdit = useCapability("manage-system-config");
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = tabFromSearch(searchParams.get("tab"));
  const setTab = useCallback(
    (id: TabId) => {
      router.replace(`/organization-settings?tab=${id}`, { scroll: false });
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

  if (tab === "branding") {
    return <BrandIdentityView />;
  }
  if (tab === "company") {
    return <OrganizationDataView />;
  }
  if (tab === "evaluator") {
    return <ValuersRosterView />;
  }
  if (tab === "report") {
    return <ProfessionalValuationReportView />;
  }

  async function onSave() {
    const config = organizationSettingsApiConfig();
    if (!config) return;
    setSaving(true);
    try {
      const result = await saveOrganizationSettings(config, {
        company: draft.company,
        evaluator: draft.evaluator,
        valuers: draft.valuers,
        branding: draft.branding,
        communications: draft.communications,
        sla: draft.sla,
        valuation: draft.valuation,
        valuationReport: draft.valuationReport,
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

  if (loading) {
    return (
      <PageShell variant="canvas" className="gap-0 p-4 sm:p-6" dir="rtl">
        <div className="flex items-center justify-center gap-2 py-20 text-text-3">
          <Spinner />
          <span className="text-[13px]">جاري تحميل الإعدادات…</span>
        </div>
      </PageShell>
    );
  }

  if (loadError) {
    return (
      <PageShell variant="canvas" className="gap-0 p-4 sm:p-6" dir="rtl">
        <Note tone="danger">{loadError}</Note>
      </PageShell>
    );
  }

  const active = TAB_META[tab];

  return (
    <PageShell
      variant="canvas"
      className="gap-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6"
      dir="rtl"
    >
      {!canEdit ? (
        <p className={cn(opsTfNote, "m-0 mb-3.5")}>
          عرض فقط — حفظ الإعدادات يتطلّب صلاحية ضبط النظام.
        </p>
      ) : null}

      {/* Settings sections — segmented buttons matching ops task pattern */}
      <div
        className={cn(opsTfSegRow, "mb-3.5")}
        role="tablist"
        aria-label="أقسام الإعدادات"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? opsTfSegActive : opsTfSeg}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Section card */}
      <section className={opsLetterCard}>
        <div className={opsLetterHead}>
          <div className="flex items-center gap-[11px]">
            <span className={opsIconBoxGold}>
              <TabIcon path={active.icon} />
            </span>
            <div>
              <div className={opsLetterTitle}>
                {TABS.find((t) => t.id === tab)?.label}
              </div>
              <div className={opsLetterSub}>{active.sub}</div>
            </div>
          </div>
          <span className="text-[11.5px] font-semibold text-text-3">
            آخر تحديث: {formatUpdatedAt(draft.updatedAtUtc)}
          </span>
        </div>

        <div className="px-4 pb-[18px] pt-4 sm:px-[18px]">
          {tab === "communications" ? (
            <>
              <p className={cn(opsTfNote, "m-0 mb-3.5")}>
                واجهة موحّدة لإرسال OTP والدعوات. الافتراضي <code>dev-log</code>{" "}
                يكتب الرمز في سجل الخادم. مفاتيح API وكلمات مرور SMTP لا تُعاد في
                الاستجابة — اترك الحقل فارغاً للإبقاء على القيمة الحالية.
              </p>
              <div className={opsFormGrid}>
                <div className={opsFld}>
                  <label htmlFor="org-otp-provider" className={opsTfLbl}>
                    مزوّد OTP
                  </label>
                  <select
                    id="org-otp-provider"
                    className={opsFldControl}
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
                  </select>
                </div>
                <div className={opsFld}>
                  <label htmlFor="org-otp-channel" className={opsTfLbl}>
                    قناة OTP الافتراضية
                  </label>
                  <select
                    id="org-otp-channel"
                    className={opsFldControl}
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
                  </select>
                </div>
                <div className={opsFld}>
                  <label htmlFor="org-sms-sender" className={opsTfLbl}>
                    معرّف مرسل SMS
                  </label>
                  <input
                    id="org-sms-sender"
                    className={opsFldControl}
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
                <div className={opsFld}>
                  <label htmlFor="org-email-from" className={opsTfLbl}>
                    بريد المرسل
                  </label>
                  <input
                    id="org-email-from"
                    className={opsFldControl}
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
                <div className={opsFldFull}>
                  <label htmlFor="org-sms-api-url" className={opsTfLbl}>
                    عنوان API للرسائل (SMS)
                  </label>
                  <input
                    id="org-sms-api-url"
                    className={opsFldControl}
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
                <div className={opsFldFull}>
                  <label htmlFor="org-sms-api-key" className={opsTfLbl}>
                    مفتاح API للرسائل
                    {draft.communications.smsApiKeyConfigured
                      ? " (محفوظ — اترك فارغاً للإبقاء)"
                      : ""}
                  </label>
                  <input
                    id="org-sms-api-key"
                    className={opsFldControl}
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
                <div className={opsFld}>
                  <label htmlFor="org-smtp-host" className={opsTfLbl}>
                    خادم SMTP
                  </label>
                  <input
                    id="org-smtp-host"
                    className={opsFldControl}
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
                <div className={opsFld}>
                  <label htmlFor="org-smtp-port" className={opsTfLbl}>
                    منفذ SMTP
                  </label>
                  <input
                    id="org-smtp-port"
                    className={opsFldControl}
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
                <div className={opsFld}>
                  <label htmlFor="org-smtp-user" className={opsTfLbl}>
                    مستخدم SMTP
                  </label>
                  <input
                    id="org-smtp-user"
                    className={opsFldControl}
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
                <div className={opsFld}>
                  <label htmlFor="org-smtp-password" className={opsTfLbl}>
                    كلمة مرور SMTP
                    {draft.communications.smtpPasswordConfigured ? " (محفوظة)" : ""}
                  </label>
                  <input
                    id="org-smtp-password"
                    className={opsFldControl}
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
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-2.5 rounded-[10px] border border-dashed border-border-md bg-surface-2 px-3.5 py-3">
                <div className={cn(opsFld, "min-w-[12rem] flex-1")}>
                  <label htmlFor="org-test-destination" className={opsTfLbl}>
                    وجهة اختبار (جوال أو بريد)
                  </label>
                  <input
                    id="org-test-destination"
                    className={cn(opsFldControl, "bg-surface")}
                    dir="ltr"
                    value={testDestination}
                    disabled={!canEdit}
                    onChange={(e) => setTestDestination(e.target.value)}
                    placeholder="+9665… أو email@…"
                  />
                </div>
                <button
                  type="button"
                  className={opsBtnGhost}
                  disabled={!canEdit || testing || !testDestination.trim()}
                  onClick={() => void runTest()}
                >
                  {testing ? <Spinner /> : null}
                  <span>{testing ? "جاري الإرسال…" : "اختبار الإرسال"}</span>
                </button>
              </div>
            </>
          ) : null}

          {tab === "sla" ? (
            <>
              <p className={cn(opsTfNote, "m-0 mb-3.5")}>
                التعديل يسري على أوامر العمل الجديدة فقط. الجارية تحتفظ بمهلتها
                المحسوبة عند الاستلام.
              </p>
              <div className={opsFormGrid}>
                <div className={opsFld}>
                  <label htmlFor="org-sla-default" className={opsTfLbl}>
                    أيام عمل — تنفيذ / تركات
                  </label>
                  <input
                    id="org-sla-default"
                    className={opsFldControl}
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
                <div className={opsFld}>
                  <label htmlFor="org-sla-private" className={opsTfLbl}>
                    أيام عمل — قطاع خاص
                  </label>
                  <input
                    id="org-sla-private"
                    className={opsFldControl}
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
                <div className={opsFld}>
                  <label htmlFor="org-max-adopted-comps" className={opsTfLbl}>
                    الحد الأقصى للمقارنات المعتمدة لكل تقييم
                  </label>
                  <input
                    id="org-max-adopted-comps"
                    className={opsFldControl}
                    type="number"
                    min={1}
                    max={20}
                    dir="ltr"
                    value={String(draft.valuation.maxAdoptedComparables)}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        valuation: {
                          ...d.valuation,
                          maxAdoptedComparables: Number(e.target.value) || 1,
                        },
                      }))
                    }
                  />
                </div>
                <div className={opsFld}>
                  <label htmlFor="org-comp-time-gap" className={opsTfLbl}>
                    عتبة الفارق الزمني للمقارن (أشهر) — تنبيه تسوية الزمن (ق-4)
                  </label>
                  <input
                    id="org-comp-time-gap"
                    className={opsFldControl}
                    type="number"
                    min={1}
                    max={60}
                    dir="ltr"
                    value={String(draft.valuation.comparableTimeGapMonths ?? 6)}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        valuation: {
                          ...d.valuation,
                          comparableTimeGapMonths: Number(e.target.value) || 6,
                        },
                      }))
                    }
                  />
                </div>
              </div>
            </>
          ) : null}

          <Can capability="manage-system-config">
            <div className={opsTfActions}>
              <button
                type="button"
                className={opsBtnPrimary}
                disabled={saving}
                aria-busy={saving || undefined}
                onClick={() => void onSave()}
              >
                {saving ? <Spinner /> : null}
                <span>{saving ? "جاري الحفظ…" : "✓ حفظ الإعدادات"}</span>
              </button>
            </div>
          </Can>
        </div>
      </section>
    </PageShell>
  );
}
