"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ensureOpenValuationRequestByProperty,
  getValuationApproachSettings,
  isNoExternalSpecialistAssumption,
  saveValuationApproachSettings,
  type OrganizationValuerRosterEntry,
  type ValuationApproachSettingsDto,
} from "@platform/api-client";
import {
  Spinner,
  cn,
  opsBtnPrimary,
  opsFldControl,
  useToast,
} from "@platform/ui-kit";

import { invalidControlClass } from "@platform/app-shared/form-ux";
import {
  ensureOrganizationSettingsLoaded,
  getCachedOrganizationSettings,
} from "@platform/app-shared/organization/organization-settings-cache";
import { useWorkflowTasksQuery } from "../../lib/case-study-bridge";
import { usePropertyDetailDocuments } from "../../lib/case-study-bridge";
import type { PoPropertyIntake } from "@platform/app-shared/app-data/po-intake-data";
import type {
  EvaluatorReportChoices,
  EvaluatorReportWorkerRole,
  EvaluatorSubmission,
} from "../../lib/evaluator/evaluator-window-data";
import {
  EVALUATOR_WORKER_ROLES,
  createEmptyReportWorker,
  emptyReportChoices,
} from "../../lib/evaluator/evaluator-window-data";
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
    independenceDeclared?: boolean;
    reportWorkers?: EvaluatorSubmission["reportWorkers"];
  }) => void;
  onReportChoicesPatch?: (patch: Partial<EvaluatorReportChoices>) => void;
  onSettingsSaved?: (dto: ValuationApproachSettingsDto) => void;
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
  const [rosterValuers, setRosterValuers] = useState<
    OrganizationValuerRosterEntry[]
  >(() =>
    (getCachedOrganizationSettings()?.valuers ?? []).filter(
      (v) => v.isActive !== false && v.nameAr.trim(),
    ),
  );

  useEffect(() => {
    let cancelled = false;
    void ensureOrganizationSettingsLoaded()
      .then((org) => {
        if (cancelled) return;
        setRosterValuers(
          (org?.valuers ?? []).filter(
            (v) => v.isActive !== false && v.nameAr.trim(),
          ),
        );
      })
      .catch(() => {
        /* roster stays empty — free-text name still works */
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  function applySpecialistUsed(used: boolean) {
    setSpecialistUsed(used);
    setAssumptions((prev) =>
      assumptionsAfterSpecialistChoice({
        specialistUsed: used,
        assumptions: prev,
        noSpecialistClause,
      }),
    );
  }

  async function saveAssumptions() {
    const config = apiConfig();
    if (!config || !settings || disabled) return;
    if (specialistUsed && !specialistDetails.trim()) {
      showToast("توضيح الاستعانة بالأخصائي الخارجي إلزامي عند «نعم»", "error");
      return;
    }
    setSaving(true);
    const selected = assumptionsAfterSpecialistChoice({
      specialistUsed,
      assumptions,
      noSpecialistClause,
    });
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
        externalSpecialistUsed: specialistUsed,
        externalSpecialistDetails: specialistUsed
          ? specialistDetails.trim()
          : null,
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
    onSettingsSaved?.(res.data);
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

      <ValCard title="إقرار الاستقلالية والمشاركون">
        <p className={noteClassName}>
          مطلوب قبل اعتماد التقييم وإرساله للأخصائي — إقرار الاستقلالية وعامل
          واحد على الأقل باسمه على التقرير.
        </p>

        <label
          id="inf-independence"
          className={cn(
            "mb-4 flex cursor-pointer items-start gap-2.5 rounded-[var(--radius)] border border-border bg-surface px-3 py-2.5 text-[12.5px] leading-relaxed text-text transition-colors hover:bg-row-hover",
            err("independence_declared") && invalidControlClass,
          )}
        >
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--ink)]"
            disabled={disabled}
            checked={draft.independenceDeclared}
            onChange={(e) =>
              onDraftPatch?.({ independenceDeclared: e.target.checked })
            }
          />
          <span>
            أقرّ بعدم وجود تضارب مصالح وبأن التقييم أُعدّ باستقلالية مهنية.
          </span>
        </label>
        {err("independence_declared") ? (
          <p className="mt-[-8px] mb-3 text-[11px] text-danger-text">
            {err("independence_declared")}
          </p>
        ) : null}

        <div id="inf-workers">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-bold text-heading">
              العاملون على التقرير
            </span>
            <button
              type="button"
              className={cn(opsBtnPrimary, "!px-2.5 !py-1.5 text-[11.5px]")}
              disabled={disabled}
              onClick={() => {
                const next = [
                  ...(draft.reportWorkers?.length
                    ? draft.reportWorkers
                    : [createEmptyReportWorker("معد")]),
                  createEmptyReportWorker(
                    draft.reportWorkers?.length ? "مراجع" : "معد",
                  ),
                ];
                onDraftPatch?.({ reportWorkers: next });
              }}
            >
              إضافة عامل
            </button>
          </div>
          <div
            className={cn(
              "overflow-hidden rounded-[var(--radius)] border border-border",
              err("report_workers") && invalidControlClass,
            )}
          >
            {(draft.reportWorkers?.length
              ? draft.reportWorkers
              : [createEmptyReportWorker("معد")]
            ).map((worker, index, list) => (
              <div
                key={worker.id}
                className="grid grid-cols-1 gap-2 border-b border-border bg-surface px-3 py-2.5 last:border-b-0 sm:grid-cols-[140px_minmax(0,1fr)_auto] sm:items-end"
              >
                <div>
                  <label className="mb-1 block text-[11px] text-text-2">
                    الدور
                  </label>
                  <select
                    className={cn(opsFldControl, "font-medium")}
                    disabled={disabled}
                    value={worker.role || "معد"}
                    onChange={(e) => {
                      const role = e.target.value as EvaluatorReportWorkerRole;
                      const next = list.map((w) =>
                        w.id === worker.id ? { ...w, role } : w,
                      );
                      onDraftPatch?.({ reportWorkers: next });
                    }}
                  >
                    {EVALUATOR_WORKER_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-text-2">
                    الاسم
                  </label>
                  {rosterValuers.length > 0 ? (
                    <select
                      className={cn(opsFldControl, "mb-1.5 font-medium")}
                      disabled={disabled}
                      value={
                        rosterValuers.some((v) => v.nameAr === worker.name)
                          ? worker.name
                          : ""
                      }
                      onChange={(e) => {
                        const picked = e.target.value;
                        if (!picked) return;
                        const valuer = rosterValuers.find(
                          (v) => v.nameAr === picked,
                        );
                        const next = list.map((w) =>
                          w.id === worker.id
                            ? {
                                ...w,
                                name: picked,
                                licenseNumber:
                                  valuer?.licenseNumber?.trim() ||
                                  w.licenseNumber ||
                                  "",
                              }
                            : w,
                        );
                        onDraftPatch?.({ reportWorkers: next });
                      }}
                    >
                      <option value="">— اختر من سجل المقيّمين —</option>
                      {rosterValuers.map((v) => (
                        <option key={v.id} value={v.nameAr}>
                          {v.nameAr}
                          {v.licenseNumber?.trim()
                            ? ` · ترخيص ${v.licenseNumber.trim()}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <input
                    type="text"
                    placeholder="اسم المشارك"
                    className={cn(opsFldControl, "font-medium")}
                    disabled={disabled}
                    value={worker.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      const next = list.map((w) =>
                        w.id === worker.id ? { ...w, name } : w,
                      );
                      onDraftPatch?.({ reportWorkers: next });
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="h-[38px] rounded-md border border-border bg-surface px-3 text-[12px] font-bold text-text-2 disabled:opacity-40"
                  disabled={disabled || list.length <= 1}
                  aria-label="حذف العامل"
                  onClick={() => {
                    const next = list.filter((w) => w.id !== worker.id);
                    onDraftPatch?.({
                      reportWorkers:
                        next.length > 0 ? next : [createEmptyReportWorker()],
                    });
                  }}
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
          {err("report_workers") ? (
            <p className="mt-2 mb-0 text-[11px] text-danger-text">
              {err("report_workers")}
            </p>
          ) : (
            <p className="mt-2 mb-0 text-[10.5px] text-text-3">
              اختر من سجل المقيّمين في الإعدادات، أو أدخل اسماً يدوياً. عامل
              واحد على الأقل مطلوب (معد / مراجع / معتمد).
            </p>
          )}
        </div>
      </ValCard>

      <ValCard title="الافتراضات الخاصة">
        <p className={noteClassName}>
          أزل العبارة التي لا تصح على هذا العقار، أو أضف بنداً إضافياً. يُحفظ مع
          إعدادات التقييم ويُطبع المُبقى فقط.
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
                          onChange={(e) => setSpecialistDetails(e.target.value)}
                          className={cn(opsFldControl, "font-medium")}
                        />
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
