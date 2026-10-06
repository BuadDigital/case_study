"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { InlineLoadingSkeleton, Note, useToast } from "@platform/ui-kit";
import { propertyHasRegisteredTitle } from "@platform/app-shared/app-data/po-intake-identifiers";
import { DeedNatureMatchOutcomes } from "@platform/app-shared/domain/case-study/deed-nature-match-outcomes";
import { CaseStudyDeedNatureMatchSection } from "./CaseStudyDeedNatureMatchSection";
import { emptyCaseStudyReportDraft, type CaseStudyReportDraft } from "../../lib/app-data/case-study-report-model";
import { loadCaseStudyReportDraft } from "../../lib/app-data/case-study-report-reads";
import { saveCaseStudyReportDraft } from "../../lib/app-data/case-study-report-commands";
import { loadInspectorWorkspaceSnapshot } from "../../lib/app-data/inspector-workspace-reads";
import { isInspectorWorkspaceAccepted } from "../../lib/app-data/inspector-workspace-data";
import { loadEngineeringSurveySubmissionSnapshot } from "../../lib/app-data/property-detail-party-submission-loaders";
import { findPriorDeedFull } from "../../lib/app-data/po-intake-reads";
import type { PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import { proposeDeedNatureMatch, type DeedNatureMatchProposal } from "../../lib/app-data/deed-nature-match-proposal";

/**
 * Notes that go with an adopted suggestion: «matched» clears them; «differences» carries the
 * inspector's per-side notes (the server rejects differences with empty notes) without
 * dropping what the specialist already wrote.
 */
function adoptedNotes(suggested: string, current: string | undefined, inspectorNotes: string): string {
  if (suggested === DeedNatureMatchOutcomes.Matched) return "";
  const existing = (current ?? "").trim();
  if (!inspectorNotes || existing.includes(inspectorNotes)) return current ?? "";
  return existing ? `${existing}\n${inspectorNotes}` : inspectorNotes;
}

export function CaseStudyDeedNatureMatchReview({
  caseStudyTaskId,
  property,
  poNumber,
  surveyTaskId,
  inspectionTaskId,
  engineeringAssigned = false,
  readOnly = false,
}: {
  caseStudyTaskId: string;
  property: PoPropertyIntake;
  poNumber: string;
  surveyTaskId: string | null;
  inspectionTaskId: string | null;
  engineeringAssigned?: boolean;
  /**
   * Locked by the caller once the case-study task is completed. Accepting the
   * inspector package does NOT lock this section: it stays editable until the
   * report is issued (the `draft.status === "issued"` lock below).
   */
  readOnly?: boolean;
}) {
  const { showToast } = useToast();
  const [draft, setDraft] = useState<CaseStudyReportDraft | null>(null);
  const [proposal, setProposal] = useState<DeedNatureMatchProposal | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingLock = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [form, inspector, survey, prior] = await Promise.all([
          loadCaseStudyReportDraft(caseStudyTaskId),
          inspectionTaskId
            ? loadInspectorWorkspaceSnapshot(inspectionTaskId)
            : Promise.resolve(null),
          engineeringAssigned && surveyTaskId
            ? loadEngineeringSurveySubmissionSnapshot(surveyTaskId)
            : Promise.resolve(null),
          property.deedNumber.trim()
            ? findPriorDeedFull(property.deedNumber, poNumber, property.id)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        const nextDraft =
          form ?? emptyCaseStudyReportDraft(caseStudyTaskId, { propertyId: property.id, poNumber });
        setDraft(nextDraft);
        const inspectorSubmitted = inspector?.status === "submitted" || isInspectorWorkspaceAccepted(inspector);
        const engineeringSubmitted = survey?.status === "submitted" || Boolean(survey?.acceptedAtUtc?.trim());
        setProposal(
          proposeDeedNatureMatch({
            inspector,
            inspectorSubmitted: Boolean(inspectorSubmitted),
            hasPriorSurvey: Boolean(prior),
            engineeringAssigned,
            engineeringDeedMatchesNature: engineeringSubmitted ? (survey?.deedMatchesNature ?? null) : null,
          }),
        );
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "تعذّر تحميل مصدر المطابقة",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    caseStudyTaskId,
    inspectionTaskId,
    poNumber,
    property.deedNumber,
    property.id,
    surveyTaskId,
    engineeringAssigned,
  ]);

  const locked =
    readOnly || draft?.status === "issued";

  const persist = useCallback(
    async (patch: Partial<CaseStudyReportDraft>) => {
      if (!draft || locked || savingLock.current) return;
      savingLock.current = true;
      setSaving(true);
      try {
        const latest =
          (await loadCaseStudyReportDraft(caseStudyTaskId)) ?? draft;
        if (latest.status === "issued") {
          setDraft(latest);
          showToast("التقرير صادر — المطابقة للعرض فقط", "error");
          return;
        }
        const next = { ...latest, ...patch };
        setDraft(next);
        const result = await saveCaseStudyReportDraft(next);
        if (!result.ok) {
          showToast(result.error, "error");
          return;
        }
        if (result.draft) setDraft(result.draft);
      } finally {
        savingLock.current = false;
        setSaving(false);
      }
    },
    [caseStudyTaskId, draft, locked, showToast],
  );

  if (propertyHasRegisteredTitle(property)) {
    return (
      <Note tone="info" className="mb-6">
        سجل عيني — لا بوابة مطابقة مساحية. بيانات الصك قطعية.
      </Note>
    );
  }

  if (loadError) {
    return (
      <Note tone="warn" className="mb-6">
        {loadError}
      </Note>
    );
  }

  if (!draft) {
    return <InlineLoadingSkeleton className="mb-6" />;
  }

  return (
    <div className="mb-6">
      <CaseStudyDeedNatureMatchSection
        draft={draft}
        disabled={locked || saving}
        sourceLabelAr={proposal?.sourceLabelAr}
        suggestedOutcome={proposal?.suggested}
        infoLinesAr={proposal?.infoLinesAr}
        onAdoptSuggestion={() => {
          if (!proposal?.suggested) return;
          void persist({
            deedNatureMatchOutcome: proposal.suggested,
            deedNatureMatchNotes: adoptedNotes(
              proposal.suggested,
              draft.deedNatureMatchNotes,
              proposal.inspectorMismatchNotes,
            ),
          });
        }}
        onPatch={(p) => void persist(p)}
      />
    </div>
  );
}