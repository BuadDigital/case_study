"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ensureOpenValuationRequestByProperty,
  getValuationApproachSettings,
  isNoExternalSpecialistAssumption,
  saveValuationApproachSettings,
  type ValuationApproachSettingsDto,
} from "@platform/api-client";
import {
  Spinner,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
  cn,
  opsBtnPrimary,
  opsFldControl,
  opsTfLbl,
  useToast,
} from "@platform/ui-kit";

import { invalidControlClass } from "@platform/app-shared/form-ux";
import { useWindowEvents } from "@platform/app-shared/hooks/useWindowEvents";
import { usePoRecordQuery, useWorkflowTasksQuery } from "@case-study/mfe/query/case-study-queries";
import { usePropertyDetailDocuments } from "@case-study/mfe/query/property-detail-documents-query";
import { subClientIdFromReportUsers } from "@case-study/mfe/lib/prototype/po-intake-data";
import type { PoPropertyIntake } from "@case-study/mfe/lib/prototype/po-intake-data";
import {
  ESG_ENV_FACTORS,
  ESG_GOV_FACTORS,
  ESG_NONE_NOTES,
  ESG_SOC_FACTORS,
  VALUATION_SPECIALIST_ESG_CHANGED_EVENT,
  loadSpecialistEsgInputs,
  type SpecialistEsgGroup,
  type SpecialistEsgInputs,
} from "@case-study/mfe/lib/prototype/valuation-report-specialist-esg";
import {
  VALUATION_PRINT_KEYS_CHANGED_EVENT,
  loadSpecialistPrintAttachmentKeys,
} from "@case-study/mfe/lib/prototype/valuation-print-attachment-keys";
import {
  basisOfValueKeyForAssignment,
} from "@platform/app-shared/prototype/assignment-valuation-defaults";
import type {
  EvaluatorReportChoices,
  EvaluatorSubmission,
} from "../../lib/evaluator/evaluator-window-data";
import { emptyReportChoices } from "../../lib/evaluator/evaluator-window-data";
import {
  buildValuationPrintAttachmentRows,
} from "../../lib/evaluator/valuation-report-property-attachments";
import { apiConfig } from "./valuation-work/lib/shell-utils";
import { ValCard, ValFieldsGrid } from "./EvaluatorHtmlPrimitives";

import { useValuationListsQuery } from "@platform/app-shared/query/valuation-lists-query";

function esgGroupsEqual(a: SpecialistEsgGroup, b: SpecialistEsgGroup): boolean {
  return (
    a.none === b.none &&
    a.notes === b.notes &&
    a.selected.length === b.selected.length &&
    a.selected.every((x, i) => x === b.selected[i])
  );
}

function EsgReadonlyRow({
  label,
  factors,
  group,
  noneNotes,
}: {
  label: string;
  factors: readonly string[];
  group: SpecialistEsgGroup;
  noneNotes: string;
}) {
  const hasImpact = !group.none;
  const displayNotes = group.none
    ? group.notes.trim() || noneNotes
    : group.notes.trim() || "—";

  return (
    <Tr hoverable={false}>
      <Td className="align-middle font-semibold text-text-2">
        <div>{label}</div>
        <div className="mt-1 text-[10.5px] font-normal leading-relaxed text-text-3">
          عوامل للاعتبار: {factors.join(" · ")}
        </div>
      </Td>
      <Td className="align-middle text-center">
        <span
          className={cn(
            "inline-block rounded-md px-2 py-1 text-[11px] font-bold",
            hasImpact
              ? "bg-[color-mix(in_srgb,var(--gold)_22%,transparent)] text-gold-d"
              : "bg-surface-2 text-text-3",
          )}
        >
          {hasImpact ? "يوجد تأثير" : "لا يوجد"}
        </span>
      </Td>
      <Td className="align-middle text-[12.5px] leading-relaxed text-text">
        {displayNotes}
      </Td>
    </Tr>
  );
}

const noteClassName = "mb-2 text-[11px] leading-relaxed text-text-3";

/** Final review: delivery opinion, special assumptions, ESG (read-only). */
export function EvaluatorFinalReviewTab({
  draft,
  disabled = false,
  property,
  assignmentType,
  valuationRequestId: knownValuationRequestId,
  approachSettings: approachSettingsFromShell,
  onDraftPatch,
  onReportChoicesPatch,
  fieldErrors,
}: {
  draft: EvaluatorSubmission;
  disabled?: boolean;
  property?: PoPropertyIntake | null;
  assignmentType?: string | null;
  /** From ValuationWorkShell when present — avoids a second ensure-open for the same property. */
  valuationRequestId?: string | null;
  /**
   * Valuation settings from the shell when present (null = shell load failed) — skips
   * a duplicate tab fetch for the same settings; undefined = standalone mode fetches itself.
   */
  approachSettings?: ValuationApproachSettingsDto | null;
  onDraftPatch?: (patch: {
    evaluatorPrice?: string;
    forcedSaleDiscountPct?: string;
  }) => void;
  onReportChoicesPatch?: (patch: Partial<EvaluatorReportChoices>) => void;
  fieldErrors?: Record<string, string>;
}) {
  const { showToast } = useToast();
  const { data: record } = usePoRecordQuery(draft.poNumber);
  const choices = draft.reportChoices ?? emptyReportChoices();

  const [specialistEsg, setSpecialistEsg] = useState<SpecialistEsgInputs>(() =>
    loadSpecialistEsgInputs(property?.id ?? draft.propertyId),
  );
  const [specialistKeys, setSpecialistKeys] = useState<string[]>(() =>
    loadSpecialistPrintAttachmentKeys(property?.id ?? draft.propertyId),
  );
  // Valuation lists from the shared query — previously a duplicate GET with final-opinion.
  const { data: valuationLists } = useValuationListsQuery();
  const attachmentCatalog = useMemo<
    { key: string; name: string; isRequired: boolean }[]
  >(
    () =>
      (valuationLists?.lists?.attachments ?? [])
        .filter((r) => r.isEnabled)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((r) => ({
          key: r.key,
          name: r.name,
          isRequired: r.isRequired,
        })),
    [valuationLists],
  );
  const [settings, setSettings] = useState<ValuationApproachSettingsDto | null>(
    null,
  );
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [freeAssumption, setFreeAssumption] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assignmentTypeResolved =
    assignmentType ?? record?.assignmentType ?? null;
  const assignmentSubClientId = subClientIdFromReportUsers(
    record?.reportUserClientIds,
  );
  const liquidation = assignmentTypeResolved
    ? basisOfValueKeyForAssignment(
        assignmentTypeResolved,
        assignmentSubClientId,
      ) === "liquidation"
    : choices.valueBasisKey === "liquidation";

  const propertyId = property?.id ?? draft.propertyId;

  // Report attachment sources need upload/inspection task ids — without them docs are not fetched.
  const { data: workflowTasks } = useWorkflowTasksQuery();
  // Single pass over tasks instead of two finds per render (js-combine-iterations).
  const { surveyTaskId, inspectionTaskId } = useMemo(() => {
    let surveyId: string | null = null;
    let inspectionId: string | null = null;
    for (const t of workflowTasks ?? []) {
      if (t.propertyId !== propertyId) continue;
      if (t.kind === "engineering-survey" && surveyId === null) surveyId = t.id;
      else if (t.kind === "field-inspection" && inspectionId === null)
        inspectionId = t.id;
    }
    return { surveyTaskId: surveyId, inspectionTaskId: inspectionId };
  }, [workflowTasks, propertyId]);
  const documentSections = usePropertyDetailDocuments({
    property: property!,
    showDecree: true,
    poNumber: draft.poNumber,
    surveyTaskId,
    appraisalTaskId: draft.taskId || null,
    inspectionTaskId,
    enabled: Boolean(property?.id),
  });
  const propertyDocuments = useMemo(
    () => documentSections.flatMap((s) => s.documents),
    [documentSections],
  );
  const printRows = useMemo(
    () =>
      buildValuationPrintAttachmentRows({
        catalog: attachmentCatalog,
        documents: propertyDocuments,
        specialistKeys,
        propertyId,
      }),
    [attachmentCatalog, propertyDocuments, propertyId, specialistKeys],
  );
  // Single filter pass per render + Set instead of includes (js-combine-iterations).
  const selectedPrintRows = useMemo(() => {
    const keys = new Set(specialistKeys);
    return printRows.filter((row) => keys.has(row.key));
  }, [printRows, specialistKeys]);

  useEffect(() => {
    setSpecialistEsg(loadSpecialistEsgInputs(propertyId));
    setSpecialistKeys(loadSpecialistPrintAttachmentKeys(propertyId));
  }, [propertyId]);
  // Refresh synced specialist inputs via window events — ignore other properties.
  const ifThisProperty = (refresh: () => void) => (ev: Event) => {
    const detail = (ev as CustomEvent<{ propertyId?: string }>).detail;
    if (detail?.propertyId && detail.propertyId !== propertyId) return;
    refresh();
  };
  useWindowEvents({
    [VALUATION_SPECIALIST_ESG_CHANGED_EVENT]: ifThisProperty(() =>
      setSpecialistEsg(loadSpecialistEsgInputs(propertyId)),
    ),
    [VALUATION_PRINT_KEYS_CHANGED_EVENT]: ifThisProperty(() =>
      setSpecialistKeys(loadSpecialistPrintAttachmentKeys(propertyId)),
    ),
  });

  // Pour specialist ESG and attachments into the report draft for print.
  useEffect(() => {
    if (disabled || loading) return;
    const current = draft.reportChoices ?? emptyReportChoices();
    const esgSame =
      esgGroupsEqual(current.esgEnv, specialistEsg.esgEnv) &&
      esgGroupsEqual(current.esgSoc, specialistEsg.esgSoc) &&
      esgGroupsEqual(current.esgGov, specialistEsg.esgGov);
    const keysSame =
      current.printAttachmentKeys.length === specialistKeys.length &&
      specialistKeys.every((k) => current.printAttachmentKeys.includes(k));
    if (esgSame && keysSame) return;
    onReportChoicesPatch?.({
      esgEnv: specialistEsg.esgEnv,
      esgSoc: specialistEsg.esgSoc,
      esgGov: specialistEsg.esgGov,
      printAttachmentKeys: specialistKeys,
    });
  }, [
    disabled,
    draft.reportChoices,
    loading,
    onReportChoicesPatch,
    specialistEsg,
    specialistKeys,
  ]);

  /** Seed assumptions list from settings — shared by standalone and shell modes. */
  const seedAssumptions = useCallback((s: ValuationApproachSettingsDto) => {
    const library = s.assumptionLibrary ?? [];
    const loaded = s.selectedAssumptions ?? [];
    const visible = library.filter(
      (clause) =>
        !s.externalSpecialistUsed || !isNoExternalSpecialistAssumption(clause),
    );
    const useAll = loaded.length === 0;
    setAssumptions(
      useAll
        ? visible
        : s.externalSpecialistUsed
          ? loaded.filter((x) => !isNoExternalSpecialistAssumption(x))
          : loaded,
    );
  }, []);

  // Shell mode: settings come from parent — no duplicate fetch; seed once per request so
  // user edits are not overwritten when the shell reloads settings.
  const seededForRequestRef = useRef<string | null>(null);
  useEffect(() => {
    if (approachSettingsFromShell === undefined) return;
    setLoading(false);
    if (!approachSettingsFromShell) {
      setSettings(null);
      setError("تعذّر تحميل إعدادات التقييم");
      return;
    }
    setError(null);
    setSettings(approachSettingsFromShell);
    const seedKey = knownValuationRequestId ?? propertyId;
    if (seededForRequestRef.current === seedKey) return;
    seededForRequestRef.current = seedKey;
    seedAssumptions(approachSettingsFromShell);
  }, [
    approachSettingsFromShell,
    knownValuationRequestId,
    propertyId,
    seedAssumptions,
  ]);

  const loadAssumptions = useCallback(async () => {
    // Shell mode — the effect above is the source; no fetch here.
    if (approachSettingsFromShell !== undefined) return;
    const config = apiConfig();
    if (!config || !propertyId.trim()) {
      setLoading(false);
      setError(!config ? "يلزم تسجيل الدخول" : "لا يوجد معرّف عقار");
      return;
    }
    setLoading(true);
    setError(null);
    // Shell already has the id — skip redundant ensure-open / create-if-missing writes.
    let requestId = knownValuationRequestId ?? null;
    if (!requestId) {
      const open = await ensureOpenValuationRequestByProperty(config, {
        propId: propertyId.trim(),
        area: property?.district?.trim() || "—",
        type: property?.propertyType?.trim() || "—",
        appraiser: "—",
      });
      if (!open.ok) {
        setLoading(false);
        setSettings(null);
        setError("تعذّر فتح طلب التقييم");
        return;
      }
      requestId = open.data.id;
    }
    const res = await getValuationApproachSettings(config, requestId);
    setLoading(false);
    if (!res.ok) {
      setSettings(null);
      setError("تعذّر تحميل إعدادات التقييم");
      return;
    }
    setSettings(res.data);
    seedAssumptions(res.data);
  }, [
    approachSettingsFromShell,
    knownValuationRequestId,
    property?.district,
    property?.propertyType,
    propertyId,
    seedAssumptions,
  ]);

  useEffect(() => {
    void loadAssumptions();
  }, [loadAssumptions]);

  const visibleLibrary = useMemo(() => {
    const library = settings?.assumptionLibrary ?? [];
    const specialistUsed = settings?.externalSpecialistUsed ?? false;
    const extras = assumptions.filter((a) => !library.includes(a));
    const base = library.filter(
      (clause) =>
        !specialistUsed || !isNoExternalSpecialistAssumption(clause),
    );
    return [...base, ...extras];
  }, [assumptions, settings?.assumptionLibrary, settings?.externalSpecialistUsed]);

  async function saveAssumptions() {
    const config = apiConfig();
    if (!config || !settings || disabled) return;
    setSaving(true);
    const selected = settings.externalSpecialistUsed
      ? assumptions.filter((x) => !isNoExternalSpecialistAssumption(x))
      : assumptions;
    const res = await saveValuationApproachSettings(
      config,
      settings.valuationRequestId,
      {
        marketApproachEnabled: settings.marketApproachEnabled,
        costApproachEnabled: settings.costApproachEnabled,
        incomeApproachEnabled: false,
        costBasisKey: settings.costBasisKey,
        costScopeKey: settings.costScopeKey,
        costMeasurementUnitKey: settings.costMeasurementUnitKey,
        adjustmentsEditUnlocked: settings.adjustmentsEditUnlocked,
        valuationPurposeKey: settings.valuationPurposeKey,
        valuationPurposeNote: settings.valuationPurposeNote ?? null,
        externalSpecialistUsed: settings.externalSpecialistUsed,
        externalSpecialistDetails: settings.externalSpecialistDetails ?? null,
        valuationDateMode: settings.valuationDateMode,
        retrospectiveDate: settings.retrospectiveDate ?? null,
        retrospectiveDateEnd: settings.retrospectiveDateEnd ?? null,
        retrospectiveRationale: null,
        selectedAssumptions: selected,
      },
    );
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ الافتراضات الخاصة", "error");
      return;
    }
    setSettings(res.data);
    showToast("تم حفظ الافتراضات الخاصة", "success");
  }

  const err = (key: string) => fieldErrors?.[key];

  if (loading) {
    return (
      <div className="flex justify-center py-10" dir="rtl">
        <Spinner />
      </div>
    );
  }

  return (
    <div dir="rtl">
      {error ? (
        <p className="mb-3 text-[12px] font-semibold text-danger-text">{error}</p>
      ) : null}

      <ValCard title="رأي القيمة عند التسليم">
        <p className={noteClassName}>
          يُملأ تلقائياً من شاشة «رأي القيمة النهائي» في تقييم العقار. عدّله هنا فقط
          إن لزم قبل الإرسال.
        </p>
        <ValFieldsGrid min={160}>
          <div className="min-w-0">
            <label className={opsTfLbl} htmlFor="final-inf-total">
              رأي القيمة (ر.س.)
            </label>
            <input
              id="final-inf-total"
              className={cn(
                opsFldControl,
                err("evaluator_price") && invalidControlClass,
              )}
              disabled={disabled}
              dir="ltr"
              value={draft.evaluatorPrice}
              onChange={(e) =>
                onDraftPatch?.({ evaluatorPrice: e.target.value })
              }
            />
            {err("evaluator_price") ? (
              <p className="mt-1 text-[11px] text-danger-text">
                {err("evaluator_price")}
              </p>
            ) : null}
          </div>
          {liquidation ? (
            <div className="min-w-0">
              <label className={opsTfLbl} htmlFor="final-inf-discount">
                خصم التصفية ٪
              </label>
              <input
                id="final-inf-discount"
                className={cn(
                  opsFldControl,
                  err("forced_sale_discount") && invalidControlClass,
                )}
                disabled={disabled}
                dir="ltr"
                value={draft.forcedSaleDiscountPct}
                onChange={(e) =>
                  onDraftPatch?.({ forcedSaleDiscountPct: e.target.value })
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
        <p className={noteClassName}>
          أزل العبارة التي لا تصح على هذا العقار، أو أضف بنداً إضافياً. يُحفظ مع
          إعدادات التقييم ويُطبع المُبقى فقط.
        </p>
        {visibleLibrary.length > 0 ? (
          <div className="mb-3 overflow-hidden rounded-[var(--radius)] border border-border">
            {visibleLibrary.map((clause) => (
              <label
                key={clause}
                className="flex cursor-pointer items-start gap-2.5 border-b border-border bg-surface px-3 py-2.5 text-[12.5px] leading-relaxed text-text transition-colors last:border-b-0 hover:bg-row-hover"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--ink)]"
                  disabled={disabled || saving}
                  checked={assumptions.includes(clause)}
                  onChange={(e) =>
                    setAssumptions((prev) =>
                      e.target.checked
                        ? [...prev, clause]
                        : prev.filter((x) => x !== clause),
                    )
                  }
                />
                <span>{clause}</span>
              </label>
            ))}
          </div>
        ) : (
          <p className="mb-3 text-[12px] text-text-3">
            لا توجد بنود افتراضات في إعدادات التقرير بعد.
          </p>
        )}
        <div className="mb-3 flex gap-2">
          <input
            placeholder="بند افتراض إضافي"
            value={freeAssumption}
            disabled={disabled || saving}
            onChange={(e) => setFreeAssumption(e.target.value)}
            className={cn(opsFldControl, "flex-1 font-medium")}
          />
          <button
            type="button"
            className={cn(opsBtnPrimary, "shrink-0 !px-3 !py-2 text-[12px]")}
            disabled={disabled || saving || !freeAssumption.trim()}
            onClick={() => {
              const t = freeAssumption.trim();
              if (
                t &&
                !assumptions.includes(t) &&
                !(
                  settings?.externalSpecialistUsed &&
                  isNoExternalSpecialistAssumption(t)
                )
              ) {
                setAssumptions((prev) => [...prev, t]);
              }
              setFreeAssumption("");
            }}
          >
            إضافة
          </button>
        </div>
        <button
          type="button"
          className={opsBtnPrimary}
          disabled={disabled || saving || !settings}
          onClick={() => void saveAssumptions()}
        >
          {saving ? <Spinner /> : null}
          <span>{saving ? "جاري الحفظ…" : "حفظ الافتراضات الخاصة"}</span>
        </button>
      </ValCard>

      <ValCard title="العوامل البيئية والاجتماعية والحوكمة (ESG)">
        <p className={noteClassName}>
          يعبّئها الأخصائي من دراسة الحالة — تظهر هنا للعرض فقط.
        </p>
        <Table className="min-w-[560px]">
          <THead>
            <Tr hoverable={false}>
              <Th className="w-[28%]">المجموعة</Th>
              <Th className="w-[14%] text-center">يوجد تأثير</Th>
              <Th>وصف الأثر</Th>
            </Tr>
          </THead>
          <TBody>
            <EsgReadonlyRow
              label="التأثيرات البيئية"
              factors={ESG_ENV_FACTORS}
              group={specialistEsg.esgEnv}
              noneNotes={ESG_NONE_NOTES.env}
            />
            <EsgReadonlyRow
              label="التأثيرات الاجتماعية"
              factors={ESG_SOC_FACTORS}
              group={specialistEsg.esgSoc}
              noneNotes={ESG_NONE_NOTES.soc}
            />
            <EsgReadonlyRow
              label="تأثيرات الحوكمة"
              factors={ESG_GOV_FACTORS}
              group={specialistEsg.esgGov}
              noneNotes={ESG_NONE_NOTES.gov}
            />
          </TBody>
        </Table>
      </ValCard>

      <ValCard title="مرفقات التقرير">
        <p className={noteClassName}>
          يحدّدها الأخصائي من مستندات العقار — تظهر هنا للعرض فقط.
        </p>
        <div className="flex flex-col gap-2">
          {selectedPrintRows
            .map((row) => {
              const docHint = row.docs[0];
              return (
                <div
                  key={row.key}
                  className="flex items-start gap-2.5 rounded-[var(--radius)] border border-border bg-surface-2 px-3 py-2.5 text-[12.5px] text-text"
                >
                  <span
                    className="mt-0.5 size-2 shrink-0 rounded-full bg-gold"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-heading">{row.name}</span>
                    <span className="mt-0.5 block text-[10.5px] leading-relaxed text-text-3">
                      {row.available && docHint
                        ? `في مستندات العقار: ${docHint.name} · ${docHint.source}`
                        : "غير متوفر بعد في مستندات العقار"}
                    </span>
                  </span>
                </div>
              );
            })}
          {specialistKeys.length === 0 ? (
            <p className="m-0 text-[12px] text-text-3">
              لم يحدد الأخصائي مرفقات للتقرير بعد.
            </p>
          ) : null}
          {specialistKeys.length > 0 && selectedPrintRows.length === 0 ? (
            <p className="m-0 text-[12px] text-text-3">
              المفاتيح المحددة غير موجودة في قوائم المرفقات الحالية.
            </p>
          ) : null}
        </div>
      </ValCard>
    </div>
  );
}
