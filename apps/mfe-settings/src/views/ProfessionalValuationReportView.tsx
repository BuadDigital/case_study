"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BRAND_IDENTITY_DEFAULTS,
  CERTIFIED_VALUER_HTML_DEFAULTS,
  VALUATION_REPORT_HTML_DEFAULTS as D,
  VALUER_MEMBERSHIP_CATEGORIES,
  VALUER_SYS_ROLES,
  applyIvsDateToStandards,
  getOrganizationSettings,
  getValuationLists,
  saveOrganizationSettings,
  type OrganizationSettingsDto,
  type OrganizationValuationReportSettings,
  type OrganizationValuerRosterEntry,
  type ValuationListItemDto,
  type ValuationListsDto,
} from "@platform/api-client";
import { useCapability } from "@platform/app-shared/components/Can";
import { Button, Note, PageShell, Spinner, useToast } from "@platform/ui-kit";
import { organizationSettingsApiConfig } from "../lib/settings-api-config";
import {
  Auto,
  K,
  Sec,
  ReportSourceTables,
  ReportDynamicTables,
} from "./professional-valuation-report-tables";

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const FINISH_LABEL_RE = /^(تشطيبات خارجية:|تشطيبات داخلية:)(.*)$/;

function filled(value: string | null | undefined, fallback: string): string {
  return value?.trim() ? value : fallback;
}

function slashDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = ISO_DATE_RE.exec(iso);
  return m ? `${m[1]}/${m[2]}/${m[3]}` : iso;
}

function memLabel(value: string | null | undefined): string {
  return VALUER_MEMBERSHIP_CATEGORIES.find((x) => x.value === value)?.label ?? value ?? "—";
}

function jobLabel(role: string): string {
  if (role === "valuer") return "مقيم عقاري";
  if (role === "reviewer") return "مقيم عقاري مراجع";
  if (role === "assistant") return "مساعد مقيم";
  return VALUER_SYS_ROLES.find((r) => r.value === role)?.label ?? role;
}

function enabledList(
  lists: Record<string, ValuationListItemDto[]> | undefined,
  id: string,
): ValuationListItemDto[] {
  return (lists?.[id] ?? [])
    .filter((r) => r.isEnabled)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

async function refreshOrgCache() {
  const { clearOrganizationSettingsCache, ensureOrganizationSettingsLoaded } =
    await import("@platform/app-shared/organization/organization-settings-cache");
  clearOrganizationSettingsCache();
  await ensureOrganizationSettingsLoaded();
}

function linesOf(text: string): string[] {
  const rows = text.split("\n").map((x) => x.trimEnd());
  return rows.length ? rows : [""];
}

function BulletEdit({
  text,
  canEdit,
  onChange,
}: {
  text: string;
  canEdit: boolean;
  onChange: (next: string) => void;
}) {
  const shown = linesOf(text).filter((x) => x.trim() || canEdit);
  const items = shown.length ? shown : [""];
  return (
    <ul>
      {items.map((item, i) => (
        <li key={i}>
          {canEdit ? (
            <textarea
              className="li-edit"
              rows={Math.max(1, Math.ceil(item.length / 90))}
              value={item}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                onChange(next.join("\n"));
              }}
            />
          ) : (
            item
          )}
        </li>
      ))}
    </ul>
  );
}

function ParaEdit({
  text,
  canEdit,
  onChange,
}: {
  text: string;
  canEdit: boolean;
  onChange: (next: string) => void;
}) {
  if (!canEdit) return <p>{text}</p>;
  return (
    <textarea
      className="edit-p"
      rows={Math.max(2, Math.ceil(text.length / 88))}
      value={text}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function FinishCell({
  text,
  canEdit,
  onChange,
}: {
  text: string;
  canEdit: boolean;
  onChange: (next: string) => void;
}) {
  if (canEdit) {
    return (
      <td className="v finish">
        <textarea
          className="edit-p"
          rows={8}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      </td>
    );
  }
  return (
    <td className="v finish">
      {linesOf(text).map((line, i) => {
        const m = FINISH_LABEL_RE.exec(line);
        return (
          <span key={i}>
            {i > 0 ? <br /> : null}
            {m ? (
              <>
                <b>{m[1]}</b>
                {m[2]}
              </>
            ) : (
              line
            )}
          </span>
        );
      })}
    </td>
  );
}

export function ProfessionalValuationReportView() {
  const { showToast } = useToast();
  const canEdit = useCapability("manage-system-config");
  const [org, setOrg] = useState<OrganizationSettingsDto | null>(null);
  const [lists, setLists] = useState<ValuationListsDto | null>(null);
  const [draft, setDraft] = useState<OrganizationValuationReportSettings>(D);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const config = organizationSettingsApiConfig();
    if (!config) {
      setLoading(false);
      setError("يلزم تسجيل الدخول");
      return;
    }
    setLoading(true);
    const [orgRes, listRes] = await Promise.all([
      getOrganizationSettings(config),
      getValuationLists(config),
    ]);
    setLoading(false);
    if (!orgRes.ok) {
      setError("تعذّر تحميل تقرير التقييم المهني");
      return;
    }
    setError(null);
    setOrg(orgRes.data);
    const vr = orgRes.data.valuationReport;
    setDraft({
      ...D,
      ...vr,
      reportType: filled(vr.reportType, D.reportType),
      currency: filled(vr.currency, D.currency),
      valuationBranch: filled(vr.valuationBranch, D.valuationBranch),
      keyInputsText: filled(vr.keyInputsText, D.keyInputsText),
      professionalStandards: filled(vr.professionalStandards, D.professionalStandards),
      independence: filled(vr.independence, D.independence),
      researchScopeText: filled(vr.researchScopeText, D.researchScopeText),
      terms: filled(vr.terms, D.terms),
      restrictions: filled(vr.restrictions, D.restrictions),
      finishingLuxury: filled(vr.finishingLuxury, D.finishingLuxury),
      finishingMedium: filled(vr.finishingMedium, D.finishingMedium),
      finishingOrdinary: filled(vr.finishingOrdinary, D.finishingOrdinary),
      specialAssumptionLibrary:
        vr.specialAssumptionLibrary.filter((x) => x.trim()).length > 0
          ? vr.specialAssumptionLibrary
          : D.specialAssumptionLibrary,
    });
    if (listRes.ok) setLists(listRes.data);
    setDirty(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const patch = (next: Partial<OrganizationValuationReportSettings>) => {
    setDraft((d) => ({ ...d, ...next }));
    setDirty(true);
  };

  const toggle = (n: string) => setOpen((s) => ({ ...s, [n]: !s[n] }));
  const isOpen = (n: string) => Boolean(open[n]);

  const ivsDate = filled(lists?.ivsEffectiveDate, "31 يناير 2025");
  const ev = org?.evaluator ?? {};
  const htmlEv = CERTIFIED_VALUER_HTML_DEFAULTS;
  const certName = filled(ev.name, htmlEv.name ?? "");
  const stamp = filled(org?.branding.stampUrl, BRAND_IDENTITY_DEFAULTS.stampUrl);
  const parts = useMemo(
    () => (org?.valuers ?? []).filter((v) => v.role !== "certified" && v.isActive),
    [org],
  );
  const glossary = enabledList(lists?.lists, "glossary");
  const ivs = enabledList(lists?.lists, "ivsStandards");

  async function persist() {
    const config = organizationSettingsApiConfig();
    if (!config) return;
    setSaving(true);
    const res = await saveOrganizationSettings(config, { valuationReport: draft });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ تقرير التقييم المهني", "error");
      return;
    }
    setOrg(res.data);
    setDirty(false);
    await refreshOrgCache();
    showToast("تم الحفظ وقُيّد في سجل التدقيق.", "success");
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

  const listsHref = "/attachment-print-dictionary";
  const valuersHref = "/organization-settings?tab=evaluator";
  const orgHref = "/organization-settings?tab=company";
  const brandHref = "/organization-settings?tab=branding";

  return (
    <PageShell variant="canvas" className="gap-0 px-4 pb-4 pt-2 sm:px-6 sm:pb-6" dir="rtl">
      {!canEdit ? (
        <Note tone="warn" className="mb-3 max-w-[560px]">
          الرابط صحيح، لكن دورك الحالي لا يملك صلاحية هذا البند. اطلب الصلاحية من مسؤول النظام.
        </Note>
      ) : null}
      {error ? <Note tone="warn">{error}</Note> : null}

      {/* قرار 23: نسخة واحدة لحزمة النصوص كلها — أي تعديل ولو في فقرة يصدر حزمة جديدة؛
          قيد العمل يتبنى الأحدث، والمُصدَر مجمّد على نصوصه لحظة الإصدار. */}
      <Note tone="info" className="mb-3 max-w-[560px]">
        حزمة النصوص المعيارية/القانونية — <strong>نسخة {org?.valuationReport.textPackageVersion ?? 1}</strong>
        {" · "}أي تعديل في النصوص يصدر حزمة جديدة كاملة، والتقارير المُصدَرة تبقى مجمّدة على
        نصوصها (قرار 23).
      </Note>

      <div className="rpt-ref">
        <section className="rpt-page">
          <div className="rpt-title">تقرير تقييم عقار</div>

          <Sec n="01" title="هوية المقيم المعتمد" open={isOpen("01")} onToggle={() => toggle("01")}>
            <table>
              <tbody>
                <tr>
                  <K>اسم المقيم المعتمد</K>
                  <Auto>
                    يُعبَّأ من{" "}
                    <Link href={valuersHref} className="rpt-link">
                      «المقيّمون»
                    </Link>
                    {" — "}
                    {certName}
                  </Auto>
                  <K>رقم ترخيص مزاولة المهنة</K>
                  <Auto>
                    <bdi>{filled(ev.licenseNumber, htmlEv.licenseNumber ?? "")}</bdi>
                  </Auto>
                </tr>
                <tr>
                  <K>تاريخ الإصدار</K>
                  <Auto>
                    <bdi>{filled(ev.licenseIssuedAt, htmlEv.licenseIssuedAt ?? "")}</bdi>
                  </Auto>
                  <K>تاريخ الانتهاء</K>
                  <Auto>
                    <bdi>
                      {filled(ev.licenseExpiresHijri, htmlEv.licenseExpiresHijri ?? "")}
                    </bdi>
                  </Auto>
                </tr>
                <tr>
                  <K>فرع التقييم</K>
                  <td className="v" colSpan={3}>
                    <input
                      className="cell-input"
                      disabled={!canEdit}
                      value={draft.valuationBranch}
                      onChange={(e) => patch({ valuationBranch: e.target.value })}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </Sec>

          <Sec n="02" title="نطاق العمل" open={isOpen("02")} onToggle={() => toggle("02")}>
            <table>
              <tbody>
                <tr>
                  <K>اسم العميل</K>
                  <Auto>يُعبَّأ تلقائيًا من المعاملة — اسم العميل</Auto>
                  <K>تاريخ التقييم</K>
                  <Auto>يُعبَّأ تلقائيًا عند اعتماد قيمة العقار في النظام</Auto>
                </tr>
                <tr>
                  <K>مستخدمو التقرير</K>
                  <Auto>يُعبَّأ تلقائيًا من المعاملة — من حقل «مستخدمو التقرير» في النظام</Auto>
                  <K>تاريخ المعاينة</K>
                  <Auto>يُعبَّأ تلقائيًا عند إكمال المعاين دوره في النظام</Auto>
                </tr>
                <tr>
                  <K>اسم المالك</K>
                  <Auto>
                    ملكية مطلقة: مالك واحد بنسبة 100% (من حقل «اسم المالك» في النظام) · مشاع:
                    للمستخدم الخيار — كتابة اسم مالك واحد أو أي نص، أو إضافة الملاك مع نسب الملكية
                  </Auto>
                  <K>رقم الطلب</K>
                  <Auto>يُعبَّأ تلقائيًا من المعاملة — من حقل «رقم الطلب» في النظام</Auto>
                </tr>
                <tr>
                  <K>الغرض من التقييم</K>
                  <Auto>
                    يُختار في المعاملة من{" "}
                    <Link href={listsHref} className="rpt-link">
                      قوائم التقييم
                    </Link>
                    {" — قائمة «أغراض التقييم»"}
                  </Auto>
                  <K>تاريخ الطلب</K>
                  <Auto>يُعبَّأ تلقائيًا من المعاملة — من حقل «تاريخ الطلب» في النظام</Auto>
                </tr>
                <tr>
                  <K>أساس القيمة</K>
                  <Auto>يُختار في المعاملة من قائمة «أساس القيمة» المرجعية</Auto>
                  <K>فرضية القيمة (الاستخدام المفترض)</K>
                  <Auto>يُختار في المعاملة من قائمة «فرضية القيمة» المرجعية</Auto>
                </tr>
                <tr>
                  <K>نوع التقرير</K>
                  <td className="v">
                    <input
                      className="cell-input"
                      disabled={!canEdit}
                      value={draft.reportType}
                      onChange={(e) => patch({ reportType: e.target.value })}
                    />
                  </td>
                  <K>عملة التقييم</K>
                  <td className="v">
                    <input
                      className="cell-input"
                      disabled={!canEdit}
                      value={draft.currency}
                      onChange={(e) => patch({ currency: e.target.value })}
                    />
                  </td>
                </tr>
                <tr>
                  <K>نوع العقار</K>
                  <Auto>يُعبَّأ تلقائيًا من المعاملة — من حقل «نوع العقار» في النظام</Auto>
                  <K>أساليب التقييم المستخدمة</K>
                  <Auto>يُعبَّأ عند اختيار المقيم أسلوب التقييم المناسب للعقار في المعاملة</Auto>
                </tr>
              </tbody>
            </table>
            <div className="scope-box">
              <p style={{ margin: "0 0 8px" }}>
                يعتمد أساس التقييم على تحديد{" "}
                <span className="auto">[أساس القيمة — يُؤخذ من الأساس المختار في المعاملة]</span>{" "}
                لموضوع التقييم في حالته الراهنة، وعلى أساس أن العقار خالٍ من جميع الأعباء والشروط
                المقيدة والموافقات والإشعارات القانونية، وعليه فإن المفهوم المتبع في هذا التقرير عن{" "}
                <span className="auto">[أساس القيمة]</span> هو المفهوم الذي تم تقديمه في المعيار 102
                من معايير التقييم الدولية (2025).
              </p>
              <ul style={{ margin: 0 }}>
                <li className="auto">
                  تعريف أساس القيمة — يتبدل تلقائيًا حسب الأساس المختار في المعاملة، من قائمة «أساس
                  القيمة» في «قوائم التقييم».
                </li>
                <li>
                  أُعد هذا التقرير لاستخدام العميل (
                  <span className="auto">
                    مستخدمو التقرير — يُؤخذ من حقل «مستخدمو التقرير» في النظام
                  </span>
                  ) فقط، ولا يوجد مستخدمون آخرون للتقرير، ولا يجوز استخدامه من قبل مستخدم آخر إلا
                  بإذن خطي موقع ومختوم بختم الشركة.
                </li>
              </ul>
            </div>
          </Sec>

          <Sec n="03" title="المدخلات الرئيسية" open={isOpen("03")} onToggle={() => toggle("03")}>
            <p className="sysnote">نص ثابت — يُطبع كما هو.</p>
            <BulletEdit
              text={draft.keyInputsText}
              canEdit={canEdit}
              onChange={(keyInputsText) => patch({ keyInputsText })}
            />
          </Sec>

          <Sec
            n="04"
            title="التأكيد على الالتزام بمعايير التقييم الدولية"
            open={isOpen("04")}
            onToggle={() => toggle("04")}
          >
            <p className="sysnote">
              نص ثابت — المتغير الوحيد تاريخ سريان المعايير، من{" "}
              <Link href={listsHref} className="rpt-link">
                قوائم التقييم
              </Link>
              .
            </p>
            {canEdit ? (
              <ParaEdit
                text={draft.professionalStandards}
                canEdit
                onChange={(professionalStandards) => patch({ professionalStandards })}
              />
            ) : (
              <p>
                {applyIvsDateToStandards(draft.professionalStandards, ivsDate)
                  .split(ivsDate)
                  .map((part, i, arr) => (
                    <span key={i}>
                      {part}
                      {i < arr.length - 1 ? (
                        <span className="gold-date" title="من قوائم التقييم">
                          {ivsDate}
                        </span>
                      ) : null}
                    </span>
                  ))}
              </p>
            )}
          </Sec>

          <Sec
            n="05"
            title="إقرار بالاستقلالية وعدم تضارب المصالح"
            open={isOpen("05")}
            onToggle={() => toggle("05")}
          >
            <p className="sysnote">
              نص ثابت — يُطبع كما هو، واسم الشركة من{" "}
              <Link href={orgHref} className="rpt-link">
                بيانات المنشأة
              </Link>
              .
            </p>
            <ParaEdit
              text={draft.independence}
              canEdit={canEdit}
              onChange={(independence) => patch({ independence })}
            />
          </Sec>
        </section>

        <ReportSourceTables
          isOpen={isOpen}
          toggle={toggle}
          finishing={
            <Sec
              n="12"
              title="مستوى تشطيبات البناء"
              open={isOpen("12")}
              onToggle={() => toggle("12")}
            >
              <p className="sysnote">
                إدخال (اختيار) — يختار المستخدم المستوى: فاخر / متوسط / عادي / بدون تشطيب. عند
                اختيار أي مستوى يُطبع في التقرير تفصيله المذكور أسفله، إلا «بدون تشطيب» فيُطبع دون
                تفصيل.
              </p>
              <table className="mx">
                <thead>
                  <tr>
                    <th style={{ width: "33.3%" }}>تشطيب فاخر</th>
                    <th style={{ width: "33.3%" }}>تشطيب متوسط</th>
                    <th>تشطيب عادي</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <FinishCell
                      text={draft.finishingLuxury}
                      canEdit={canEdit}
                      onChange={(finishingLuxury) => patch({ finishingLuxury })}
                    />
                    <FinishCell
                      text={draft.finishingMedium}
                      canEdit={canEdit}
                      onChange={(finishingMedium) => patch({ finishingMedium })}
                    />
                    <FinishCell
                      text={draft.finishingOrdinary}
                      canEdit={canEdit}
                      onChange={(finishingOrdinary) => patch({ finishingOrdinary })}
                    />
                  </tr>
                  <tr>
                    <th colSpan={3}>بدون تشطيب</th>
                  </tr>
                </tbody>
              </table>
            </Sec>
          }
        />

        <ReportDynamicTables isOpen={isOpen} toggle={toggle} />

        <section className="rpt-page">
          <Sec
            n="26"
            title="المشاركون في إعداد التقرير"
            open={isOpen("26")}
            onToggle={() => toggle("26")}
          >
            <p className="sysnote">
              بند ثابت في التقرير — بياناته من سجل{" "}
              <Link href={valuersHref} className="rpt-link">
                «المقيّمون»
              </Link>
              .
            </p>
            <ParticipantsTable rows={parts} branch={draft.valuationBranch} />
            <h2 className="rpt-h static">
              <span className="n">27</span>إعتماد تقرير التقييم
            </h2>
            <p className="sysnote">
              بند ثابت — مصدره المقيّمون و{" "}
              <Link href={brandHref} className="rpt-link">
                الهوية البصرية
              </Link>{" "}
              (ختم المنشأة).
            </p>
            <table className="ctr">
              <tbody>
                <tr>
                  <K>الاسم</K>
                  <td className="v" style={{ width: "35%" }}>
                    {certName}
                  </td>
                  <K>رقم العضوية</K>
                  <td className="v num">
                    {filled(ev.membershipNumber, htmlEv.membershipNumber ?? "")}
                  </td>
                </tr>
                <tr>
                  <K>فرع التقييم</K>
                  <td className="v">{filled(draft.valuationBranch, D.valuationBranch)}</td>
                  <K>فئة العضوية</K>
                  <td className="v">
                    {memLabel(
                      filled(ev.membershipCategory, String(htmlEv.membershipCategory ?? "")),
                    )}
                  </td>
                </tr>
                <tr>
                  <K>صفته</K>
                  <td className="v">{filled(ev.title, htmlEv.title ?? "")}</td>
                  <K>تاريخ انتهاء العضوية</K>
                  <td className="v num">
                    {slashDate(
                      filled(ev.membershipExpiresAt, htmlEv.membershipExpiresAt ?? ""),
                    )}
                  </td>
                </tr>
                <tr>
                  <K>التوقيع</K>
                  <td className="v" style={{ height: 64 }}>
                    {org?.branding.signatureUrl ? (
                      <img
                        src={org.branding.signatureUrl}
                        alt=""
                        style={{ height: 48, objectFit: "contain" }}
                      />
                    ) : (
                      <span className="auto">يُرفع من «المقيّمون»</span>
                    )}
                  </td>
                  <K>ختم المنشأة</K>
                  <td className="v" style={{ textAlign: "center" }}>
                    <img src={stamp} alt="ختم المنشأة" style={{ height: 60 }} />
                  </td>
                </tr>
              </tbody>
            </table>
          </Sec>
        </section>

        <section className="rpt-page">
          <Sec
            n="28"
            title="نطاق البحث وطبيعة ومصدر المعلومات"
            open={isOpen("28")}
            onToggle={() => toggle("28")}
          >
            <p className="sysnote">نص ثابت — يُطبع في التقرير كما هو.</p>
            <p>تـم الاعتمـاد على مصـادر المعلومـات التاليـة في إصـدار الرأي حـول قيمـة العقـار:</p>
            <BulletEdit
              text={draft.researchScopeText}
              canEdit={canEdit}
              onChange={(researchScopeText) => patch({ researchScopeText })}
            />
          </Sec>
          <Sec n="29" title="الافتراضات الخاصة" open={isOpen("29")} onToggle={() => toggle("29")}>
            <p className="sysnote">
              تظهر العبارات كلها عند إعداد التقرير وعلى كل عبارة مربع اختيار — يزيل المستخدم العبارة
              التي لا تصح على العقار، ويُطبع المُبقى فقط.
            </p>
            <ul>
              {draft.specialAssumptionLibrary.map((item, index) => (
                <li key={index}>
                  {canEdit ? (
                    <textarea
                      className="li-edit"
                      rows={Math.max(2, Math.ceil(item.length / 90))}
                      value={item}
                      onChange={(e) =>
                        patch({
                          specialAssumptionLibrary: draft.specialAssumptionLibrary.map((x, i) =>
                            i === index ? e.target.value : x,
                          ),
                        })
                      }
                    />
                  ) : (
                    item
                  )}
                </li>
              ))}
            </ul>
            {canEdit ? (
              <button
                type="button"
                className="add-line"
                onClick={() =>
                  patch({
                    specialAssumptionLibrary: [...draft.specialAssumptionLibrary, ""],
                  })
                }
              >
                + إضافة افتراض
              </button>
            ) : null}
          </Sec>
        </section>

        <section className="rpt-page">
          <Sec
            n="30"
            title="العوامل البيئية والاجتماعية والحوكمة (ESG)"
            open={isOpen("30")}
            onToggle={() => toggle("30")}
          >
            <p className="sysnote">
              بند اختياري — يعبّئها الأخصائي من مستندات العقار (المجموعات الثلاث)، وتظهر للمقيّم
              للعرض فقط وتُطبع في التقرير.
            </p>
            <table>
              <thead>
                <tr>
                  <th style={{ width: "16%" }}>المجموعة</th>
                  <th style={{ width: "26%" }}>العوامل المتاحة للاختيار</th>
                  <th>وصف الأثر</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="k" style={{ whiteSpace: "normal", verticalAlign: "middle" }}>
                    التأثيرات البيئية
                  </td>
                  <td className="v">
                    كفاءة الطاقة · أخطار الموقع والمناخ · المباني الخضراء
                    <div className="esg-or">أو «لا يوجد»</div>
                  </td>
                  <Auto>إدخال — يكتبه الأخصائي عند وجود تأثير</Auto>
                </tr>
                <tr>
                  <td className="k" style={{ whiteSpace: "normal", verticalAlign: "middle" }}>
                    التأثيرات الاجتماعية
                  </td>
                  <td className="v">
                    جودة التصاميم ورفاهية المسكن · الإسهام المجتمعي للعقار · الخدمات المتوفرة في
                    الموقع
                    <div className="esg-or">أو «لا يوجد»</div>
                  </td>
                  <Auto>إدخال — يكتبه الأخصائي عند وجود تأثير</Auto>
                </tr>
                <tr>
                  <td className="k" style={{ whiteSpace: "normal", verticalAlign: "middle" }}>
                    تأثيرات الحوكمة
                  </td>
                  <td className="v">
                    الامتثال التنظيمي · الإدارة الفعالة لبيانات العقار · مقومات تشغيل العقار
                    <div className="esg-or">أو «لا يوجد»</div>
                  </td>
                  <Auto>إدخال — يكتبه الأخصائي عند وجود تأثير</Auto>
                </tr>
              </tbody>
            </table>
          </Sec>
        </section>

        <section className="rpt-page">
          <Sec
            n="31"
            title="الشروط والأحكام وإخلاء المسؤولية"
            open={isOpen("31")}
            onToggle={() => toggle("31")}
          >
            <p className="sysnote">
              نص ثابت — يُطبع كما هو، وبعض البنود تحمل شرط ظهور موضّحاً داخلها (مثل بند المباني
              والعقارات القائمة).
            </p>
            <BulletEdit
              text={draft.terms}
              canEdit={canEdit}
              onChange={(terms) => patch({ terms })}
            />
          </Sec>
        </section>

        <section className="rpt-page">
          <Sec
            n="32"
            title="القيود على الاستخدام والنشر"
            open={isOpen("32")}
            onToggle={() => toggle("32")}
          >
            <p className="sysnote">
              نص ثابت — يُطبع كما هو، وبعض البنود تحمل متغيرات أو شروط ظهور موضّحة داخلها.
            </p>
            <BulletEdit
              text={draft.restrictions}
              canEdit={canEdit}
              onChange={(restrictions) => patch({ restrictions })}
            />
          </Sec>
        </section>

        <section className="rpt-page">
          <Sec
            n="33"
            title="خريطة الأقمار الصناعية"
            open={isOpen("33")}
            onToggle={() => toggle("33")}
          >
            <p className="sysnote">
              خريطة ديناميكية — لا صورة تُرفع: تُولَّد آليًا عبر API محرك الخرائط من إحداثيات
              العقار وحدود القطعة، وتُطبع في التقرير كلقطة وقت الإصدار.
            </p>
            <h3 className="rpt-h3">خريطة الموقع العام</h3>
            <table>
              <tbody>
                <tr>
                  <K>الموقع</K>
                  <Auto>المدينة والحي — من النظام</Auto>
                  <K>إحداثيات الموقع</K>
                  <Auto>من النظام (المعاينة)</Auto>
                </tr>
              </tbody>
            </table>
            <p className="sysnote">
              خريطة ديناميكية — تُولَّد آليًا من محرك الخرائط بمستوى تقريب أقرب للموقع.
            </p>
          </Sec>
        </section>

        <section className="rpt-page">
          <Sec n="34" title="صور العقار" open={isOpen("34")} onToggle={() => toggle("34")}>
            <p className="sysnote">
              من النظام — الصور يلتقطها المعاين ويرفعها في المعاينة، وتُدرج تلقائيًا هنا بترتيبها
              ووسومها وتاريخ الالتقاط. عدد الصفحات من تبويب «صفحات الصور» في{" "}
              <Link href={listsHref} className="rpt-link">
                قوائم التقييم
              </Link>{" "}
              (6 صور بالصفحة) — أرض <bdi>{lists?.photoPagesLand ?? 1}</bdi> · مبانٍ{" "}
              <bdi>{lists?.photoPagesBuilt ?? 2}</bdi>.
            </p>
          </Sec>
        </section>

        <section className="rpt-page">
          <Sec n="35" title="التقرير المساحي" open={isOpen("35")} onToggle={() => toggle("35")}>
            <p className="sysnote">
              من المرفقات — مستند يرفعه المستخدمون على النظام، ويختاره الأخصائي بعلامة «للتقرير»
              من مستندات العقار ليظهر في التقرير. قائمة المرفقات وإلزاميتها من تبويب «مرفقات التقرير» في
              قوائم التقييم. <strong>شرط الظهور:</strong> يُطبع فقط إذا اختير.
            </p>
          </Sec>
        </section>

        <section className="rpt-page">
          <Sec n="36" title="صك الملكية" open={isOpen("36")} onToggle={() => toggle("36")}>
            <p className="sysnote">
              من المرفقات — مستند يرفعه المستخدمون على النظام، ويختاره الأخصائي بعلامة «للتقرير»
              من مستندات العقار ليظهر في التقرير. قائمة المرفقات وإلزاميتها من تبويب «مرفقات التقرير» في قوائم
              التقييم.
            </p>
          </Sec>
        </section>

        <section className="rpt-page">
          <Sec
            n="37"
            title="معايير التقييم الدولية العامة"
            open={isOpen("37")}
            onToggle={() => toggle("37")}
          >
            <p className="sysnote">
              تُطبع من قائمة «معايير التقييم الدولية» في{" "}
              <Link href={listsHref} className="rpt-link">
                قوائم التقييم
              </Link>{" "}
              — المفعَّل يظهر، والأوصاف تُحرَّر هناك.
            </p>
            <table className="def">
              <tbody>
                {ivs.map((row) => (
                  <tr key={row.id}>
                    <td className="k" style={{ width: "22%", whiteSpace: "normal" }}>
                      {row.name}
                    </td>
                    <td>{row.cells[0] ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Sec>
        </section>

        <section className="rpt-page">
          <Sec n="38" title="مصطلحات مهنية" open={isOpen("38")} onToggle={() => toggle("38")}>
            <p className="sysnote">
              تُطبع كما هي — بياناتها من قائمة «المصطلحات المهنية» في قوائم التقييم، والمفعَّل
              منها يظهر.
            </p>
            <table className="tight">
              <tbody>
                {glossary.map((row) => (
                  <tr key={row.id}>
                    <td className="k" style={{ width: "20%", whiteSpace: "normal" }}>
                      {row.name}
                    </td>
                    <td>{row.cells[0] ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Sec>
        </section>
      </div>

      {canEdit ? (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2.5">
          {dirty ? (
            <span className="flex items-center gap-1.5 text-[11.5px] text-amber-text">
              <span className="size-1.5 rounded-full bg-warning" />
              تعديل غير محفوظ
            </span>
          ) : null}
          <Button variant="primary" loading={saving} onClick={() => void persist()}>
            حفظ
          </Button>
        </div>
      ) : null}
    </PageShell>
  );
}

function ParticipantsTable({
  rows,
  branch,
}: {
  rows: OrganizationValuerRosterEntry[];
  branch: string;
}) {
  if (!rows.length) {
    return <p className="sysnote">لا مشاركين نشطين في السجل بعد.</p>;
  }
  return (
    <table className="ctr">
      <tbody>
        <tr>
          <K>الاسم</K>
          {rows.map((p) => (
            <td className="v" key={p.id}>
              {p.nameAr}
            </td>
          ))}
        </tr>
        <tr>
          <K>المسمى الوظيفي</K>
          {rows.map((p) => (
            <td className="v" key={p.id}>
              {jobLabel(p.role)}
            </td>
          ))}
        </tr>
        <tr>
          <K>فئة العضوية</K>
          {rows.map((p) => (
            <td className="v" key={p.id}>
              {memLabel(p.membershipCategory)}
            </td>
          ))}
        </tr>
        <tr>
          <K>رقم العضوية</K>
          {rows.map((p) => (
            <td className="v num" key={p.id}>
              {p.membershipNumber || "—"}
            </td>
          ))}
        </tr>
        <tr>
          <K>تاريخ انتهاء العضوية</K>
          {rows.map((p) => (
            <td className="v num" key={p.id}>
              {slashDate(p.membershipExpiresAt)}
            </td>
          ))}
        </tr>
        <tr>
          <K>فرع التقييم</K>
          {rows.map((p) => (
            <td className="v" key={p.id}>
              {branch}
            </td>
          ))}
        </tr>
        <tr>
          <K>التوقيع</K>
          {rows.map((p) => (
            <td className="v" style={{ height: 52 }} key={p.id}>
              {p.signatureUrl ? (
                <img src={p.signatureUrl} alt="" style={{ height: 40, objectFit: "contain" }} />
              ) : (
                <span className="auto">—</span>
              )}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}
