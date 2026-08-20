"use client";

import { useCallback, useEffect, useState } from "react";
import { getOrganizationSettings, saveOrganizationSettings, testOrganizationCommunication, emptyValuationReportSettings, type OrganizationSettingsDto, type OrganizationValuationReportSettings, type OrganizationValuerRosterEntry, VALUER_MEMBERSHIP_CATEGORIES } from "@platform/api-client";
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
import { organizationSettingsApiConfig } from "../lib/settings-api-config";

type TabId =
  | "company"
  | "evaluator"
  | "branding"
  | "communications"
  | "sla"
  | "report";

const TABS: { id: TabId; label: string }[] = [
  { id: "company", label: "بيانات الشركة" },
  { id: "evaluator", label: "المقيم المعتمد" },
  { id: "branding", label: "الهوية والأصول" },
  { id: "communications", label: "الاتصالات" },
  { id: "sla", label: "معايير المهل" },
  { id: "report", label: "تقرير التقييم" },
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

const REPORT_TEXT_FIELDS: {
  key: keyof OrganizationValuationReportSettings;
  label: string;
  rows: number;
}[] = [
  { key: "keyInputsText", label: "المدخلات الرئيسية", rows: 5 },
  {
    key: "professionalStandards",
    label: "التأكيد على الالتزام بمعايير التقييم الدولية",
    rows: 4,
  },
  { key: "independence", label: "إقرار الاستقلالية وعدم تضارب المصالح", rows: 4 },
  { key: "researchScopeText", label: "نطاق البحث وطبيعة ومصدر المعلومات", rows: 8 },
  { key: "terms", label: "الشروط والأحكام وإخلاء المسؤولية", rows: 8 },
  { key: "restrictions", label: "القيود على الاستخدام والنشر", rows: 6 },
  { key: "ivsStandards", label: "معايير التقييم الدولية العامة", rows: 8 },
  { key: "glossary", label: "المصطلحات المهنية", rows: 8 },
  { key: "finishingLuxury", label: "مرجع تشطيب فاخر", rows: 3 },
  { key: "finishingMedium", label: "مرجع تشطيب متوسط", rows: 3 },
  { key: "finishingOrdinary", label: "مرجع تشطيب عادي", rows: 3 },
];

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

function emptyValuer(): OrganizationValuerRosterEntry {
  return {
    id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    nameAr: "",
    licenseNumber: "",
    membershipNumber: "",
    membershipCategory: "",
    licenseExpiresAt: "",
    membershipExpiresAt: "",
    role: "assistant",
    isActive: true,
  };
}

function emptySettings(): OrganizationSettingsDto {
  return {
    company: { name: "شركة إجادة المهنية للتقييم", taxNumber: "", address: "" },
    evaluator: {
      name: "",
      licenseNumber: "",
      membershipNumber: "",
      membershipCategory: "",
      licenseExpiresAt: "",
      membershipExpiresAt: "",
    },
    valuers: [],
    branding: {
      stampUrl: "/case-study/ejadah-stamp.png",
      signatureUrl: "/case-study/ejadah-signature.png",
      headerUrl: "",
      letterheadUrl: "",
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
          {tab === "company" ? (
            <div className={opsFormGrid}>
              <div className={opsFldFull}>
                <label htmlFor="org-company-name" className={opsTfLbl}>
                  اسم الشركة
                </label>
                <input
                  id="org-company-name"
                  className={opsFldControl}
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
              <div className={opsFld}>
                <label htmlFor="org-tax-number" className={opsTfLbl}>
                  الرقم الضريبي
                </label>
                <input
                  id="org-tax-number"
                  className={opsFldControl}
                  dir="ltr"
                  placeholder="3xxxxxxxxxxxxxx"
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
              <div className={opsFldFull}>
                <label htmlFor="org-address" className={opsTfLbl}>
                  العنوان
                </label>
                <input
                  id="org-address"
                  className={opsFldControl}
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
            </div>
          ) : null}

          {tab === "evaluator" ? (
            <div className={opsFormGrid}>
              <div className={opsFldFull}>
                <label htmlFor="org-evaluator-name" className={opsTfLbl}>
                  اسم المقيم المعتمد
                </label>
                <input
                  id="org-evaluator-name"
                  className={opsFldControl}
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
              <div className={opsFld}>
                <label htmlFor="org-license-no" className={opsTfLbl}>
                  رقم الترخيص
                </label>
                <input
                  id="org-license-no"
                  className={opsFldControl}
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
              <div className={opsFld}>
                <label htmlFor="org-membership-no" className={opsTfLbl}>
                  رقم العضوية
                </label>
                <input
                  id="org-membership-no"
                  className={opsFldControl}
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
              <div className={opsFld}>
                <label htmlFor="org-membership-cat" className={opsTfLbl}>
                  فئة العضوية
                </label>
                <select
                  id="org-membership-cat"
                  className={opsFldControl}
                  value={draft.evaluator.membershipCategory ?? ""}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      evaluator: {
                        ...d.evaluator,
                        membershipCategory: e.target.value,
                      },
                    }))
                  }
                >
                  <option value="">اختر فئة العضوية…</option>
                  {VALUER_MEMBERSHIP_CATEGORIES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={opsFld}>
                <label htmlFor="org-license-expires" className={opsTfLbl}>
                  انتهاء ترخيص المزاولة
                </label>
                <input
                  id="org-license-expires"
                  className={opsFldControl}
                  type="date"
                  dir="ltr"
                  value={draft.evaluator.licenseExpiresAt ?? ""}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      evaluator: {
                        ...d.evaluator,
                        licenseExpiresAt: e.target.value,
                      },
                    }))
                  }
                />
              </div>
              <div className={opsFld}>
                <label htmlFor="org-membership-expires" className={opsTfLbl}>
                  انتهاء / سريان العضوية
                </label>
                <input
                  id="org-membership-expires"
                  className={opsFldControl}
                  type="date"
                  dir="ltr"
                  value={draft.evaluator.membershipExpiresAt ?? ""}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      evaluator: {
                        ...d.evaluator,
                        membershipExpiresAt: e.target.value,
                      },
                    }))
                  }
                />
              </div>

              <div className={opsFldFull}>
                <p className={cn(opsTfNote, "m-0 mb-2")}>
                  قائمة المشاركين (بالإضافة للمقيم المعتمد أعلاه) — تظهر في قسم المشاركين بالتقرير وحقن مقياس.
                </p>
                {(draft.valuers ?? []).map((row, index) => (
                  <div
                    key={row.id || `valuer-${index}`}
                    className={cn(opsFormGrid, "mb-3 rounded-md border border-[var(--border)] p-3")}
                  >
                    <div className={opsFldFull}>
                      <label className={opsTfLbl} htmlFor={`valuer-name-${index}`}>
                        الاسم
                      </label>
                      <input
                        id={`valuer-name-${index}`}
                        className={opsFldControl}
                        value={row.nameAr}
                        disabled={!canEdit}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            valuers: d.valuers.map((v, i) =>
                              i === index ? { ...v, nameAr: e.target.value } : v,
                            ),
                          }))
                        }
                      />
                    </div>
                    <div className={opsFld}>
                      <label className={opsTfLbl} htmlFor={`valuer-role-${index}`}>
                        الدور
                      </label>
                      <select
                        id={`valuer-role-${index}`}
                        className={opsFldControl}
                        value={row.role}
                        disabled={!canEdit}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            valuers: d.valuers.map((v, i) =>
                              i === index ? { ...v, role: e.target.value } : v,
                            ),
                          }))
                        }
                      >
                        <option value="certified">معتمد</option>
                        <option value="assistant">مساعد</option>
                        <option value="reviewer">مراجع</option>
                      </select>
                    </div>
                    <div className={opsFld}>
                      <label className={opsTfLbl} htmlFor={`valuer-active-${index}`}>
                        الحالة
                      </label>
                      <select
                        id={`valuer-active-${index}`}
                        className={opsFldControl}
                        value={row.isActive ? "1" : "0"}
                        disabled={!canEdit}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            valuers: d.valuers.map((v, i) =>
                              i === index
                                ? { ...v, isActive: e.target.value === "1" }
                                : v,
                            ),
                          }))
                        }
                      >
                        <option value="1">نشط</option>
                        <option value="0">موقوف</option>
                      </select>
                    </div>
                    <div className={opsFld}>
                      <label className={opsTfLbl} htmlFor={`valuer-lic-${index}`}>
                        رقم الترخيص
                      </label>
                      <input
                        id={`valuer-lic-${index}`}
                        className={opsFldControl}
                        dir="ltr"
                        value={row.licenseNumber ?? ""}
                        disabled={!canEdit}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            valuers: d.valuers.map((v, i) =>
                              i === index
                                ? { ...v, licenseNumber: e.target.value }
                                : v,
                            ),
                          }))
                        }
                      />
                    </div>
                    <div className={opsFld}>
                      <label className={opsTfLbl} htmlFor={`valuer-mem-${index}`}>
                        رقم العضوية
                      </label>
                      <input
                        id={`valuer-mem-${index}`}
                        className={opsFldControl}
                        dir="ltr"
                        value={row.membershipNumber ?? ""}
                        disabled={!canEdit}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            valuers: d.valuers.map((v, i) =>
                              i === index
                                ? { ...v, membershipNumber: e.target.value }
                                : v,
                            ),
                          }))
                        }
                      />
                    </div>
                    <div className={opsFld}>
                      <label className={opsTfLbl} htmlFor={`valuer-mem-cat-${index}`}>
                        فئة العضوية
                      </label>
                      <select
                        id={`valuer-mem-cat-${index}`}
                        className={opsFldControl}
                        value={row.membershipCategory ?? ""}
                        disabled={!canEdit}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            valuers: d.valuers.map((v, i) =>
                              i === index
                                ? { ...v, membershipCategory: e.target.value }
                                : v,
                            ),
                          }))
                        }
                      >
                        <option value="">اختر فئة العضوية…</option>
                        {VALUER_MEMBERSHIP_CATEGORIES.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className={opsFld}>
                      <label className={opsTfLbl} htmlFor={`valuer-lic-exp-${index}`}>
                        انتهاء ترخيص المزاولة
                      </label>
                      <input
                        id={`valuer-lic-exp-${index}`}
                        className={opsFldControl}
                        type="date"
                        dir="ltr"
                        value={row.licenseExpiresAt ?? ""}
                        disabled={!canEdit}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            valuers: d.valuers.map((v, i) =>
                              i === index
                                ? { ...v, licenseExpiresAt: e.target.value }
                                : v,
                            ),
                          }))
                        }
                      />
                    </div>
                    <div className={opsFld}>
                      <label className={opsTfLbl} htmlFor={`valuer-mem-exp-${index}`}>
                        انتهاء / سريان العضوية
                      </label>
                      <input
                        id={`valuer-mem-exp-${index}`}
                        className={opsFldControl}
                        type="date"
                        dir="ltr"
                        value={row.membershipExpiresAt ?? ""}
                        disabled={!canEdit}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            valuers: d.valuers.map((v, i) =>
                              i === index
                                ? { ...v, membershipExpiresAt: e.target.value }
                                : v,
                            ),
                          }))
                        }
                      />
                    </div>
                    {canEdit ? (
                      <div className={opsFldFull}>
                        <button
                          type="button"
                          className={opsBtnGhost}
                          onClick={() =>
                            setDraft((d) => ({
                              ...d,
                              valuers: d.valuers.filter((_, i) => i !== index),
                            }))
                          }
                        >
                          إزالة
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
                {canEdit ? (
                  <button
                    type="button"
                    className={opsBtnGhost}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        valuers: [...(d.valuers ?? []), emptyValuer()],
                      }))
                    }
                  >
                    إضافة مشارك
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {tab === "branding" ? (
            <div className={opsFormGrid}>
              <div className={opsFldFull}>
                <label htmlFor="org-stamp-url" className={opsTfLbl}>
                  رابط الختم
                </label>
                <input
                  id="org-stamp-url"
                  className={opsFldControl}
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
              <div className={opsFldFull}>
                <label htmlFor="org-signature-url" className={opsTfLbl}>
                  رابط التوقيع
                </label>
                <input
                  id="org-signature-url"
                  className={opsFldControl}
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
              <div className={opsFld}>
                <label htmlFor="org-header-url" className={opsTfLbl}>
                  رابط الترويسة (اختياري)
                </label>
                <input
                  id="org-header-url"
                  className={opsFldControl}
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
              <div className={opsFld}>
                <label htmlFor="org-letterhead-url" className={opsTfLbl}>
                  رابط كليشة التقرير (ثلاث شرائح — اختياري)
                </label>
                <input
                  id="org-letterhead-url"
                  className={opsFldControl}
                  dir="ltr"
                  placeholder="/ejadah/ejadah-letterhead.png"
                  value={draft.branding.letterheadUrl ?? ""}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      branding: { ...d.branding, letterheadUrl: e.target.value },
                    }))
                  }
                />
              </div>
              <div className={opsFld}>
                <label htmlFor="org-watermark" className={opsTfLbl}>
                  نص العلامة المائية
                </label>
                <input
                  id="org-watermark"
                  className={opsFldControl}
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
            </div>
          ) : null}

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

          {tab === "report" ? (
            <>
              <p className={cn(opsTfNote, "m-0 mb-3.5")}>
                هذه الطبقة خاصة بتقرير التقييم وحده. الختم والتوقيع من تبويب
                الهوية والأصول، وهوية المقيم المعتمد وقائمة المشاركين من تبويب
                المقيم المعتمد. التقارير المُصدَرة تجمّد نسخة وقت الإصدار.
              </p>
              <div className="mb-3.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={opsBtnGhost}
                  onClick={() => setTab("branding")}
                >
                  الهوية والأصول — الختم والتوقيع
                </button>
                <button
                  type="button"
                  className={opsBtnGhost}
                  onClick={() => setTab("evaluator")}
                >
                  المقيم المعتمد — الهوية والقائمة
                </button>
              </div>
              <div className={opsFormGrid}>
                <div className={opsFld}>
                  <label htmlFor="org-report-type" className={opsTfLbl}>
                    نوع التقرير
                  </label>
                  <input
                    id="org-report-type"
                    className={opsFldControl}
                    value={draft.valuationReport.reportType}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        valuationReport: {
                          ...d.valuationReport,
                          reportType: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <div className={opsFld}>
                  <label htmlFor="org-report-currency" className={opsTfLbl}>
                    عملة التقييم
                  </label>
                  <input
                    id="org-report-currency"
                    className={opsFldControl}
                    value={draft.valuationReport.currency}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        valuationReport: {
                          ...d.valuationReport,
                          currency: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <div className={opsFldFull}>
                  <label htmlFor="org-report-branch" className={opsTfLbl}>
                    فرع التقييم
                  </label>
                  <input
                    id="org-report-branch"
                    className={opsFldControl}
                    value={draft.valuationReport.valuationBranch}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        valuationReport: {
                          ...d.valuationReport,
                          valuationBranch: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              </div>
              <div className="mt-3.5 space-y-3">
                {REPORT_TEXT_FIELDS.map((field) => {
                  const value = draft.valuationReport[field.key];
                  return (
                    <div key={field.key} className={opsFldFull}>
                      <label
                        htmlFor={`org-report-${field.key}`}
                        className={opsTfLbl}
                      >
                        {field.label}
                      </label>
                      <textarea
                        id={`org-report-${field.key}`}
                        className={cn(opsFldControl, "min-h-[5.5rem] py-2")}
                        rows={field.rows}
                        value={typeof value === "string" ? value : ""}
                        disabled={!canEdit}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            valuationReport: {
                              ...d.valuationReport,
                              [field.key]: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-4">
                <p className="m-0 text-[12px] font-bold text-heading">
                  مكتبة الافتراضات الخاصة
                </p>
                <p className="mt-1 text-[11px] text-text-3">
                  بنود جاهزة ينتقي منها المقيّم في نافذته (مع إمكان إضافته الحرة).
                  النص يُجمَّد مع كل تقييم لحظة انتقائه — تعديل المكتبة لا يغيّر ما سبق.
                </p>
                <div className="mt-2 space-y-2">
                  {draft.valuationReport.specialAssumptionLibrary.map(
                    (item, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          className={cn(opsFldControl, "flex-1")}
                          value={item}
                          disabled={!canEdit}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              valuationReport: {
                                ...d.valuationReport,
                                specialAssumptionLibrary:
                                  d.valuationReport.specialAssumptionLibrary.map(
                                    (x, i) => (i === index ? e.target.value : x),
                                  ),
                              },
                            }))
                          }
                        />
                        {canEdit ? (
                          <button
                            type="button"
                            className="rounded-md border border-border-md px-2 text-[11px] text-text-2"
                            onClick={() =>
                              setDraft((d) => ({
                                ...d,
                                valuationReport: {
                                  ...d.valuationReport,
                                  specialAssumptionLibrary:
                                    d.valuationReport.specialAssumptionLibrary.filter(
                                      (_, i) => i !== index,
                                    ),
                                },
                              }))
                            }
                          >
                            حذف
                          </button>
                        ) : null}
                      </div>
                    ),
                  )}
                  {canEdit ? (
                    <button
                      type="button"
                      className="rounded-md border border-border-md px-3 py-1.5 text-[11px] text-text-2"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          valuationReport: {
                            ...d.valuationReport,
                            specialAssumptionLibrary: [
                              ...d.valuationReport.specialAssumptionLibrary,
                              "",
                            ],
                          },
                        }))
                      }
                    >
                      + إضافة بند افتراض
                    </button>
                  ) : null}
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
