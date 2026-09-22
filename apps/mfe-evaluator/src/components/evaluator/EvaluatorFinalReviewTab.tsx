"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ensureOpenValuationRequestByProperty,
  getValuationApproachSettings,
  isNoExternalSpecialistAssumption,
  saveValuationApproachSettings,
  type ValuationApproachSettingsDto,
} from "@platform/api-client";
import {
  Spinner,
  cn,
  opsBtnPrimary,
  opsFldControl,
  useToast,
} from "@platform/ui-kit";

import {
  invalidControlClass,
  scheduleScrollToFormField,
} from "@platform/app-shared/form-ux";
import { useWorkflowTasksQuery } from "../../lib/case-study-bridge";
import { usePropertyDetailDocuments } from "../../lib/case-study-bridge";
import type { PoPropertyIntake } from "@platform/app-shared/app-data/po-intake-data";
import type {
  EvaluatorReportChoices,
  EvaluatorSubmission,
} from "../../lib/evaluator/evaluator-window-data";
import { emptyReportChoices } from "../../lib/evaluator/evaluator-window-data";
import type { EvaluatorSpecialistDraft } from "../../lib/evaluator/evaluator-validation";
import {
  EXTERNAL_SPECIALIST_USED_LABEL,
  assumptionsAfterSpecialistChoice,
  defaultSelectedSpecialAssumptions,
  resolveNoSpecialistClause,
  shouldUseDefaultSpecialAssumptions,
  specialAssumptionRows,
} from "../../lib/evaluator/special-assumption-rows";
import { esgGroupsMissingImpactDescription } from "@platform/app-shared/app-data/valuation-report-specialist-esg";
import {
  buildValuationPrintAttachmentRows,
  resolvePrintAttachmentOrder,
} from "../../lib/evaluator/valuation-report-property-attachments";
import { apiConfig } from "./valuation-work/lib/shell-utils";
import { ValCard } from "./EvaluatorHtmlPrimitives";
import { ValuationReportAttachmentsEditor } from "./ValuationReportAttachmentsEditor";
import { ValuationReportEsgEditor } from "./ValuationReportEsgEditor";

import { useValuationListsQuery } from "@platform/app-shared/query/valuation-lists-query";

const noteClassName = "mb-2 text-[11px] leading-relaxed text-text-3";
const ASSUMPTIONS_AUTOSAVE_MS = 500;

/** Final review: asset confirmation, special assumptions, ESG + attachments (appraiser). */
export function EvaluatorFinalReviewTab({
  draft,
  disabled = false,
  property,
  valuationRequestId: knownValuationRequestId,
  approachSettings: approachSettingsFromShell,
  onDraftPatch,
  onReportChoicesPatch,
  onSettingsSaved,
  onSpecialistDraftChange,
  fieldErrors,
}: {
  draft: EvaluatorSubmission;
  disabled?: boolean;
  property?: PoPropertyIntake | null;
  /** From ValuationWorkShell when present — avoids a second ensure-open for the same property. */
  valuationRequestId?: string | null;
  /**
   * Valuation settings from the shell when present (null = shell load failed) — skips
   * a duplicate tab fetch for the same settings; undefined = standalone mode fetches itself.
   */
  approachSettings?: ValuationApproachSettingsDto | null;
  onDraftPatch?: (patch: {
    assetDataConfirmed?: boolean;
    assetDataVarianceNotes?: string;
  }) => void;
  onReportChoicesPatch?: (patch: Partial<EvaluatorReportChoices>) => void;
  onSettingsSaved?: (dto: ValuationApproachSettingsDto) => void;
  /** Live specialist choice for submit validation (before autosave settles). */
  onSpecialistDraftChange?: (draft: EvaluatorSpecialistDraft) => void;
  fieldErrors?: Record<string, string>;
}) {
  const { showToast } = useToast();
  const choices = draft.reportChoices ?? emptyReportChoices();

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
  const [specialistUsed, setSpecialistUsed] = useState(false);
  const [specialistDetails, setSpecialistDetails] = useState("");
  const [freeAssumption, setFreeAssumption] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Local edits awaiting debounced autosave into approach settings. */
  const [dirty, setDirty] = useState(false);
  const [saveHint, setSaveHint] = useState<string | null>(null);
  /** Red highlight after a save attempt / submit while specialist details are still empty. */
  const [detailsInvalid, setDetailsInvalid] = useState(false);
  const queryClient = useQueryClient();
  const persistSeq = useRef(0);
  const editVersionRef = useRef(0);
  const assumptionsRef = useRef(assumptions);
  const specialistUsedRef = useRef(specialistUsed);
  const specialistDetailsRef = useRef(specialistDetails);
  const freeAssumptionRef = useRef(freeAssumption);
  const settingsRef = useRef(settings);
  const dirtyRef = useRef(dirty);
  const noSpecialistClauseRef = useRef("");
  const persistAssumptionsRef = useRef<() => Promise<void>>(async () => {});
  assumptionsRef.current = assumptions;
  specialistUsedRef.current = specialistUsed;
  specialistDetailsRef.current = specialistDetails;
  freeAssumptionRef.current = freeAssumption;
  settingsRef.current = settings;
  dirtyRef.current = dirty;

  useEffect(() => {
    onSpecialistDraftChange?.({
      used: specialistUsed,
      details: specialistDetails,
    });
  }, [specialistUsed, specialistDetails, onSpecialistDraftChange]);

  // Submit / parent validation asked for this field — paint it red and scroll to it.
  useEffect(() => {
    if (!fieldErrors?.specialist_details) return;
    setDetailsInvalid(true);
    scheduleScrollToFormField("val-specialist-details", 80, { retries: 24 });
  }, [fieldErrors?.specialist_details]);

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
        selectedKeys: choices.printAttachmentKeys,
      }),
    [attachmentCatalog, choices.printAttachmentKeys, propertyDocuments],
  );
  const printOrderKeys = useMemo(
    () =>
      resolvePrintAttachmentOrder(
        printRows.filter((row) => row.printable).map((row) => row.key),
        choices.printAttachmentOrder,
      ),
    [printRows, choices.printAttachmentOrder],
  );

  /** Seed assumptions list from settings — shared by standalone and shell modes. */
  const seedAssumptions = useCallback((s: ValuationApproachSettingsDto) => {
    const library = s.assumptionLibrary ?? [];
    const loaded = s.selectedAssumptions ?? [];
    const noSpecialistClause = resolveNoSpecialistClause(library);
    setSpecialistUsed(s.externalSpecialistUsed);
    setSpecialistDetails(s.externalSpecialistDetails ?? "");
    setDirty(false);
    setAssumptions(
      shouldUseDefaultSpecialAssumptions(loaded)
        ? defaultSelectedSpecialAssumptions(library, s.externalSpecialistUsed)
        : assumptionsAfterSpecialistChoice({
            specialistUsed: s.externalSpecialistUsed,
            assumptions: loaded,
            noSpecialistClause,
          }),
    );
  }, []);

  // Shell mode: settings come from parent — no duplicate fetch; seed once per
  // request (or when the server selection changes) so local edits are not wiped.
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
    const loaded = approachSettingsFromShell.selectedAssumptions ?? [];
    const seedKey = `${knownValuationRequestId ?? propertyId}:${
      shouldUseDefaultSpecialAssumptions(loaded)
        ? "default-all"
        : loaded.join("\u0001")
    }`;
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

  const assumptionRows = useMemo(() => {
    const library = settings?.assumptionLibrary ?? [];
    const extras = assumptions.filter((a) => !library.includes(a));
    return specialAssumptionRows(library, extras);
  }, [assumptions, settings?.assumptionLibrary]);

  const noSpecialistClause = resolveNoSpecialistClause(
    settings?.assumptionLibrary ?? [],
  );
  noSpecialistClauseRef.current = noSpecialistClause;

  function markDirty() {
    editVersionRef.current += 1;
    setDirty(true);
    setSaveHint(null);
  }

  function applySpecialistUsed(used: boolean) {
    markDirty();
    setSpecialistUsed(used);
    setAssumptions((prev) =>
      assumptionsAfterSpecialistChoice({
        specialistUsed: used,
        assumptions: prev,
        noSpecialistClause,
      }),
    );
    if (used && !specialistDetailsRef.current.trim()) {
      setDetailsInvalid(true);
      scheduleScrollToFormField("val-specialist-details", 80, { retries: 16 });
    } else {
      setDetailsInvalid(false);
    }
  }

  const persistAssumptions = useCallback(async () => {
    const config = apiConfig();
    const currentSettings = settingsRef.current;
    if (!config || !currentSettings || disabled) return;

    const used = specialistUsedRef.current;
    const details = specialistDetailsRef.current.trim();
    if (used && !details) {
      setDetailsInvalid(true);
      setSaveHint("أكمل وصف الاستعانة بالأخصائي ليُحفظ تلقائياً");
      return;
    }

    // Text still in «بند افتراض إضافي» (not yet «إضافة») is only flushed if somehow still dirty with text.
    const pending = freeAssumptionRef.current.trim();
    const base = assumptionsRef.current;
    const withPending =
      pending &&
      pending !== EXTERNAL_SPECIALIST_USED_LABEL &&
      !isNoExternalSpecialistAssumption(pending) &&
      !base.includes(pending)
        ? [...base, pending]
        : base;
    const selected = assumptionsAfterSpecialistChoice({
      specialistUsed: used,
      assumptions: withPending,
      noSpecialistClause: noSpecialistClauseRef.current,
    });

    const versionAtSave = editVersionRef.current;
    const seq = ++persistSeq.current;
    setSaving(true);
    setSaveHint(null);
    const res = await saveValuationApproachSettings(
      config,
      currentSettings.valuationRequestId,
      {
        marketApproachEnabled: currentSettings.marketApproachEnabled,
        costApproachEnabled: currentSettings.costApproachEnabled,
        incomeApproachEnabled: false,
        costBasisKey: currentSettings.costBasisKey,
        costScopeKey: currentSettings.costScopeKey,
        costMeasurementUnitKey: currentSettings.costMeasurementUnitKey,
        adjustmentsEditUnlocked: currentSettings.adjustmentsEditUnlocked,
        valuationPurposeKey: currentSettings.valuationPurposeKey,
        valuationPurposeNote: currentSettings.valuationPurposeNote ?? null,
        externalSpecialistUsed: used,
        externalSpecialistDetails: used ? details : null,
        valuationDateMode: currentSettings.valuationDateMode,
        retrospectiveDate: currentSettings.retrospectiveDate ?? null,
        retrospectiveDateEnd: currentSettings.retrospectiveDateEnd ?? null,
        retrospectiveRationale: null,
        selectedAssumptions: selected,
      },
    );
    if (seq !== persistSeq.current) return;
    setSaving(false);
    if (!res.ok) {
      setSaveHint(res.message ?? "تعذّر حفظ الافتراضات الخاصة");
      showToast(res.message ?? "تعذّر حفظ الافتراضات الخاصة", "error");
      return;
    }
    setSettings(res.data);
    onSettingsSaved?.(res.data);
    void queryClient.invalidateQueries({ queryKey: ["evaluator-report-output"] });
    // Skip applying server state if the user edited again while this request was in flight.
    if (editVersionRef.current !== versionAtSave) return;
    setAssumptions(selected);
    if (withPending !== base) setFreeAssumption("");
    setDirty(false);
    setSaveHint("تم الحفظ تلقائياً");
  }, [disabled, onSettingsSaved, queryClient, showToast]);

  // Debounced autosave — same cadence as EvaluatorWindow draft saves.
  useEffect(() => {
    if (!dirty || disabled || !settings) return;
    const timer = window.setTimeout(() => {
      void persistAssumptions();
    }, ASSUMPTIONS_AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [
    dirty,
    disabled,
    settings,
    assumptions,
    specialistUsed,
    specialistDetails,
    persistAssumptions,
  ]);

  persistAssumptionsRef.current = persistAssumptions;

  // Flush pending edits when leaving the tab so the report does not miss the last change.
  useEffect(() => {
    return () => {
      if (!dirtyRef.current || disabled) return;
      void persistAssumptionsRef.current();
    };
  }, [disabled]);

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

      <ValCard title="الافتراضات الخاصة">
        <p className={noteClassName}>
          أزل العبارة التي لا تصح على هذا العقار، أو أضف بنداً إضافياً. يُحفظ
          تلقائياً مع إعدادات التقييم ويُطبع المُبقى فقط.
        </p>
        {assumptionRows.length > 0 ? (
          <div className="mb-3 overflow-hidden rounded-[var(--radius)] border border-border">
            {assumptionRows.map((row) => {
              if (row.kind === "specialist-used") {
                return (
                  <div
                    key={row.key}
                    className="border-b border-border bg-surface last:border-b-0"
                  >
                    <label className="flex cursor-pointer items-start gap-2.5 px-3 py-2.5 text-[12.5px] leading-relaxed text-text transition-colors hover:bg-row-hover">
                      <input
                        type="radio"
                        name="val-specialist-assumption"
                        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--ink)]"
                        disabled={disabled || saving}
                        checked={specialistUsed}
                        onChange={() => applySpecialistUsed(true)}
                      />
                      <span>{EXTERNAL_SPECIALIST_USED_LABEL}</span>
                    </label>
                    {specialistUsed ? (
                      <div className="pe-3 ps-10 pb-2.5">
                        <label
                          className="mb-1 block text-[11px] text-text-2"
                          htmlFor="val-specialist-details"
                        >
                          وصف الاستعانة بالأخصائي
                        </label>
                        <input
                          id="val-specialist-details"
                          placeholder="الأخصائي، دوره، ونتيجته"
                          value={specialistDetails}
                          disabled={disabled || saving}
                          onChange={(e) => {
                            setSpecialistDetails(e.target.value);
                            if (e.target.value.trim()) setDetailsInvalid(false);
                            markDirty();
                          }}
                          className={cn(
                            opsFldControl,
                            "font-medium",
                            (detailsInvalid || err("specialist_details")) &&
                              !specialistDetails.trim() &&
                              invalidControlClass,
                          )}
                          aria-invalid={
                            (detailsInvalid ||
                              Boolean(err("specialist_details"))) &&
                            !specialistDetails.trim()
                          }
                        />
                        {((detailsInvalid || err("specialist_details")) &&
                        !specialistDetails.trim()) ? (
                          <p className="mt-1 text-[11.5px] font-semibold text-danger-text">
                            {err("specialist_details") ??
                              "توضيح الاستعانة بالأخصائي الخارجي إلزامي عند «نعم»"}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              }
              const isNoSpecialist = isNoExternalSpecialistAssumption(row.text);
              return (
                <label
                  key={row.key}
                  className="flex cursor-pointer items-start gap-2.5 border-b border-border bg-surface px-3 py-2.5 text-[12.5px] leading-relaxed text-text transition-colors last:border-b-0 hover:bg-row-hover"
                >
                  <input
                    type={isNoSpecialist ? "radio" : "checkbox"}
                    name={
                      isNoSpecialist ? "val-specialist-assumption" : undefined
                    }
                    className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--ink)]"
                    disabled={disabled || saving}
                    checked={
                      isNoSpecialist
                        ? !specialistUsed
                        : assumptions.includes(row.text)
                    }
                    onChange={(e) => {
                      if (isNoSpecialist) {
                        applySpecialistUsed(false);
                        return;
                      }
                      markDirty();
                      setAssumptions((prev) =>
                        e.target.checked
                          ? [...prev, row.text]
                          : prev.filter((x) => x !== row.text),
                      );
                    }}
                  />
                  <span>{row.text}</span>
                </label>
              );
            })}
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
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              (
                e.currentTarget.nextElementSibling as HTMLButtonElement | null
              )?.click();
            }}
            className={cn(opsFldControl, "flex-1 font-medium")}
          />
          <button
            type="button"
            className={cn(opsBtnPrimary, "shrink-0 !px-3 !py-2 text-[12px]")}
            disabled={disabled || saving || !freeAssumption.trim()}
            onClick={() => {
              const t = freeAssumption.trim();
              if (!t || t === EXTERNAL_SPECIALIST_USED_LABEL) {
                setFreeAssumption("");
                return;
              }
              if (isNoExternalSpecialistAssumption(t)) {
                applySpecialistUsed(false);
                setFreeAssumption("");
                return;
              }
              if (!assumptions.includes(t)) {
                setAssumptions((prev) => [...prev, t]);
              }
              setFreeAssumption("");
              markDirty();
            }}
          >
            إضافة
          </button>
        </div>
        {saving ? (
          <p className="mb-0 text-[11.5px] text-text-3" role="status">
            جاري الحفظ…
          </p>
        ) : saveHint ? (
          <p
            className={cn(
              "mb-0 text-[11.5px]",
              saveHint.startsWith("تم")
                ? "text-text-3"
                : "font-semibold text-amber-text",
            )}
            role="status"
          >
            {saveHint}
          </p>
        ) : dirty ? (
          <p className="mb-0 text-[11.5px] text-text-3" role="status">
            يُحفظ تلقائياً…
          </p>
        ) : null}
      </ValCard>

      <ValCard title="العوامل البيئية والاجتماعية والحوكمة (ESG)">
        <p className={noteClassName}>
          يعبّئها المقيّم في المراجعة النهائية وتُطبع في تقرير التقييم.
        </p>
        <ValuationReportEsgEditor
          esgEnv={choices.esgEnv}
          esgSoc={choices.esgSoc}
          esgGov={choices.esgGov}
          disabled={disabled}
          invalidGroups={
            err("esg_impact_notes")
              ? esgGroupsMissingImpactDescription(choices)
              : undefined
          }
          onPatch={(patch) => onReportChoicesPatch?.(patch)}
        />
        {err("esg_impact_notes") ? (
          <p className="mt-2 mb-0 text-[11px] text-danger-text">
            {err("esg_impact_notes")}
          </p>
        ) : null}
      </ValCard>

      <ValCard title="مرفقات التقرير">
        {/* Documents come from the property's documents tab — no uploads from the valuer's screen. */}
        <ValuationReportAttachmentsEditor
          rows={printRows}
          selectedKeys={choices.printAttachmentKeys}
          orderKeys={printOrderKeys}
          disabled={disabled}
          onChange={(patch) => onReportChoicesPatch?.(patch)}
        />
      </ValCard>
    </div>
  );
}
