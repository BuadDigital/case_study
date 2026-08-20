"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ensureOpenValuationRequestByProperty,
  getValuationReportFieldPayload,
  getApiBase,
  VALUER_MEMBERSHIP_CATEGORIES,
  type OrganizationSettingsDto,
  type ValuationReportFieldDto,
  type ValuationReportFieldPayloadDto,
} from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";
import { ensureOrganizationSettingsLoaded } from "@platform/app-shared/organization/organization-settings-cache";
import { fetchInspectorWorkspace } from "@case-study/mfe/lib/prototype/inspector-workspace-storage";
import type { InspectorWorkspaceDraft } from "@case-study/mfe/lib/prototype/inspector-workspace-data";
import { cn } from "@platform/ui-kit";
import type { EvaluatorSubmission } from "../../lib/evaluator/evaluator-window-data";
import {
  VALUATION_REPORT_TAB_SECTIONS,
  catalogKeysUsedInReportTab,
  firstFilledValue,
  layerForSection,
  type ReportTabField,
  type ReportTabLayer,
  type ReportTabSection,
} from "../../lib/evaluator/valuation-report-tab-sections";
import { applyOrgSettingsToReportSections } from "../../lib/evaluator/valuation-report-org-overlay";
import {
  EngInfo,
  EngSection,
  engBoxClassName,
} from "./EvaluatorHtmlPrimitives";

function apiConfig() {
  const session = getAuthSession();
  if (!session?.token) return null;
  return { token: session.token, baseUrl: getApiBase() };
}

const SOURCE_LABEL: Record<string, string> = {
  Platform: "من النظام",
  Computed: "محسوب",
  Deferred: "يُستكمل",
  Asset: "مرفق",
  ConditionalEmpty: "إن لم ينطبق",
};

const LAYER_META: Record<
  ReportTabLayer,
  { label: string; hint: string; chip: string }
> = {
  settings: {
    label: "من إعدادات المنشأة",
    hint: "نصوص وثوابت تُحرَّر مرة في إعدادات المنشأة — تبويب تقرير التقييم. هنا للاطلاع.",
    chip: "border-gold-d/40 bg-gold-d/10 text-heading",
  },
  intake: {
    label: "من المعاينة والإسناد",
    hint: "إيداع المعاين وإضافات الأخصائي — يظهر للمقيم ولا يُعاد إدخاله.",
    chip: "border-border bg-surface-2 text-text-2",
  },
  appraiser: {
    label: "عمل المقيم",
    hint: "حسابات المقيم والاختيارات — تُحرَّر في تبويبات المقارنات والتقييم.",
    chip: "border-ink/20 bg-ink/5 text-heading",
  },
};

function membershipLabel(key?: string | null): string {
  const hit = VALUER_MEMBERSHIP_CATEGORIES.find((item) => item.value === key);
  return hit?.label ?? (key ?? "").trim();
}

function sourceLabel(kind?: string | null): string | null {
  if (!kind) return null;
  return SOURCE_LABEL[kind] ?? kind;
}

function mergeValues(
  payload: ValuationReportFieldPayloadDto | null,
  draft: EvaluatorSubmission,
  inspector: InspectorWorkspaceDraft | null,
  org: OrganizationSettingsDto | null,
): Record<string, string> {
  const values: Record<string, string> = {
    ...(payload?.valuesByFieldKey ?? {}),
  };
  const putIfEmpty = (key: string, raw: string | null | undefined) => {
    const next = (raw ?? "").trim();
    if (!next) return;
    if ((values[key] ?? "").trim()) return;
    values[key] = next;
  };

  putIfEmpty("valuer.name_ar", org?.evaluator.name);
  putIfEmpty("valuer.membership_number", org?.evaluator.membershipNumber);
  putIfEmpty("valuer.license_number", org?.evaluator.licenseNumber);

  putIfEmpty("report.deposit_code", draft.depositCode);
  putIfEmpty("basis_of_value_ar", draft.valueBasis);
  putIfEmpty("inspection_date", inspector?.inspectionDate);
  putIfEmpty("property_age_years", inspector?.propertyAgeYears);
  putIfEmpty("vacancy_ar", inspector?.featureValues.occupancyState);
  putIfEmpty("building_condition_ar", inspector?.featureValues.buildState);
  putIfEmpty("usage_type_ar", inspector?.featureValues.propertyUsage);
  putIfEmpty("property_type_ar", inspector?.featureValues.assetSubject);
  putIfEmpty("client_license_number", inspector?.buildLicenseNumber);
  putIfEmpty("geo_latitude", inspector?.mapLatitude);
  putIfEmpty("geo_longitude", inspector?.mapLongitude);
  putIfEmpty("inventory.6040", inspector?.roomCount);
  putIfEmpty("pending.6090", inspector?.hallCount);
  putIfEmpty("inventory.6540", inspector?.bathroomCount);
  putIfEmpty("final.opinion_value", draft.evaluatorPrice);
  putIfEmpty("final.liquidation_discount_pct", draft.forcedSaleDiscountPct);
  putIfEmpty("cost.land_value_from_market", draft.landValue);
  putIfEmpty("cost.buildings_only", draft.buildingValue);

  return values;
}

function amenityPresent(
  inspector: InspectorWorkspaceDraft | null,
  needle: string,
): string {
  const hit = (inspector?.amenities ?? []).some((item) => item.includes(needle));
  return hit ? "يوجد" : "";
}

function extraFieldValue(
  field: ReportTabField,
  draft: EvaluatorSubmission,
  inspector: InspectorWorkspaceDraft | null,
  org: OrganizationSettingsDto | null,
): string {
  switch (field.id) {
    case "valuer-branch":
    case "approve-branch":
      return (org?.valuationReport.valuationBranch ?? "").trim() || "فرع العقار";
    case "report-type":
      return (org?.valuationReport.reportType ?? "").trim() || "تقرير مفصل";
    case "currency":
      return (org?.valuationReport.currency ?? "").trim() || "الريال السعودي (ر.س.)";
    case "valuer-expiry":
    case "approve-expiry":
      return (
        org?.evaluator.membershipExpiresAt ||
        org?.evaluator.licenseExpiresAt ||
        ""
      ).trim();
    case "approve-class":
      return membershipLabel(org?.evaluator.membershipCategory);
    case "approve-role":
      return "المقيم المعتمد";
    case "ownership":
      return "ملكية مطلقة";
    case "approaches":
      return draft.valuationMethod.trim();
    case "search-notes":
      return draft.searchScopeNotes.trim();
    case "asset-desc":
      return (inspector?.propertyDescription ?? "").trim();
    case "land-area":
      return (inspector?.builtArea ?? "").trim();
    case "occupancy":
      return (inspector?.featureValues.occupancyState ?? "").trim();
    case "has-movables":
      return (inspector?.featureValues.movables ?? "").trim();
    case "surr-mosque":
      return amenityPresent(inspector, "مساجد");
    case "surr-medical":
      return amenityPresent(inspector, "مستشفيات");
    case "surr-market":
      return amenityPresent(inspector, "أسواق");
    case "surr-park":
      return amenityPresent(inspector, "حدائق");
    case "surr-school":
      return amenityPresent(inspector, "مدارس");
    case "surr-highway":
      return amenityPresent(inspector, "طرق");
    case "surr-other":
      return [...(inspector?.amenities ?? []), ...(inspector?.services ?? [])]
        .filter(Boolean)
        .join("، ");
    case "defects":
      return (inspector?.observations ?? [])
        .filter((row) => row.text.trim())
        .map((row) => row.text.trim())
        .join("؛ ");
    case "elevator": {
      const v = (inspector?.featureValues.hasElevator ?? "").trim();
      return v;
    }
    case "pool": {
      const v = (inspector?.featureValues.hasPool ?? "").trim();
      return v;
    }
    case "worker-1":
    case "worker-2":
    case "worker-3": {
      const index = Number(field.id.slice(-1)) - 1;
      const worker = draft.reportWorkers[index];
      if (!worker) return "";
      return [worker.role, worker.name, worker.licenseNumber]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(" · ");
    }
    default:
      return "";
  }
}

function FieldCell({
  label,
  value,
  source,
  ltr,
  span,
}: {
  label: string;
  value: string;
  source?: string | null;
  ltr?: boolean;
  span?: 1 | 2;
}) {
  return (
    <div className={cn(engBoxClassName, span === 2 && "sm:col-span-2")}>
      <div className="mb-[3px] flex items-center justify-between gap-2">
        <span className="text-[10.5px] text-text-3">{label}</span>
        {source ? (
          <span className="shrink-0 text-[9px] font-semibold text-text-3">
            {source}
          </span>
        ) : null}
      </div>
      <div
        className={cn(
          "whitespace-pre-wrap text-[12.5px] font-semibold text-text",
          !value && "font-medium text-text-3",
          ltr && "text-end [direction:ltr]",
        )}
      >
        {value || "—"}
      </div>
    </div>
  );
}

function ReportSectionBlock({
  section,
  values,
  byKey,
  draft,
  inspector,
  org,
}: {
  section: ReportTabSection;
  values: Record<string, string>;
  byKey: Map<string, ValuationReportFieldDto>;
  draft: EvaluatorSubmission;
  inspector: InspectorWorkspaceDraft | null;
  org: OrganizationSettingsDto | null;
}) {
  const fieldSource = (keys?: readonly string[]) => {
    for (const key of keys ?? []) {
      const kind = byKey.get(key)?.sourceKind;
      const label = sourceLabel(kind);
      if (label) return label;
    }
    return null;
  };

  const layer = layerForSection(section.n);
  const layerMeta = LAYER_META[layer];

  return (
    <section id={`vr-sec-${section.n}`} className="scroll-mt-4">
      <EngSection>
        <span className="me-2 inline-flex min-w-[1.75rem] justify-center rounded bg-ink px-1.5 py-px text-[10px] font-bold text-white">
          {section.n}
        </span>
        {section.title}
        <span
          className={cn(
            "ms-2 inline-flex rounded-full border px-2 py-px text-[9.5px] font-semibold",
            layerMeta.chip,
          )}
        >
          {layerMeta.label}
        </span>
      </EngSection>
      <p className="mb-3 text-[11.5px] leading-relaxed text-text-3">
        {section.hint ? `${section.hint} ` : ""}
        {layerMeta.hint}
      </p>
      {section.paragraphs?.map((p) => (
        <p
          key={p.slice(0, 48)}
          className="mb-2 text-[12.5px] leading-relaxed text-text-2"
        >
          {p}
        </p>
      ))}
      {section.bullets?.length ? (
        <ul className="mb-3 list-disc space-y-1 pe-1 ps-5 text-[12.5px] leading-relaxed text-text-2">
          {section.bullets.map((item) => (
            <li key={item.slice(0, 64)}>{item}</li>
          ))}
        </ul>
      ) : null}
      {section.fields?.length ? (
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {section.fields.map((field) => {
            const fromCatalog = firstFilledValue(
              field.keys,
              values,
              field.compose,
            );
            const value = fromCatalog || extraFieldValue(field, draft, inspector, org);
            return (
              <FieldCell
                key={field.id}
                label={field.label}
                value={value}
                source={fieldSource(field.keys)}
                ltr={field.ltr}
                span={field.span}
              />
            );
          })}
        </div>
      ) : null}
      {section.tables?.map((table, tableIndex) => (
        <div
          key={`${section.n}-t${tableIndex}`}
          className="mb-3 overflow-x-auto rounded-lg border border-border"
        >
          <table className="w-full min-w-[520px] border-collapse text-[12px]">
            <thead>
              <tr>
                {table.columns.map((col) => (
                  <th
                    key={col}
                    className="border-b border-border bg-surface-2 px-2.5 py-2 text-start font-semibold text-heading"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
                  {table.rows.map((row, rowIndex) => (
                <tr key={`${section.n}-r${rowIndex}`}>
                  {row.cells.map((cell, cellIndex) => {
                    const named = (cell.text ?? "").trim();
                    const fromKeys = firstFilledValue(cell.keys, values);
                    let value = named || fromKeys;
                    if (
                      !value &&
                      section.n === "14" &&
                      cellIndex === 1 &&
                      inspector
                    ) {
                      const service = (row.cells[0]?.text ?? "").trim();
                      if (
                        service &&
                        inspector.services.some(
                          (item) =>
                            item.includes(service.slice(0, 4)) ||
                            service.includes(item.slice(0, 4)),
                        )
                      ) {
                        value = "متوفر";
                      }
                    }
                    return (
                      <td
                        key={`${section.n}-c${rowIndex}-${cellIndex}`}
                        className="border-t border-border px-2.5 py-2 align-top text-text"
                      >
                        {value || (
                          <span className="text-text-3">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {section.pairs?.length ? (
        <div className="mb-3 flex flex-col gap-2">
          {section.pairs.map((pair) => (
            <FieldCell
              key={pair.term}
              label={pair.term}
              value={pair.text}
              span={2}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function EvaluatorValuationReportTab({
  propertyId,
  districtHint,
  draft,
  inspectionTaskId,
}: {
  propertyId: string;
  districtHint?: string;
  draft: EvaluatorSubmission;
  inspectionTaskId?: string | null;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ValuationReportFieldPayloadDto | null>(
    null,
  );
  const [inspector, setInspector] = useState<InspectorWorkspaceDraft | null>(
    null,
  );
  const [org, setOrg] = useState<OrganizationSettingsDto | null>(null);
  const [layerFilter, setLayerFilter] = useState<"all" | ReportTabLayer>("all");

  useEffect(() => {
    let cancelled = false;
    if (!inspectionTaskId) {
      setInspector(null);
      return;
    }
    void fetchInspectorWorkspace(inspectionTaskId)
      .then((ws) => {
        if (!cancelled) setInspector(ws);
      })
      .catch(() => {
        if (!cancelled) setInspector(null);
      });
    return () => {
      cancelled = true;
    };
  }, [inspectionTaskId]);

  useEffect(() => {
    let cancelled = false;
    void ensureOrganizationSettingsLoaded().then((loaded) => {
      if (!cancelled) setOrg(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const config = apiConfig();
    if (!config) {
      setLoading(false);
      setError("يلزم تسجيل الدخول");
      return;
    }
    if (!propertyId.trim()) {
      setLoading(false);
      setError("لا يوجد معرّف عقار");
      return;
    }

    setLoading(true);
    setError(null);
    void (async () => {
      const open = await ensureOpenValuationRequestByProperty(config, {
        propId: propertyId.trim(),
        area: districtHint?.trim() || "—",
        type: "—",
        appraiser: "—",
      });
      if (cancelled) return;
      if (!open.ok) {
        setPayload(null);
        setLoading(false);
        if (open.kind === "auth") setError("يلزم تسجيل الدخول");
        else if (open.kind === "network") setError("تعذّر الاتصال بخدمة التقييم");
        else setError("تعذّر فتح طلب التقييم — يُنشأ عند توزيع المعاملة على المقيم.");
        return;
      }
      const fields = await getValuationReportFieldPayload(config, open.data.id);
      if (cancelled) return;
      if (!fields.ok) {
        setPayload(null);
        setLoading(false);
        setError("تعذّر تحميل حقول تقرير التقييم.");
        return;
      }
      setPayload(fields.data);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [propertyId, districtHint]);

  const values = useMemo(
    () => mergeValues(payload, draft, inspector, org),
    [payload, draft, inspector, org],
  );
  const sections = useMemo(
    () => applyOrgSettingsToReportSections(VALUATION_REPORT_TAB_SECTIONS, org),
    [org],
  );
  const visibleSections = useMemo(
    () =>
      layerFilter === "all"
        ? sections
        : sections.filter((section) => layerForSection(section.n) === layerFilter),
    [sections, layerFilter],
  );
  const byKey = useMemo(() => {
    const map = new Map<string, ValuationReportFieldDto>();
    for (const field of payload?.fields ?? []) map.set(field.fieldKey, field);
    return map;
  }, [payload]);

  const leftover = useMemo(() => {
    if (!payload) return [];
    const used = new Set(catalogKeysUsedInReportTab());
    return payload.fields.filter((field) => !used.has(field.fieldKey));
  }, [payload]);

  return (
    <div className="flex flex-col gap-4">
      <EngSection>تقييم العقار</EngSection>
      <EngInfo>
        سطح مراجعة للنموذج الرسمي بثلاث طبقات: إعدادات المنشأة (نصوص ثابتة وختم
        وتوقيع)، إيداع المعاين وإضافات الأخصائي، ثم حسابات المقيم. لا يُعاد إدخال
        ما يملكه طرف آخر.
      </EngInfo>

      <div
        className="flex flex-wrap gap-1.5"
        role="tablist"
        aria-label="طبقات تقرير التقييم"
      >
        {(
          [
            ["all", "الكل"],
            ["settings", LAYER_META.settings.label],
            ["intake", LAYER_META.intake.label],
            ["appraiser", LAYER_META.appraiser.label],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={layerFilter === id}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
              layerFilter === id
                ? "border-gold-d bg-gold-d/10 text-heading"
                : "border-border bg-surface-2 text-text-2",
            )}
            onClick={() => setLayerFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <FieldCell label="رقم التقرير" value={draft.reportNo} ltr />
        <FieldCell
          label="تاريخ التقرير"
          value={draft.reportIssueDate || draft.appraisalDate}
          ltr
        />
        <FieldCell
          label="رمز إيداع التقرير"
          value={draft.depositCode || values["report.deposit_code"] || ""}
          ltr
        />
      </div>

      {payload ? (
        <p className="m-0 text-[11.5px] text-text-3">
          طلب {payload.displayId} · الكتالوج {payload.catalogCount} · مملوء{" "}
          {payload.filledCount} · قابل للحل {payload.resolvableCount} · مؤجّل{" "}
          {payload.deferredCount}
        </p>
      ) : null}

      <div className="-mx-1 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {visibleSections.map((section) => (
          <button
            key={section.n}
            type="button"
            className="shrink-0 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-text-2 hover:border-gold-d hover:text-heading"
            onClick={() =>
              document
                .getElementById(`vr-sec-${section.n}`)
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            {section.n}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-[12px] text-text-3">جاري تحميل حقول تقرير التقييم…</p>
      ) : null}
      {error ? <EngInfo variant="red">{error}</EngInfo> : null}

      {visibleSections.map((section) => (
        <ReportSectionBlock
          key={section.n}
          section={section}
          values={values}
          byKey={byKey}
          draft={draft}
          inspector={inspector}
          org={org}
        />
      ))}

      {leftover.length ? (
        <section>
          <EngSection>حقول إضافية من الكتالوج</EngSection>
          <p className="mb-3 text-[11.5px] leading-relaxed text-text-3">
            حقول حقن التقرير غير الظاهرة في ترتيب النموذج أعلاه.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {leftover.map((field) => (
              <FieldCell
                key={field.fieldKey}
                label={field.labelAr}
                value={(values[field.fieldKey] ?? field.value ?? "").trim()}
                source={sourceLabel(field.sourceKind)}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
