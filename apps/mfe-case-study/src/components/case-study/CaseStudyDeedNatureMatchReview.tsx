"use client";

import { useCallback, useEffect, useState } from "react";
import { InlineLoadingSkeleton, Note, useToast } from "@platform/ui-kit";
import { propertyHasRegisteredTitle } from "@platform/app-shared/app-data/po-intake-identifiers";
import { DeedNatureMatchOutcomes } from "@platform/app-shared/domain/case-study/deed-nature-match-outcomes";
import { CaseStudyDeedNatureMatchSection } from "./CaseStudyDeedNatureMatchSection";
import {
  emptyCaseStudyFormDraft,
  type CaseStudyFormDraft,
} from "../../lib/app-data/case-study-form-model";
import { loadCaseStudyFormDraft } from "../../lib/app-data/case-study-form-reads";
import { saveCaseStudyFormDraft } from "../../lib/app-data/case-study-form-commands";
import { loadInspectorWorkspaceSnapshot } from "../../lib/app-data/inspector-workspace-reads";
import { isInspectorWorkspaceAccepted } from "../../lib/app-data/inspector-workspace-data";
import { loadEngineeringSurveySubmissionSnapshot } from "../../lib/app-data/property-detail-party-submission-loaders";
import { findPriorDeedFull } from "../../lib/app-data/po-intake-reads";
import type { PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import {
  inspectorBoundariesIndicateMismatch,
  proposeDeedNatureMatch,
} from "../../lib/app-data/deed-nature-match-proposal";

/**
 * Specialist adopt/amend of the party deed↔nature match — تقييم العقار tab.
 */
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
  /** True when the transaction was distributed to the engineering office. */
  engineeringAssigned?: boolean;
  readOnly?: boolean;
}) {
  const { showToast } = useToast();
  const [draft, setDraft] = useState<CaseStudyFormDraft | null>(null);
  const [sourceLabelAr, setSourceLabelAr] = useState("");
  const [suggestedOutcome, setSuggestedOutcome] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [form, inspector, survey, prior] = await Promise.all([
          loadCaseStudyFormDraft(caseStudyTaskId),
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
          form ?? emptyCaseStudyFormDraft(caseStudyTaskId, { propertyId: property.id, poNumber });
        setDraft(nextDraft);
        const inspectorSubmitted =
          inspector?.status === "submitted" ||
          isInspectorWorkspaceAccepted(inspector);
        const engineeringSubmitted =
          survey?.status === "submitted" ||
          Boolean(survey?.acceptedAtUtc?.trim());
        const proposal = proposeDeedNatureMatch({
          hasPriorSurvey: Boolean(prior),
          engineeringAssigned,
          engineeringDeedMatchesNature: engineeringSubmitted
            ? (survey?.deedMatchesNature ?? null)
            : null,
          inspectorSubmitted: Boolean(inspectorSubmitted),
          inspectorBoundaryMismatch: inspectorBoundariesIndicateMismatch(
            inspector ? Object.values(inspector.boundaryMatches) : null,
          ),
        });
        setSourceLabelAr(proposal.sourceLabelAr);
        setSuggestedOutcome(proposal.suggested);
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
    readOnly || draft?.status === "submitted";

  const persist = useCallback(
    async (patch: Partial<CaseStudyFormDraft>) => {
      if (!draft || locked || saving) return;
      setSaving(true);
      const latest =
        (await loadCaseStudyFormDraft(caseStudyTaskId)) ?? draft;
      if (latest.status === "submitted") {
        setDraft(latest);
        setSaving(false);
        showToast("النموذج مُرفَع — المطابقة للعرض فقط", "error");
        return;
      }
      const next = { ...latest, ...patch };
      setDraft(next);
      const result = await saveCaseStudyFormDraft(next);
      setSaving(false);
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      if (result.draft) setDraft(result.draft);
    },
    [caseStudyTaskId, draft, locked, saving, showToast],
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
        sourceLabelAr={sourceLabelAr}
        suggestedOutcome={suggestedOutcome}
        onAdoptSuggestion={() =>
          void persist({
            deedNatureMatchOutcome: suggestedOutcome,
            deedNatureMatchNotes:
              suggestedOutcome === DeedNatureMatchOutcomes.Matched
                ? ""
                : draft.deedNatureMatchNotes,
          })
        }
        onPatch={(p) => void persist(p)}
      />
    </div>
  );
}
