"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  applyIvsDateToStandards,
  CERTIFIED_VALUER_HTML_DEFAULTS,
  getApiBase,
  getValuationLists,
  VALUATION_REPORT_HTML_DEFAULTS as REPORT_DEFAULTS,
  VALUER_MEMBERSHIP_CATEGORIES,
  type OrganizationSettingsDto,
  type OrganizationValuerRosterEntry,
  type ValuationListItemDto,
  type ValuationListsDto,
} from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";
import { ensureOrganizationSettingsLoaded } from "@platform/app-shared/organization/organization-settings-cache";
import { fetchInspectorWorkspace } from "@case-study/mfe/lib/prototype/inspector-workspace-storage";
import type { InspectorWorkspaceDraft } from "@case-study/mfe/lib/prototype/inspector-workspace-data";
import type { PoPropertyIntake } from "@case-study/mfe/lib/prototype/po-intake-data";
import { usePoRecordQuery } from "@case-study/mfe/query/case-study-queries";
import { Spinner } from "@platform/ui-kit";
import type {
  EvaluatorReportChoices,
  EvaluatorSubmission,
} from "../../lib/evaluator/evaluator-window-data";
import { emptyReportChoices } from "../../lib/evaluator/evaluator-window-data";
import "./professional-valuation-report.css";

const UNUSED = "__unused__";
const ESG_ENV = ["كفاءة الطاقة", "أخطار الموقع والمناخ", "المباني الخضراء"];
const ESG_SOC = [
  "جودة التصاميم ورفاهية المسكن",
  "الإسهام المجتمعي للعقار",
  "الخدمات المتوفرة في الموقع",
];
const ESG_GOV = [
  "الامتثال التنظيمي",
  "الإدارة الفعالة لبيانات العقار",
  "مقومات تشغيل العقار",
];

function filled(value: string | null | undefined, fallback = "—"): string {
  const t = (value ?? "").trim();
  return t || fallback;
}

function memLabel(value: string | null | undefined): string {
  return (
    VALUER_MEMBERSHIP_CATEGORIES.find((x) => x.value === value)?.label ??
    filled(value)
  );
}

function slashDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[1]}/${m[2]}/${m[3]}` : iso;
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

function methodsForApproach(
  methods: ValuationListItemDto[],
  approach: string,
): ValuationListItemDto[] {
  return methods.filter((row) => (row.cells[0] ?? "").trim() === approach);
}

function Auto({ children, colSpan }: { children: ReactNode; colSpan?: number }) {
  return (
    <td className="v auto" colSpan={colSpan}>
      {children}
    </td>
  );
}

function K({
  children,
  nowrap = true,
}: {
  children: ReactNode;
  nowrap?: boolean;
}) {
  return (
    <td className="k" style={nowrap ? undefined : { whiteSpace: "normal" }}>
      {children}
    </td>
  );
}

function Sec({
  n,
  title,
  open,
  onToggle,
  children,
}: {
  n: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="sec">
      <h2 className="rpt-h" onClick={onToggle}>
        <span className="n">{n}</span>
        {title}
        <span className={open ? "chev" : "chev is-closed"}>▾</span>
      </h2>
      {open ? children : null}
    </section>
  );
}

function Pick({
  value,
  options,
  disabled,
  onChange,
  placeholder = "اختر…",
}: {
  value: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <select
      className="cell-input"
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function BulletView({ text }: { text: string }) {
  const items = text.split("\n").map((x) => x.trim()).filter(Boolean);
  if (!items.length) return <p>—</p>;
  return (
    <ul>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
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
    return <p className="sysnote">لا مشاركين نشطين في سجل المقيّمين.</p>;
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
          <K>فرع التقييم</K>
          {rows.map((p) => (
            <td className="v" key={`${p.id}-b`}>
              {filled(branch)}
            </td>
          ))}
        </tr>
        <tr>
          <K>رقم العضوية</K>
          {rows.map((p) => (
            <td className="v num" key={`${p.id}-m`}>
              {filled(p.membershipNumber)}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

function EsgRow({
  label,
  factors,
  none,
  selected,
  notes,
  disabled,
  onChange,
}: {
  label: string;
  factors: string[];
  none: boolean;
  selected: string[];
  notes: string;
  disabled?: boolean;
  onChange: (next: { none: boolean; selected: string[]; notes: string }) => void;
}) {
  return (
    <tr>
      <td className="k" style={{ whiteSpace: "normal", verticalAlign: "middle" }}>
        {label}
      </td>
      <td className="v">
        <label className="mb-1.5 flex items-center gap-1.5 text-[12px]">
          <input
            type="checkbox"
            disabled={disabled}
            checked={none}
            onChange={(e) =>
              onChange({
                none: e.target.checked,
                selected: e.target.checked ? [] : selected,
                notes,
              })
            }
          />
          لا يوجد
        </label>
        {factors.map((factor) => (
          <label key={factor} className="flex items-center gap-1.5 text-[12px]">
            <input
              type="checkbox"
              disabled={disabled || none}
              checked={!none && selected.includes(factor)}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...selected, factor]
                  : selected.filter((x) => x !== factor);
                onChange({ none: false, selected: next, notes });
              }}
            />
            {factor}
          </label>
        ))}
      </td>
      <td className="v">
        <textarea
          className="edit-p"
          rows={3}
          disabled={disabled || none}
          placeholder="وصف الأثر — لكل عامل مختار"
          value={notes}
          onChange={(e) =>
            onChange({ none, selected, notes: e.target.value })
          }
        />
      </td>
    </tr>
  );
}

export function EvaluatorValuationReportTab({
  draft,
  disabled = false,
  property,
  inspectionTaskId,
  onChange,
}: {
  draft: EvaluatorSubmission;
  disabled?: boolean;
  property?: PoPropertyIntake | null;
  inspectionTaskId?: string | null;
  onChange?: (choices: EvaluatorReportChoices, extras?: { valueBasis?: string; valuationMethod?: string }) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [org, setOrg] = useState<OrganizationSettingsDto | null>(null);
  const [lists, setLists] = useState<ValuationListsDto | null>(null);
  const [inspector, setInspector] = useState<InspectorWorkspaceDraft | null>(
    null,
  );
  const [open, setOpen] = useState<Record<string, boolean>>({ "02": true });
  const { data: record } = usePoRecordQuery(draft.poNumber);

  const choices = draft.reportChoices ?? emptyReportChoices();

  useEffect(() => {
    let cancelled = false;
    const session = getAuthSession();
    if (!session?.token) {
      setLoading(false);
      setError("يلزم تسجيل الدخول");
      return;
    }
    setLoading(true);
    void Promise.all([
      ensureOrganizationSettingsLoaded(),
      getValuationLists({ token: session.token, baseUrl: getApiBase() }),
    ]).then(([loadedOrg, listRes]) => {
      if (cancelled) return;
      setOrg(loadedOrg);
      if (listRes.ok) setLists(listRes.data);
      else setError("تعذّر تحميل قوائم التقييم");
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!inspectionTaskId) {
      setInspector(null);
      return;
    }
    let cancelled = false;
    void fetchInspectorWorkspace(inspectionTaskId).then((ws) => {
      if (!cancelled) setInspector(ws);
    });
    return () => {
      cancelled = true;
    };
  }, [inspectionTaskId]);

  const vr = useMemo(
    () => ({ ...REPORT_DEFAULTS, ...(org?.valuationReport ?? {}) }),
    [org],
  );
  const toggle = (n: string) => setOpen((s) => ({ ...s, [n]: !s[n] }));
  const isOpen = (n: string) => Boolean(open[n]);

  const purposes = enabledList(lists?.lists, "purposes");
  const bases = enabledList(lists?.lists, "valueBases");
  const premises = enabledList(lists?.lists, "premises");
  const methods = enabledList(lists?.lists, "methods");
  const glossary = enabledList(lists?.lists, "glossary");
  const ivs = enabledList(lists?.lists, "ivsStandards");
  const attachments = enabledList(lists?.lists, "attachments");
  const comparableCols = enabledList(lists?.lists, "comparables");
  const ivsDate = filled(lists?.ivsEffectiveDate, "31 يناير 2025");

  const ev = org?.evaluator ?? {};
  const htmlEv = CERTIFIED_VALUER_HTML_DEFAULTS;
  const parts = (org?.valuers ?? []).filter(
    (v) => v.role !== "certified" && v.isActive,
  );
  const selectedPurpose = purposes.find((p) => p.key === choices.purposeKey);
  const selectedBasis = bases.find((b) => b.key === choices.valueBasisKey);
  const basisDefinition = (selectedBasis?.cells[0] ?? "").trim();
  const specials = vr.specialAssumptionLibrary.filter((x) => x.trim());
  const assumptionOn =
    choices.specialAssumptionOn.length >= specials.length
      ? choices.specialAssumptionOn
      : specials.map((_, i) => choices.specialAssumptionOn[i] ?? true);

  const patch = useCallback(
    (
      next: Partial<EvaluatorReportChoices>,
      extras?: { valueBasis?: string; valuationMethod?: string },
    ) => {
      const merged: EvaluatorReportChoices = { ...choices, ...next };
      const methodKey =
        merged.marketMethodKey && merged.marketMethodKey !== UNUSED
          ? merged.marketMethodKey
          : merged.costMethodKey && merged.costMethodKey !== UNUSED
            ? merged.costMethodKey
            : merged.incomeMethodKey && merged.incomeMethodKey !== UNUSED
              ? merged.incomeMethodKey
              : "";
      const methodName = methods.find((m) => m.key === methodKey)?.name;
      const basisName = bases.find((b) => b.key === merged.valueBasisKey)?.name;
      onChange?.(merged, {
        valueBasis: extras?.valueBasis ?? basisName,
        valuationMethod: extras?.valuationMethod ?? methodName,
      });
    },
    [bases, choices, methods, onChange],
  );

  const setPurpose = (purposeKey: string) => {
    const purpose = purposes.find((p) => p.key === purposeKey);
    const usual = (purpose?.cells[0] ?? "").trim();
    const match = bases.find(
      (b) => b.name.trim() === usual || b.key === usual,
    );
    patch({
      purposeKey,
      valueBasisKey: match?.key ?? choices.valueBasisKey,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-text-3">
        <Spinner />
        <span className="text-[13px]">جاري تحميل تقرير التقييم…</span>
      </div>
    );
  }

  const loc = [property?.city, property?.district].filter(Boolean).join(" — ");
  const coords = [inspector?.mapLatitude, inspector?.mapLongitude]
    .filter((x) => (x ?? "").trim())
    .join(" ، ");
  const sides = [
    {
      name: "الشمالية",
      bound: property?.northBoundary,
      len: property?.northBoundaryLengthM,
      face: property?.northFacadeFinishing,
    },
    {
      name: "الجنوبية",
      bound: property?.southBoundary,
      len: property?.southBoundaryLengthM,
      face: property?.southFacadeFinishing,
    },
    {
      name: "الشرقية",
      bound: property?.eastBoundary,
      len: property?.eastBoundaryLengthM,
      face: property?.eastFacadeFinishing,
    },
    {
      name: "الغربية",
      bound: property?.westBoundary,
      len: property?.westBoundaryLengthM,
      face: property?.westFacadeFinishing,
    },
  ];
  const methodOpts = (approach: string) => [
    { value: UNUSED, label: "غير مستخدم" },
    ...methodsForApproach(methods, approach).map((m) => ({
      value: m.key,
      label: m.name,
    })),
  ];
  return (
    <div className="rpt-ref" dir="rtl">
      {error ? <p className="sysnote">{error}</p> : null}

      <section className="rpt-page">
        <div className="rpt-title">تقرير تقييم عقار</div>
        <Sec n="01" title="هوية المقيم المعتمد" open={isOpen("01")} onToggle={() => toggle("01")}>
          <p className="sysnote">ثابت — من إعدادات المنشأة / المقيّمون.</p>
          <table>
            <tbody>
              <tr>
                <K>اسم المقيم المعتمد</K>
                <Auto>{filled(ev.name, htmlEv.name)}</Auto>
                <K>رقم ترخيص مزاولة المهنة</K>
                <Auto>
                  <bdi>{filled(ev.licenseNumber, htmlEv.licenseNumber)}</bdi>
                </Auto>
              </tr>
              <tr>
                <K>تاريخ الإصدار</K>
                <Auto>
                  <bdi>{filled(ev.licenseIssuedAt, htmlEv.licenseIssuedAt)}</bdi>
                </Auto>
                <K>تاريخ الانتهاء</K>
                <Auto>
                  <bdi>
                    {filled(ev.licenseExpiresHijri, htmlEv.licenseExpiresHijri)}
                  </bdi>
                </Auto>
              </tr>
              <tr>
                <K>فرع التقييم</K>
                <Auto colSpan={3}>{filled(vr.valuationBranch)}</Auto>
              </tr>
            </tbody>
          </table>
        </Sec>

        <Sec n="02" title="نطاق العمل" open={isOpen("02")} onToggle={() => toggle("02")}>
          <table>
            <tbody>
              <tr>
                <K>اسم العميل</K>
                <Auto>{filled(record?.clientNameAr)}</Auto>
                <K>تاريخ التقييم</K>
                <Auto>{filled(draft.appraisalDate || draft.reportIssueDate)}</Auto>
              </tr>
              <tr>
                <K>مستخدمو التقرير</K>
                <Auto>{filled(record?.clientNameAr)}</Auto>
                <K>تاريخ المعاينة</K>
                <Auto>{filled(inspector?.inspectionDate)}</Auto>
              </tr>
              <tr>
                <K>اسم المالك</K>
                <Auto>{filled(property?.ownerName)}</Auto>
                <K>رقم الطلب</K>
                <Auto>
                  <bdi>{filled(property?.requestNumber)}</bdi>
                </Auto>
              </tr>
              <tr>
                <K>الغرض من التقييم</K>
                <td className="v">
                  <Pick
                    disabled={disabled}
                    value={choices.purposeKey}
                    onChange={setPurpose}
                    options={purposes.map((p) => ({ value: p.key, label: p.name }))}
                  />
                </td>
                <K>تاريخ الطلب</K>
                <Auto>{slashDate(record?.receivedFromEnfathAt)}</Auto>
              </tr>
              <tr>
                <K>أساس القيمة</K>
                <td className="v">
                  <Pick
                    disabled={disabled}
                    value={choices.valueBasisKey}
                    onChange={(valueBasisKey) => patch({ valueBasisKey })}
                    options={bases.map((b) => ({ value: b.key, label: b.name }))}
                  />
                </td>
                <K>فرضية القيمة</K>
                <td className="v">
                  <Pick
                    disabled={disabled}
                    value={choices.premiseKey}
                    onChange={(premiseKey) => patch({ premiseKey })}
                    options={premises.map((p) => ({ value: p.key, label: p.name }))}
                  />
                </td>
              </tr>
              <tr>
                <K>نوع التقرير</K>
                <Auto>{filled(vr.reportType)}</Auto>
                <K>عملة التقييم</K>
                <Auto>{filled(vr.currency)}</Auto>
              </tr>
              <tr>
                <K>نوع العقار</K>
                <Auto>
                  {filled(property?.propertyType || property?.classification)}
                </Auto>
                <K>رقم التقرير</K>
                <Auto>
                  <bdi>{filled(draft.reportNo)}</bdi>
                </Auto>
              </tr>
            </tbody>
          </table>
          <div className="scope-box">
            <p style={{ margin: "0 0 8px" }}>
              يعتمد أساس التقييم على تحديد{" "}
              <span className="auto">
                {filled(selectedBasis?.name || selectedPurpose?.name, "[أساس القيمة]")}
              </span>{" "}
              لموضوع التقييم في حالته الراهنة.
            </p>
            <ul style={{ margin: 0 }}>
              <li>
                {basisDefinition ||
                  "تعريف أساس القيمة — يتبدل تلقائيًا حسب الأساس المختار من قوائم التقييم."}
              </li>
            </ul>
          </div>
        </Sec>

        <Sec n="03" title="المدخلات الرئيسية" open={isOpen("03")} onToggle={() => toggle("03")}>
          <p className="sysnote">نص ثابت من تقرير التقييم المهني.</p>
          <BulletView text={vr.keyInputsText} />
        </Sec>
        <Sec
          n="04"
          title="التأكيد على الالتزام بمعايير التقييم الدولية"
          open={isOpen("04")}
          onToggle={() => toggle("04")}
        >
          <p>
            {applyIvsDateToStandards(vr.professionalStandards, ivsDate)
              .split(ivsDate)
              .map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 ? (
                    <span className="gold-date">{ivsDate}</span>
                  ) : null}
                </span>
              ))}
          </p>
        </Sec>
        <Sec
          n="05"
          title="إقرار بالاستقلالية وعدم تضارب المصالح"
          open={isOpen("05")}
          onToggle={() => toggle("05")}
        >
          <p>{filled(vr.independence)}</p>
        </Sec>
      </section>

      <section className="rpt-page">
        <Sec n="06" title="الأصل محل التقييم" open={isOpen("06")} onToggle={() => toggle("06")}>
          <table>
            <tbody>
              <tr>
                <K>نوع العقار</K>
                <Auto>{filled(property?.propertyType)}</Auto>
                <K>حالة العقار</K>
                <Auto>{filled(property?.deedStatus)}</Auto>
              </tr>
              <tr>
                <K>نوع الملكية</K>
                <Auto colSpan={3}>{filled(property?.ownershipType)}</Auto>
              </tr>
            </tbody>
          </table>
        </Sec>
        <Sec n="07" title="تفاصيل موقع العقار" open={isOpen("07")} onToggle={() => toggle("07")}>
          <table>
            <tbody>
              <tr>
                <K>اسم المنطقة</K>
                <Auto>{filled(property?.region)}</Auto>
                <K>اسم المدينة</K>
                <Auto>{filled(property?.city)}</Auto>
                <K>اسم الحي</K>
                <Auto>{filled(property?.district)}</Auto>
              </tr>
              <tr>
                <K>اسم المخطط</K>
                <Auto>{filled(property?.planName)}</Auto>
                <K>رقم المخطط</K>
                <Auto>{filled(property?.planNumber)}</Auto>
                <K>رقم البلك</K>
                <Auto>{filled(property?.blockNumber)}</Auto>
              </tr>
              <tr>
                <K>رقم القطعة</K>
                <Auto>{filled(property?.plotNumber)}</Auto>
                <K>استخدام العقار</K>
                <Auto>{filled(property?.classification)}</Auto>
                <K>إحداثيات الموقع</K>
                <Auto>
                  <bdi>{filled(coords)}</bdi>
                </Auto>
              </tr>
              <tr>
                <K>اسم المالك</K>
                <Auto>{filled(property?.ownerName)}</Auto>
                <K>رقم الصك</K>
                <Auto>
                  <bdi>{filled(property?.deedNumber)}</bdi>
                </Auto>
                <K>تاريخ الصك</K>
                <Auto>{filled(property?.deedDate)}</Auto>
              </tr>
              <tr>
                <K>عمر البناء</K>
                <Auto>{filled(inspector?.propertyAgeYears)}</Auto>
                <K>حالة البناء</K>
                <Auto>{filled(inspector?.featureValues.buildState)}</Auto>
                <K>حالة الإشغال</K>
                <Auto>{filled(inspector?.featureValues.occupancyState)}</Auto>
              </tr>
            </tbody>
          </table>
        </Sec>
        <Sec n="08" title="حدود وأطوال العقار" open={isOpen("08")} onToggle={() => toggle("08")}>
          <table className="mx">
            <thead>
              <tr>
                <th style={{ width: "18%" }}>الجهة</th>
                <th>الحد</th>
                <th style={{ width: "18%" }}>طول الضلع</th>
                <th style={{ width: "22%" }}>الواجهات</th>
              </tr>
            </thead>
            <tbody>
              {sides.map((side) => (
                <tr key={side.name}>
                  <td className="v">{side.name}</td>
                  <Auto>{filled(side.bound)}</Auto>
                  <Auto>{filled(side.len)}</Auto>
                  <Auto>{filled(side.face)}</Auto>
                </tr>
              ))}
            </tbody>
          </table>
        </Sec>
        <Sec n="09" title="تفاصيل المساحات" open={isOpen("09")} onToggle={() => toggle("09")}>
          <table>
            <tbody>
              <tr>
                <K>مساحة الأرض</K>
                <Auto>{filled(property?.area)}</Auto>
              </tr>
            </tbody>
          </table>
        </Sec>
        <Sec n="10" title="وصف حالة العقار" open={isOpen("10")} onToggle={() => toggle("10")}>
          <p className="sysnote">من المعاينة.</p>
          <table>
            <tbody>
              <tr>
                <K>حالة البناء</K>
                <Auto>{filled(inspector?.featureValues.buildState)}</Auto>
                <K>حالة الإشغال</K>
                <Auto>{filled(inspector?.featureValues.occupancyState)}</Auto>
              </tr>
            </tbody>
          </table>
        </Sec>
        <Sec n="11" title="مكونات العقار" open={isOpen("11")} onToggle={() => toggle("11")}>
          <p className="sysnote">من جرد المعاينة عند توفره.</p>
          <table>
            <tbody>
              <tr>
                <K>غرف</K>
                <Auto>{filled(inspector?.roomCount)}</Auto>
                <K>صالات</K>
                <Auto>{filled(inspector?.hallCount)}</Auto>
                <K>دورات مياه</K>
                <Auto>{filled(inspector?.bathroomCount)}</Auto>
              </tr>
            </tbody>
          </table>
        </Sec>
        <Sec n="12" title="مستوى تشطيبات البناء" open={isOpen("12")} onToggle={() => toggle("12")}>
          <p className="sysnote">اختيار المقيم — التفصيل من تقرير التقييم المهني.</p>
          <div className="mb-2">
            <Pick
              disabled={disabled}
              value={choices.finishingLevel}
              onChange={(finishingLevel) =>
                patch({
                  finishingLevel: finishingLevel as EvaluatorReportChoices["finishingLevel"],
                })
              }
              options={[
                { value: "luxury", label: "فاخر" },
                { value: "medium", label: "متوسط" },
                { value: "ordinary", label: "عادي" },
                { value: "none", label: "بدون تشطيب" },
              ]}
            />
          </div>
          {choices.finishingLevel === "luxury" ? (
            <BulletView text={vr.finishingLuxury} />
          ) : null}
          {choices.finishingLevel === "medium" ? (
            <BulletView text={vr.finishingMedium} />
          ) : null}
          {choices.finishingLevel === "ordinary" ? (
            <BulletView text={vr.finishingOrdinary} />
          ) : null}
          {choices.finishingLevel === "none" ? (
            <p>بدون تشطيب — يُطبع دون تفصيل.</p>
          ) : null}
        </Sec>
        <Sec n="13" title="وصف العيوب الإنشائية" open={isOpen("13")} onToggle={() => toggle("13")}>
          <p>
            لا توجد عيوب إنشائية ظاهرة وقت المعاينة، وما رُصد ملاحظات صيانة سطحية لا تؤثر في القيمة.
          </p>
        </Sec>
        <Sec
          n="14"
          title="الخدمات والمرافق المتوفرة بالعقار"
          open={isOpen("14")}
          onToggle={() => toggle("14")}
        >
          <p className="sysnote">من المعاينة عند توفرها — تُستكمل لاحقًا من جرد الخدمات.</p>
        </Sec>
      </section>

      <section className="rpt-page">
        <Sec n="15" title="المحيط المؤثر للعقار" open={isOpen("15")} onToggle={() => toggle("15")}>
          <p className="sysnote">يُستكمل من ملاحظات المعاينة.</p>
        </Sec>
        <Sec
          n="16"
          title="أسلوب وطريقة التقييم المستخدمة"
          open={isOpen("16")}
          onToggle={() => toggle("16")}
        >
          <p className="sysnote">من قائمة «أساليب وطرق التقييم» في قوائم التقييم.</p>
          <table className="mx">
            <thead>
              <tr>
                <th style={{ width: "33%" }}>أسلوب السوق</th>
                <th style={{ width: "33%" }}>أسلوب التكلفة</th>
                <th>أسلوب الدخل</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="v">
                  <Pick
                    disabled={disabled}
                    value={choices.marketMethodKey}
                    onChange={(marketMethodKey) => patch({ marketMethodKey })}
                    options={methodOpts("أسلوب السوق")}
                  />
                </td>
                <td className="v">
                  <Pick
                    disabled={disabled}
                    value={choices.costMethodKey}
                    onChange={(costMethodKey) => patch({ costMethodKey })}
                    options={methodOpts("أسلوب التكلفة")}
                  />
                </td>
                <td className="v">
                  <Pick
                    disabled={disabled}
                    value={choices.incomeMethodKey}
                    onChange={(incomeMethodKey) => patch({ incomeMethodKey })}
                    options={methodOpts("أسلوب الدخل")}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </Sec>
        <Sec n="17" title="العقارات المقارنة" open={isOpen("17")} onToggle={() => toggle("17")}>
          <p className="sysnote">
            أعمدة الجدول من قائمة «العقارات المقارنة» في قوائم التقييم. يُطبع إذا اختيرت طريقة
            المقارنة.
          </p>
          {comparableCols.length ? (
            <table className="mx">
              <thead>
                <tr>
                  {comparableCols.map((col) => (
                    <th key={col.id}>{col.name}</th>
                  ))}
                </tr>
              </thead>
            </table>
          ) : null}
        </Sec>
        <Sec n="18" title="خريطة مواقع المقارنات" open={isOpen("18")} onToggle={() => toggle("18")}>
          <div className="map-ph">تُولَّد من إحداثيات الأصل والمقارنات عند الإصدار</div>
        </Sec>
        <Sec n="19" title="جدول التسويات" open={isOpen("19")} onToggle={() => toggle("19")}>
          <p className="sysnote">ديناميكي — يظهر مع طريقة المقارنة.</p>
        </Sec>
        <Sec n="20" title="قيمة الأرض (أسلوب التكلفة)" open={isOpen("20")} onToggle={() => toggle("20")}>
          <p className="sysnote">يُطبع إذا اختير أسلوب التكلفة.</p>
          <table>
            <tbody>
              <tr>
                <K>قيمة الأرض</K>
                <Auto>{filled(draft.landValue)}</Auto>
              </tr>
            </tbody>
          </table>
        </Sec>
        <Sec n="21" title="بنود التكلفة المباشرة" open={isOpen("21")} onToggle={() => toggle("21")}>
          <p className="sysnote">شرط الظهور: أسلوب التكلفة + عقار مبني.</p>
        </Sec>
        <Sec n="22" title="التكاليف غير المباشرة" open={isOpen("22")} onToggle={() => toggle("22")}>
          <p className="sysnote">شرط الظهور: أسلوب التكلفة + عقار مبني.</p>
        </Sec>
        <Sec n="23" title="العمر والإهلاك" open={isOpen("23")} onToggle={() => toggle("23")}>
          <p className="sysnote">شرط الظهور: أسلوب التكلفة + عقار مبني.</p>
        </Sec>
        <Sec n="24" title="ترجيح أساليب التقييم" open={isOpen("24")} onToggle={() => toggle("24")}>
          <p className="sysnote">يظهر عند استخدام أكثر من أسلوب.</p>
        </Sec>
        <Sec n="25" title="القيمة النهائية للعقار" open={isOpen("25")} onToggle={() => toggle("25")}>
          <table>
            <tbody>
              <tr>
                <K>رأي القيمة</K>
                <Auto>{filled(draft.evaluatorPrice)}</Auto>
                <K>خصم التصفية ٪</K>
                <Auto>{filled(draft.forcedSaleDiscountPct)}</Auto>
              </tr>
            </tbody>
          </table>
        </Sec>
      </section>

      <section className="rpt-page">
        <Sec n="26" title="المشاركون في إعداد التقرير" open={isOpen("26")} onToggle={() => toggle("26")}>
          <ParticipantsTable rows={parts} branch={vr.valuationBranch} />
          <h2 className="rpt-h static">
            <span className="n">27</span>إعتماد تقرير التقييم
          </h2>
          <table className="ctr">
            <tbody>
              <tr>
                <K>الاسم</K>
                <td className="v">{filled(ev.name, htmlEv.name)}</td>
                <K>رقم العضوية</K>
                <td className="v num">
                  {filled(ev.membershipNumber, htmlEv.membershipNumber)}
                </td>
              </tr>
              <tr>
                <K>فرع التقييم</K>
                <td className="v">{filled(vr.valuationBranch)}</td>
                <K>فئة العضوية</K>
                <td className="v">
                  {memLabel(
                    filled(ev.membershipCategory, String(htmlEv.membershipCategory ?? "")),
                  )}
                </td>
              </tr>
              <tr>
                <K>صفته</K>
                <td className="v">{filled(ev.title, htmlEv.title)}</td>
                <K>تاريخ انتهاء العضوية</K>
                <td className="v num">
                  {slashDate(
                    filled(ev.membershipExpiresAt, htmlEv.membershipExpiresAt),
                  )}
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
          <BulletView text={vr.researchScopeText} />
        </Sec>
        <Sec n="29" title="الافتراضات الخاصة" open={isOpen("29")} onToggle={() => toggle("29")}>
          <p className="sysnote">أزل العبارة التي لا تصح على هذا العقار. يُطبع المُبقى فقط.</p>
          <ul>
            {specials.map((item, i) => (
              <li key={i}>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={assumptionOn[i] ?? true}
                    onChange={(e) => {
                      const next = [...assumptionOn];
                      next[i] = e.target.checked;
                      patch({ specialAssumptionOn: next });
                    }}
                  />
                  <span>{item}</span>
                </label>
              </li>
            ))}
          </ul>
        </Sec>
        <Sec
          n="30"
          title="العوامل البيئية والاجتماعية والحوكمة (ESG)"
          open={isOpen("30")}
          onToggle={() => toggle("30")}
        >
          <table>
            <thead>
              <tr>
                <th style={{ width: "16%" }}>المجموعة</th>
                <th style={{ width: "34%" }}>العوامل</th>
                <th>وصف الأثر</th>
              </tr>
            </thead>
            <tbody>
              <EsgRow
                label="التأثيرات البيئية"
                factors={ESG_ENV}
                none={choices.esgEnv.none}
                selected={choices.esgEnv.selected}
                notes={choices.esgEnv.notes}
                disabled={disabled}
                onChange={(esgEnv) => patch({ esgEnv })}
              />
              <EsgRow
                label="التأثيرات الاجتماعية"
                factors={ESG_SOC}
                none={choices.esgSoc.none}
                selected={choices.esgSoc.selected}
                notes={choices.esgSoc.notes}
                disabled={disabled}
                onChange={(esgSoc) => patch({ esgSoc })}
              />
              <EsgRow
                label="تأثيرات الحوكمة"
                factors={ESG_GOV}
                none={choices.esgGov.none}
                selected={choices.esgGov.selected}
                notes={choices.esgGov.notes}
                disabled={disabled}
                onChange={(esgGov) => patch({ esgGov })}
              />
            </tbody>
          </table>
        </Sec>
        <Sec
          n="31"
          title="الشروط والأحكام وإخلاء المسؤولية"
          open={isOpen("31")}
          onToggle={() => toggle("31")}
        >
          <BulletView text={vr.terms} />
        </Sec>
        <Sec n="32" title="القيود على الاستخدام والنشر" open={isOpen("32")} onToggle={() => toggle("32")}>
          <BulletView text={vr.restrictions} />
        </Sec>
        <Sec n="33" title="خريطة الأقمار الصناعية" open={isOpen("33")} onToggle={() => toggle("33")}>
          <table>
            <tbody>
              <tr>
                <K>الموقع</K>
                <Auto>{filled(loc)}</Auto>
                <K>إحداثيات الموقع</K>
                <Auto>
                  <bdi>{filled(coords)}</bdi>
                </Auto>
              </tr>
            </tbody>
          </table>
        </Sec>
        <Sec n="34" title="صور العقار" open={isOpen("34")} onToggle={() => toggle("34")}>
          <p className="sysnote">
            من المعاينة. صفحات الصور من قوائم التقييم: أرض {lists?.photoPagesLand ?? 1} · مبانٍ{" "}
            {lists?.photoPagesBuilt ?? 2}.
          </p>
        </Sec>
        <Sec n="35" title="التقرير المساحي" open={isOpen("35")} onToggle={() => toggle("35")}>
          <p className="sysnote">اختر المرفق ليُطبع — من قائمة مرفقات التقرير.</p>
          {attachments.map((row) => (
            <label key={row.id} className="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                disabled={disabled}
                checked={choices.printAttachmentKeys.includes(row.key)}
                onChange={(e) => {
                  const printAttachmentKeys = e.target.checked
                    ? [...choices.printAttachmentKeys, row.key]
                    : choices.printAttachmentKeys.filter((k) => k !== row.key);
                  patch({ printAttachmentKeys });
                }}
              />
              {row.name}
              {row.isRequired ? " (إلزامي)" : ""}
            </label>
          ))}
        </Sec>
        <Sec n="36" title="صك الملكية" open={isOpen("36")} onToggle={() => toggle("36")}>
          <p className="sysnote">من مستندات المعاملة.</p>
          <table>
            <tbody>
              <tr>
                <K>ملف الصك</K>
                <Auto>
                  {filled(
                    property?.deedOwnershipFileName ||
                      property?.bourseDeedImageFileName,
                  )}
                </Auto>
              </tr>
            </tbody>
          </table>
        </Sec>
        <Sec
          n="37"
          title="معايير التقييم الدولية العامة"
          open={isOpen("37")}
          onToggle={() => toggle("37")}
        >
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
        <Sec n="38" title="مصطلحات مهنية" open={isOpen("38")} onToggle={() => toggle("38")}>
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
  );
}
