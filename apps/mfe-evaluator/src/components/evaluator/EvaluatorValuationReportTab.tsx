"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getApiBase,
  getValuationLists,
  VALUATION_REPORT_HTML_DEFAULTS as REPORT_DEFAULTS,
  type OrganizationSettingsDto,
  type ValuationListItemDto,
  type ValuationListsDto,
} from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";
import { ensureOrganizationSettingsLoaded } from "@platform/app-shared/organization/organization-settings-cache";
import { fetchInspectorWorkspace } from "@case-study/mfe/lib/prototype/inspector-workspace-storage";
import type { InspectorWorkspaceDraft } from "@case-study/mfe/lib/prototype/inspector-workspace-data";
import type { PoPropertyIntake } from "@case-study/mfe/lib/prototype/po-intake-data";
import { subClientIdFromReportUsers } from "@case-study/mfe/lib/prototype/po-intake-data";
import { usePoRecordQuery } from "@case-study/mfe/query/case-study-queries";
import { PropertyDetailMediaGlance } from "@case-study/mfe/components/po-intake/PropertyDetailMediaGlance";
import { prefetchInspectorWorkspacePhotos } from "@case-study/mfe/lib/prototype/inspector-photo-upload";
import {
  collectFieldInspectionDocumentsFromSubmission,
  pickPrimaryPropertyDetailPhoto,
  type PropertyDetailDocumentEntry,
} from "@case-study/mfe/lib/prototype/property-detail-documents";
import { cn, Spinner } from "@platform/ui-kit";
import { invalidControlClass } from "@platform/app-shared/form-ux";
import type {
  EvaluatorReportChoices,
  EvaluatorSubmission,
} from "../../lib/evaluator/evaluator-window-data";
import {
  emptyReportChoices,
  seedReportChoicesFromAssignment,
} from "../../lib/evaluator/evaluator-window-data";
import { basisOfValueLabelArForAssignment } from "@platform/app-shared/prototype/assignment-valuation-defaults";
import { EvaluatorLinkedComparablesBlock } from "./EvaluatorLinkedComparablesBlock";
import { EvaluatorComparableSelectionPanel } from "./EvaluatorComparableSelectionPanel";
import { inspectionFactChips } from "./EvaluatorInspectionFactsSection";
import { computePropertyTotal } from "../../lib/evaluator/value-estimation";
import {
  ValCard,
  ValFieldsGrid,
  valChipClassName,
  valInputClassName,
  valLabelClassName,
  valTableTdClassName,
  valTableThClassName,
} from "./EvaluatorHtmlPrimitives";

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

function approachUsed(key: string | null | undefined): boolean {
  return Boolean(key && key !== UNUSED);
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
      className={valInputClassName}
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
      <td className={cn(valTableTdClassName, "align-middle font-semibold text-text-2")}>
        {label}
      </td>
      <td className={valTableTdClassName}>
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
      <td className={valTableTdClassName}>
        <textarea
          className={cn(valInputClassName, "resize-y")}
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
  assignmentType,
  onChange,
  onDraftPatch,
  fieldErrors,
}: {
  draft: EvaluatorSubmission;
  disabled?: boolean;
  property?: PoPropertyIntake | null;
  inspectionTaskId?: string | null;
  assignmentType?: string | null;
  onChange?: (choices: EvaluatorReportChoices, extras?: { valueBasis?: string; valuationMethod?: string }) => void;
  onDraftPatch?: (patch: {
    landValue?: string;
    buildingValue?: string;
    evaluatorPrice?: string;
    forcedSaleDiscountPct?: string;
  }) => void;
  fieldErrors?: Record<string, string>;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [org, setOrg] = useState<OrganizationSettingsDto | null>(null);
  const [lists, setLists] = useState<ValuationListsDto | null>(null);
  const [inspector, setInspector] = useState<InspectorWorkspaceDraft | null>(
    null,
  );
  const [primaryPhoto, setPrimaryPhoto] =
    useState<PropertyDetailDocumentEntry | null>(null);
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
      setPrimaryPhoto(null);
      return;
    }
    let cancelled = false;
    void fetchInspectorWorkspace(inspectionTaskId).then(async (ws) => {
      if (cancelled) return;
      setInspector(ws);
      if (!ws) {
        setPrimaryPhoto(null);
        return;
      }
      await prefetchInspectorWorkspacePhotos(ws);
      if (cancelled) return;
      const photos = collectFieldInspectionDocumentsFromSubmission(ws).filter(
        (doc) => doc.kind === "image",
      );
      setPrimaryPhoto(pickPrimaryPropertyDetailPhoto(photos));
    });
    return () => {
      cancelled = true;
    };
  }, [inspectionTaskId]);

  const vr = useMemo(
    () => ({ ...REPORT_DEFAULTS, ...(org?.valuationReport ?? {}) }),
    [org],
  );
  const bases = enabledList(lists?.lists, "valueBases");
  const methods = enabledList(lists?.lists, "methods");
  const attachments = enabledList(lists?.lists, "attachments");
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

  const patchValues = useCallback(
    (partial: {
      landValue?: string;
      buildingValue?: string;
      evaluatorPrice?: string;
      forcedSaleDiscountPct?: string;
    }) => {
      const land = partial.landValue ?? draft.landValue;
      const building = partial.buildingValue ?? draft.buildingValue;
      const summed = computePropertyTotal(land, building);
      const next = {
        ...partial,
        ...(partial.evaluatorPrice === undefined &&
        (partial.landValue !== undefined || partial.buildingValue !== undefined) &&
        summed > 0
          ? { evaluatorPrice: String(summed) }
          : {}),
      };
      onDraftPatch?.(next);
    },
    [draft.buildingValue, draft.landValue, onDraftPatch],
  );

  useEffect(() => {
    if (!record) return;
    const sub = subClientIdFromReportUsers(record.reportUserClientIds);
    const seeded = seedReportChoicesFromAssignment(
      record.assignmentType,
      sub,
      choices,
    );
    const expectedBasis = basisOfValueLabelArForAssignment(
      record.assignmentType,
      sub,
    );
    if (
      seeded.purposeKey === choices.purposeKey &&
      seeded.valueBasisKey === choices.valueBasisKey &&
      seeded.premiseKey === choices.premiseKey &&
      (draft.valueBasis || "") === expectedBasis
    ) {
      return;
    }
    patch(seeded, {
      valueBasis: expectedBasis,
    });
  }, [choices, draft.valueBasis, patch, record]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-text-3">
        <Spinner />
        <span className="text-[13px]">جاري تحميل تقرير التقييم…</span>
      </div>
    );
  }

  const methodOpts = (approach: string) => [
    { value: UNUSED, label: "غير مستخدم" },
    ...methodsForApproach(methods, approach).map((m) => ({
      value: m.key,
      label: m.name,
    })),
  ];
  const noteClassName = "mb-2 text-[11px] leading-relaxed text-text-3";
  const inspectionChips = inspectionFactChips(inspector);
  const marketOn = approachUsed(choices.marketMethodKey);
  const costOn = approachUsed(choices.costMethodKey);
  const incomeOn = approachUsed(choices.incomeMethodKey);
  const showWorkPanel = marketOn || costOn;
  const liquidation = choices.valueBasisKey === "liquidation";
  const err = (key: string) => fieldErrors?.[key];

  return (
    <div dir="rtl">
      {error ? (
        <p className="mb-3 text-[12px] font-semibold text-danger-text">{error}</p>
      ) : null}

      <div className="mb-4">
        <PropertyDetailMediaGlance
          property={property}
          primaryPhoto={primaryPhoto}
          inspectorDescription={inspector?.propertyDescription}
          latitude={inspector?.mapLatitude}
          longitude={inspector?.mapLongitude}
          showCoordinates={false}
        />
        {inspectionChips.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {inspectionChips.map((chip) => (
              <span key={chip} className={valChipClassName}>
                {chip}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <ValCard title="أسلوب وطريقة التقييم المستخدمة">
        <p className={noteClassName}>
          اختيار المقيم. حقائق المعاينة والحصر وأمر العمل أعلاه معلومات — لا تُعاد كتابتها.
        </p>
        <ValFieldsGrid min={180}>
          <div className="min-w-0">
            <div className={valLabelClassName}>أسلوب السوق</div>
            <Pick
              disabled={disabled}
              value={choices.marketMethodKey}
              onChange={(marketMethodKey) => patch({ marketMethodKey })}
              options={methodOpts("أسلوب السوق")}
            />
          </div>
          <div className="min-w-0">
            <div className={valLabelClassName}>أسلوب التكلفة</div>
            <Pick
              disabled={disabled}
              value={choices.costMethodKey}
              onChange={(costMethodKey) => patch({ costMethodKey })}
              options={methodOpts("أسلوب التكلفة")}
            />
          </div>
          <div className="min-w-0">
            <div className={valLabelClassName}>أسلوب الدخل</div>
            <Pick
              disabled={disabled}
              value={choices.incomeMethodKey}
              onChange={(incomeMethodKey) => patch({ incomeMethodKey })}
              options={methodOpts("أسلوب الدخل")}
            />
          </div>
        </ValFieldsGrid>
      </ValCard>

      <ValCard title="العقارات المقارنة">
        <p className={noteClassName}>
          ربط الأخصائي — للعلم. الاعتماد والتسويات وأسعار التكلفة في اللوحة أدناه عند استخدام
          أسلوب السوق أو التكلفة.
        </p>
        <EvaluatorLinkedComparablesBlock propertyId={property?.id} />
      </ValCard>

      {showWorkPanel && property?.id ? (
        <ValCard title="اعتماد المقارنات وأسلوب التكلفة">
          <p className={noteClassName}>
            عمل المقيم: اعتماد المقارن، التسويات، بنود التكلفة والإهلاك. الخريطة وجدول
            التسويات يُولَّدان هنا وعند طباعة التقرير.
          </p>
          <EvaluatorComparableSelectionPanel
            propertyId={property.id}
            poNumber={draft.poNumber}
            assignmentType={assignmentType ?? undefined}
            districtHint={property.district}
          />
        </ValCard>
      ) : null}

      {incomeOn ? (
        <ValCard title="أسلوب الدخل">
          <p className={noteClassName}>يظهر فقط عند اختيار أسلوب الدخل.</p>
          <ValFieldsGrid min={160}>
            <div className="min-w-0">
              <div className={valLabelClassName}>دخل سنوي (ر.س.)</div>
              <input
                className={valInputClassName}
                disabled={disabled}
                dir="ltr"
                value={choices.incomeAnnual}
                onChange={(e) => patch({ incomeAnnual: e.target.value })}
              />
            </div>
            <div className="min-w-0">
              <div className={valLabelClassName}>نسبة الشغور ٪</div>
              <input
                className={valInputClassName}
                disabled={disabled}
                dir="ltr"
                value={choices.incomeVacancyPct}
                onChange={(e) => patch({ incomeVacancyPct: e.target.value })}
              />
            </div>
            <div className="min-w-0">
              <div className={valLabelClassName}>نسبة التشغيل ٪</div>
              <input
                className={valInputClassName}
                disabled={disabled}
                dir="ltr"
                value={choices.incomeOpexPct}
                onChange={(e) => patch({ incomeOpexPct: e.target.value })}
              />
            </div>
            <div className="min-w-0">
              <div className={valLabelClassName}>معدل الرسملة ٪</div>
              <input
                className={valInputClassName}
                disabled={disabled}
                dir="ltr"
                value={choices.incomeCapRatePct}
                onChange={(e) => patch({ incomeCapRatePct: e.target.value })}
              />
            </div>
          </ValFieldsGrid>
        </ValCard>
      ) : null}

      <ValCard title="ترجيح أساليب التقييم">
        <p className={noteClassName}>المبرر يُطبع في التقرير. الأوزان تُحفظ مع الترجيح في لوحة العمل.</p>
        <textarea
          className={cn(valInputClassName, "min-h-[88px] resize-y")}
          disabled={disabled}
          rows={3}
          placeholder="مبرر استخدام طرق التقييم"
          value={choices.methodsRationale}
          onChange={(e) => patch({ methodsRationale: e.target.value })}
        />
      </ValCard>

      <ValCard title="القيمة النهائية للعقار">
        <p className={noteClassName}>رأي المقيم. المجموع يُحدَّث من الأرض والمباني إن وُجدت.</p>
        <ValFieldsGrid min={160}>
          <div className="min-w-0">
            <label className={valLabelClassName} htmlFor="inf-land">
              قيمة الأرض (ر.س.)
            </label>
            <input
              id="inf-land"
              className={cn(valInputClassName, err("land_value") && invalidControlClass)}
              disabled={disabled}
              dir="ltr"
              value={draft.landValue}
              onChange={(e) => patchValues({ landValue: e.target.value })}
            />
            {err("land_value") ? (
              <p className="mt-1 text-[11px] text-danger-text">{err("land_value")}</p>
            ) : null}
          </div>
          <div className="min-w-0">
            <label className={valLabelClassName} htmlFor="inf-building">
              قيمة المباني (ر.س.)
            </label>
            <input
              id="inf-building"
              className={cn(valInputClassName, err("building_value") && invalidControlClass)}
              disabled={disabled}
              dir="ltr"
              value={draft.buildingValue}
              onChange={(e) => patchValues({ buildingValue: e.target.value })}
            />
            {err("building_value") ? (
              <p className="mt-1 text-[11px] text-danger-text">{err("building_value")}</p>
            ) : null}
          </div>
          <div className="min-w-0">
            <label className={valLabelClassName} htmlFor="inf-total">
              رأي القيمة (ر.س.)
            </label>
            <input
              id="inf-total"
              className={cn(valInputClassName, err("evaluator_price") && invalidControlClass)}
              disabled={disabled}
              dir="ltr"
              value={draft.evaluatorPrice}
              onChange={(e) => patchValues({ evaluatorPrice: e.target.value })}
            />
            {err("evaluator_price") ? (
              <p className="mt-1 text-[11px] text-danger-text">{err("evaluator_price")}</p>
            ) : null}
          </div>
          {liquidation ? (
            <div className="min-w-0">
              <label className={valLabelClassName} htmlFor="inf-discount">
                خصم التصفية ٪
              </label>
              <input
                id="inf-discount"
                className={cn(
                  valInputClassName,
                  err("forced_sale_discount") && invalidControlClass,
                )}
                disabled={disabled}
                dir="ltr"
                value={draft.forcedSaleDiscountPct}
                onChange={(e) =>
                  patchValues({ forcedSaleDiscountPct: e.target.value })
                }
              />
              {err("forced_sale_discount") ? (
                <p className="mt-1 text-[11px] text-danger-text">
                  {err("forced_sale_discount")}
                </p>
              ) : null}
            </div>
          ) : null}
        </ValFieldsGrid>
      </ValCard>

      <ValCard title="الافتراضات الخاصة">
        <p className={noteClassName}>أزل العبارة التي لا تصح على هذا العقار. يُطبع المُبقى فقط.</p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {specials.map((item, i) => (
            <li key={i}>
              <label className="flex items-start gap-2 text-[12.5px] text-text">
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
      </ValCard>

      <ValCard title="العوامل البيئية والاجتماعية والحوكمة (ESG)">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr>
                <th className={cn(valTableThClassName, "w-[16%] text-start")}>المجموعة</th>
                <th className={cn(valTableThClassName, "w-[34%] text-start")}>العوامل</th>
                <th className={cn(valTableThClassName, "text-start")}>وصف الأثر</th>
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
        </div>
      </ValCard>

      <ValCard title="التقرير المساحي">
        <p className={noteClassName}>اختر المرفق ليُطبع — من قائمة مرفقات التقرير.</p>
        <div className="flex flex-col gap-2">
          {attachments.map((row) => (
            <label key={row.id} className="flex items-center gap-2 text-[12px] text-text">
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
        </div>
      </ValCard>
    </div>
  );
}
