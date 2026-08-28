"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getApiBase,
  getValuationLists,
  listClients,
  VALUATION_REPORT_HTML_DEFAULTS as REPORT_DEFAULTS,
  type ClientDto,
  type OrganizationSettingsDto,
  type ValuationListItemDto,
  type ValuationListsDto,
} from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";
import { ensureOrganizationSettingsLoaded } from "@platform/app-shared/organization/organization-settings-cache";
import { useWindowEvents } from "@platform/app-shared/hooks/useWindowEvents";
import { fetchInspectorWorkspace } from "@case-study/mfe/lib/prototype/inspector-workspace-storage";
import type { InspectorWorkspaceDraft } from "@case-study/mfe/lib/prototype/inspector-workspace-data";
import type { PoPropertyIntake } from "@case-study/mfe/lib/prototype/po-intake-data";
import { subClientIdFromReportUsers } from "@case-study/mfe/lib/prototype/po-intake-data";
import { usePoRecordQuery } from "@case-study/mfe/query/case-study-queries";
import { PropertyDetailMediaGlance } from "@case-study/mfe/components/po-intake/PropertyDetailMediaGlance";
import {
  VALUATION_PRINT_KEYS_CHANGED_EVENT,
  loadSpecialistPrintAttachmentKeys,
} from "@case-study/mfe/lib/prototype/valuation-print-attachment-keys";
import {
  VALUATION_SPECIALIST_ESG_CHANGED_EVENT,
  loadSpecialistEsgInputs,
  type SpecialistEsgGroup,
  type SpecialistEsgInputs,
} from "@case-study/mfe/lib/prototype/valuation-report-specialist-esg";
import {
  VALUATION_SPECIALIST_SEARCH_SCOPE_CHANGED_EVENT,
  loadSpecialistSearchScopeNotes,
} from "@case-study/mfe/lib/prototype/valuation-report-specialist-search-scope";
import {
  VALUATION_SPECIALIST_FINISHING_CHANGED_EVENT,
  loadSpecialistFinishingLevel,
  type SpecialistFinishingLevel,
} from "@case-study/mfe/lib/prototype/valuation-report-specialist-finishing";
import { prefetchInspectorWorkspacePhotos } from "@case-study/mfe/lib/prototype/inspector-photo-upload";
import {
  collectFieldInspectionDocumentsFromSubmission,
  pickPrimaryPropertyDetailPhoto,
  type PropertyDetailDocumentEntry,
} from "@case-study/mfe/lib/prototype/property-detail-documents";
import { cn, Spinner } from "@platform/ui-kit";
import type {
  EvaluatorReportChoices,
  EvaluatorSubmission,
} from "../../lib/evaluator/evaluator-window-data";
import {
  emptyReportChoices,
  seedReportChoicesFromAssignment,
} from "../../lib/evaluator/evaluator-window-data";
import {
  basisOfValueLabelArForAssignment,
  valuationPurposeLabelArForAssignment,
  valuePremiseLabelArForAssignment,
} from "@platform/app-shared/prototype/assignment-valuation-defaults";
import { formatValuationReportUsers } from "../../lib/evaluator/valuation-report-users";
import dynamic from "next/dynamic";
import { inspectionFactChips } from "./EvaluatorInspectionFactsSection";
import { computePropertyTotal } from "../../lib/evaluator/value-estimation";
import {
  ValCard,
  ValFieldsGrid,
  valChipClassName,
  valInputClassName,
  valLabelClassName,
} from "./EvaluatorHtmlPrimitives";
import { apiConfig } from "@platform/app-shared/auth/api-config";

const UNUSED = "__unused__";

const EvaluatorComparableSelectionPanel = dynamic(
  () =>
    import("./EvaluatorComparableSelectionPanel").then(
      (m) => m.EvaluatorComparableSelectionPanel,
    ),
  { ssr: false },
);

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

function esgGroupsEqual(a: SpecialistEsgGroup, b: SpecialistEsgGroup): boolean {
  return (
    a.none === b.none &&
    a.notes === b.notes &&
    a.selected.length === b.selected.length &&
    a.selected.every((x, i) => x === b.selected[i])
  );
}

/** حِزمة بيانات تبويب تقييم العقار — استعلام واحد قابل للتخزين المؤقت. */
async function loadReportTabBundle(inspectionTaskId: string | null) {
  const config = apiConfig();
  if (!config) {
    return {
      authError: true as const,
      org: null,
      lists: null,
      listsFailed: false,
      clients: [] as ClientDto[],
      inspector: null,
      primaryPhoto: null,
    };
  }
  const [loadedOrg, listRes, clientsRes, ws] = await Promise.all([
    ensureOrganizationSettingsLoaded(),
    getValuationLists(config),
    listClients(config),
    inspectionTaskId
      ? fetchInspectorWorkspace(inspectionTaskId)
      : Promise.resolve(null),
  ]);
  let primaryPhoto: ReturnType<typeof pickPrimaryPropertyDetailPhoto> = null;
  if (ws) {
    await prefetchInspectorWorkspacePhotos(ws);
    const photos = collectFieldInspectionDocumentsFromSubmission(ws).filter(
      (doc) => doc.kind === "image",
    );
    primaryPhoto = pickPrimaryPropertyDetailPhoto(photos);
  }
  return {
    authError: false as const,
    org: loadedOrg,
    lists: listRes.ok ? listRes.data : null,
    listsFailed: !listRes.ok,
    clients: clientsRes.ok ? clientsRes.data : ([] as ClientDto[]),
    inspector: ws,
    primaryPhoto,
  };
}


export function EvaluatorValuationReportTab({
  draft,
  disabled = false,
  property,
  inspectionTaskId,
  surveyTaskId,
  appraisalTaskId,
  assignmentType,
  onChange,
  onDraftPatch,
  fieldErrors,
  onSubmit,
  submitting = false,
  showSubmit = false,
}: {
  draft: EvaluatorSubmission;
  disabled?: boolean;
  property?: PoPropertyIntake | null;
  inspectionTaskId?: string | null;
  surveyTaskId?: string | null;
  appraisalTaskId?: string | null;
  assignmentType?: string | null;
  onChange?: (choices: EvaluatorReportChoices, extras?: { valueBasis?: string; valuationMethod?: string }) => void;
  onDraftPatch?: (patch: {
    landValue?: string;
    buildingValue?: string;
    evaluatorPrice?: string;
    forcedSaleDiscountPct?: string;
    searchScopeNotes?: string;
  }) => void;
  fieldErrors?: Record<string, string>;
  onSubmit?: () => void;
  submitting?: boolean;
  showSubmit?: boolean;
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
  const [clients, setClients] = useState<ClientDto[]>([]);
  const [specialistKeys, setSpecialistKeys] = useState<string[]>(() =>
    loadSpecialistPrintAttachmentKeys(property?.id ?? draft.propertyId),
  );
  const [specialistEsg, setSpecialistEsg] = useState<SpecialistEsgInputs>(() =>
    loadSpecialistEsgInputs(property?.id ?? draft.propertyId),
  );
  const [specialistSearchScope, setSpecialistSearchScope] = useState(() =>
    loadSpecialistSearchScopeNotes(property?.id ?? draft.propertyId),
  );
  const [specialistFinishing, setSpecialistFinishing] =
    useState<SpecialistFinishingLevel>(() =>
      loadSpecialistFinishingLevel(property?.id ?? draft.propertyId),
    );
  const { data: record } = usePoRecordQuery(draft.poNumber);

  const choices = draft.reportChoices ?? emptyReportChoices();
  const choicesRef = useRef(choices);
  choicesRef.current = choices;

  const specialistPropertyId = property?.id ?? draft.propertyId;
  useEffect(() => {
    setSpecialistKeys(loadSpecialistPrintAttachmentKeys(specialistPropertyId));
    setSpecialistEsg(loadSpecialistEsgInputs(specialistPropertyId));
    setSpecialistSearchScope(
      loadSpecialistSearchScopeNotes(specialistPropertyId),
    );
    setSpecialistFinishing(loadSpecialistFinishingLevel(specialistPropertyId));
  }, [specialistPropertyId]);
  // تجدد مدخلات الأخصائي المتزامنة عبر أحداث window — عقار آخر لا يعنينا.
  const ifThisProperty = (refresh: () => void) => (ev: Event) => {
    const detail = (ev as CustomEvent<{ propertyId?: string }>).detail;
    if (detail?.propertyId && detail.propertyId !== specialistPropertyId) return;
    refresh();
  };
  useWindowEvents({
    [VALUATION_PRINT_KEYS_CHANGED_EVENT]: ifThisProperty(() =>
      setSpecialistKeys(loadSpecialistPrintAttachmentKeys(specialistPropertyId)),
    ),
    [VALUATION_SPECIALIST_ESG_CHANGED_EVENT]: ifThisProperty(() =>
      setSpecialistEsg(loadSpecialistEsgInputs(specialistPropertyId)),
    ),
    [VALUATION_SPECIALIST_SEARCH_SCOPE_CHANGED_EVENT]: ifThisProperty(() =>
      setSpecialistSearchScope(
        loadSpecialistSearchScopeNotes(specialistPropertyId),
      ),
    ),
    [VALUATION_SPECIALIST_FINISHING_CHANGED_EVENT]: ifThisProperty(() =>
      setSpecialistFinishing(loadSpecialistFinishingLevel(specialistPropertyId)),
    ),
  });

  const tabQuery = useQuery({
    queryKey: ["evaluator-report-tab", inspectionTaskId ?? ""],
    queryFn: () => loadReportTabBundle(inspectionTaskId ?? null),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });
  const tabBundle = tabQuery.data;

  useEffect(() => {
    if (!tabBundle) return;
    if (tabBundle.authError) {
      setError("يلزم تسجيل الدخول");
      setLoading(false);
      return;
    }
    setOrg(tabBundle.org);
    if (tabBundle.lists) setLists(tabBundle.lists);
    else if (tabBundle.listsFailed) setError("تعذّر تحميل قوائم التقييم");
    setClients(tabBundle.clients);
    setInspector(tabBundle.inspector);
    setPrimaryPhoto(tabBundle.primaryPhoto);
    setLoading(false);
  }, [tabBundle]);

  const vr = useMemo(
    () => ({ ...REPORT_DEFAULTS, ...(org?.valuationReport ?? {}) }),
    [org],
  );
  // هويات مستقرة — كانت تُعاد كمصفوفات جديدة كل رسم فتعيد تشغيل مؤثر البذر أدناه.
  const bases = useMemo(() => enabledList(lists?.lists, "valueBases"), [lists]);
  const purposes = useMemo(() => enabledList(lists?.lists, "purposes"), [lists]);
  const premises = useMemo(() => enabledList(lists?.lists, "premises"), [lists]);
  const methods = useMemo(() => enabledList(lists?.lists, "methods"), [lists]);

  const assignmentTypeResolved =
    assignmentType ?? record?.assignmentType ?? null;
  const assignmentSubClientId = record
    ? subClientIdFromReportUsers(record.reportUserClientIds)
    : undefined;
  const valueBasisDisplay =
    draft.valueBasis ||
    bases.find((b) => b.key === choices.valueBasisKey)?.name ||
    basisOfValueLabelArForAssignment(
      assignmentTypeResolved,
      assignmentSubClientId,
    );
  const valuePremiseDisplay =
    premises.find((p) => p.key === choices.premiseKey)?.name ||
    valuePremiseLabelArForAssignment(
      assignmentTypeResolved,
      assignmentSubClientId,
    );
  const valuationPurposeDisplay =
    purposes.find((p) => p.key === choices.purposeKey)?.name ||
    valuationPurposeLabelArForAssignment(
      assignmentTypeResolved,
      assignmentSubClientId,
    );
  const reportUsersDisplay = formatValuationReportUsers(record, clients);

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
  const patchRef = useRef(patch);
  patchRef.current = patch;

  // صب من الأخصائي → مسودة التقرير (للطباعة) — ESG والمرفقات ونطاق البحث والتشطيب.
  useEffect(() => {
    if (disabled || loading) return;
    const current = choicesRef.current;
    const keysSame =
      current.printAttachmentKeys.length === specialistKeys.length &&
      specialistKeys.every((k) => current.printAttachmentKeys.includes(k));
    const esgSame =
      esgGroupsEqual(current.esgEnv, specialistEsg.esgEnv) &&
      esgGroupsEqual(current.esgSoc, specialistEsg.esgSoc) &&
      esgGroupsEqual(current.esgGov, specialistEsg.esgGov);
    const finishingSame = current.finishingLevel === specialistFinishing;
    if (!keysSame || !esgSame || !finishingSame) {
      patchRef.current({
        printAttachmentKeys: specialistKeys,
        esgEnv: specialistEsg.esgEnv,
        esgSoc: specialistEsg.esgSoc,
        esgGov: specialistEsg.esgGov,
        finishingLevel: specialistFinishing,
      });
    }
  }, [disabled, loading, specialistEsg, specialistFinishing, specialistKeys]);

  useEffect(() => {
    if (disabled || loading) return;
    if ((draft.searchScopeNotes ?? "") === specialistSearchScope) return;
    onDraftPatch?.({ searchScopeNotes: specialistSearchScope });
  }, [
    disabled,
    draft.searchScopeNotes,
    loading,
    onDraftPatch,
    specialistSearchScope,
  ]);

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

  const syncFinalOpinion = useCallback(
    (value: number) => {
      if (!onDraftPatch || !Number.isFinite(value) || value <= 0) return;
      onDraftPatch({ evaluatorPrice: String(Math.round(value)) });
    },
    [onDraftPatch],
  );

  useEffect(() => {
    const type = (assignmentType ?? record?.assignmentType ?? "").trim();
    if (!type) return;
    const sub = record
      ? subClientIdFromReportUsers(record.reportUserClientIds)
      : undefined;
    const current = choicesRef.current;
    const seeded = seedReportChoicesFromAssignment(type, sub, current);
    const expectedBasis = basisOfValueLabelArForAssignment(type, sub);
    if (
      seeded.purposeKey === current.purposeKey &&
      seeded.valueBasisKey === current.valueBasisKey &&
      seeded.premiseKey === current.premiseKey &&
      (draft.valueBasis || "") === expectedBasis
    ) {
      return;
    }
    patchRef.current(
      {
        purposeKey: seeded.purposeKey,
        valueBasisKey: seeded.valueBasisKey,
        premiseKey: seeded.premiseKey,
      },
      { valueBasis: expectedBasis },
    );
  }, [
    assignmentType,
    record?.assignmentType,
    record?.reportUserClientIds,
    draft.valueBasis,
  ]);

  // Seed report method keys from lists when empty — approaches are chosen in ValuationWorkShell.
  useEffect(() => {
    if (disabled || !methods.length) return;
    const marketDefault = methodsForApproach(methods, "أسلوب السوق")[0]?.key;
    const costDefault = methodsForApproach(methods, "أسلوب التكلفة")[0]?.key;
    const next: Partial<EvaluatorReportChoices> = {};
    if (!choices.marketMethodKey && marketDefault) {
      next.marketMethodKey = marketDefault;
    }
    if (!choices.costMethodKey && costDefault) {
      next.costMethodKey = costDefault;
    }
    // patchRef بدل patch — هوية patch تتجدد مع كل تعديل خيارات وكانت تعيد تشغيل المؤثر.
    if (Object.keys(next).length) patchRef.current(next);
  }, [
    choices.costMethodKey,
    choices.marketMethodKey,
    disabled,
    methods,
  ]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-text-3">
        <Spinner />
        <span className="text-[13px]">جاري تحميل تقرير التقييم…</span>
      </div>
    );
  }

  const noteClassName = "mb-2 text-[11px] leading-relaxed text-text-3";
  const inspectionChips = inspectionFactChips(inspector);
  const incomeOn = approachUsed(choices.incomeMethodKey);
  const showWorkPanel = Boolean(property?.id);

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
          valueBasisLabel={valueBasisDisplay}
          valuePremiseLabel={valuePremiseDisplay}
          valuationPurposeLabel={valuationPurposeDisplay}
          reportUsersLabel={reportUsersDisplay}
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

      {showWorkPanel && property?.id ? (
        <div className="mb-6">
          <EvaluatorComparableSelectionPanel
            propertyId={property.id}
            poNumber={draft.poNumber}
            assignmentType={assignmentType ?? undefined}
            districtHint={property.district}
            property={{
              area: property.area,
              district: property.district,
              city: property.city,
              deedNumber: property.deedNumber,
              propertyType: property.propertyType,
              classification: property.classification,
            }}
            intakeProperty={property}
            onFinalOpinionChange={syncFinalOpinion}
            draft={draft}
            disabled={disabled}
            fieldErrors={fieldErrors}
            onDraftPatch={onDraftPatch}
            onReportChoicesPatch={(patch) => {
              const current = draft.reportChoices ?? emptyReportChoices();
              onChange?.({ ...current, ...patch });
            }}
            onSubmit={onSubmit}
            submitting={submitting}
            showSubmit={showSubmit}
          />
        </div>
      ) : null}

      {incomeOn ? (
        <>
          <div
            className="mb-4 mt-6 flex items-center gap-2.5"
            aria-label="حقول تقرير التقييم"
          >
            <span className="h-[17px] w-[3px] rounded-full bg-gold" aria-hidden />
            <h3 className="m-0 text-[14px] font-extrabold text-heading">
              حقول التقرير والسرد
            </h3>
            <span className="flex-1 border-t border-border" aria-hidden />
          </div>
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
        </>
      ) : null}
    </div>
  );
}
