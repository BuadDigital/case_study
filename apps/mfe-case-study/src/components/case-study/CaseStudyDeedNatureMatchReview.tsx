"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { InlineLoadingSkeleton, Note, useToast } from "@platform/ui-kit";
import { propertyDeedKindIsRegisteredTitle } from "@platform/app-shared/app-data/po-intake-identifiers";
import {
  deedMatchDissent,
  DeedNatureMatchOutcomes,
} from "@platform/app-shared/domain/case-study/deed-nature-match-outcomes";
import { CaseStudyDeedNatureMatchSection } from "./CaseStudyDeedNatureMatchSection";
import { emptyCaseStudyReportDraft, type CaseStudyReportDraft, CaseStudyReportStatuses } from "@platform/app-shared/app-data/case-study-report-model";
import { notifyCaseStudyDeedMatchChanged } from "@platform/app-shared/app-data/case-study-report-model";
import { loadCaseStudyReportDraft } from "../../lib/app-data/case-study-report-reads";
import { saveCaseStudyReportDraft } from "../../lib/app-data/case-study-report-commands";
import { loadInspectorWorkspaceSnapshot } from "../../lib/app-data/inspector-workspace-reads";
import { loadEngineeringSurveySubmissionSnapshot } from "../../lib/app-data/property-detail-party-submission-loaders";
import { findPriorDeedFull } from "../../lib/app-data/po-intake-reads";
import type { PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import { deedMatchSourceView, type DeedMatchSideRow, type DeedNatureMatchProposal } from "../../lib/app-data/deed-nature-match-proposal";

export function CaseStudyDeedNatureMatchReview({
  caseStudyTaskId,
  property,
  poNumber,
  surveyTaskId,
  inspectionTaskId,
  engineeringAssigned = false,
  readOnly = false,
  readOnlyOnceDecided = false,
  officeDetails,
}: {
  caseStudyTaskId: string;
  /** What the engineering office sent — offered under its line once its survey is sent. */
  officeDetails?: ReactNode;
  property: PoPropertyIntake;
  poNumber: string;
  surveyTaskId: string | null;
  inspectionTaskId: string | null;
  engineeringAssigned?: boolean;
  /**
   * Locked by the caller once the case-study task is completed. On the work page accepting
   * the inspector package does NOT lock this section: it stays editable until the report is
   * issued (the `draft.status === "issued"` lock below).
   */
  readOnly?: boolean;
  /**
   * The study workspace's read-only page (Omar 2026-11-12), once the inspector's inputs are
   * confirmed: the outcome is read, not changed. An outcome never chosen stays open — the
   * study report cannot be issued without it, and the only other way back would be to undo
   * the confirmation and return the package to the inspector.
   */
  readOnlyOnceDecided?: boolean;
}) {
  const { showToast } = useToast();
  const [draft, setDraft] = useState<CaseStudyReportDraft | null>(null);
  const [proposal, setProposal] = useState<DeedNatureMatchProposal | null>(null);
  const [sides, setSides] = useState<DeedMatchSideRow[]>([]);
  const [officeSent, setOfficeSent] = useState(false);
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
        const view = deedMatchSourceView({
          property,
          inspector,
          survey,
          hasPriorSurvey: Boolean(prior),
          engineeringAssigned,
        });
        setSides(view.sides);
        setProposal(view.proposal);
        setOfficeSent(view.officeSent);
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
    readOnly ||
    draft?.status === CaseStudyReportStatuses.Issued ||
    (readOnlyOnceDecided && Boolean(draft?.deedNatureMatchOutcome));

  const persist = useCallback(
    async (patch: Partial<CaseStudyReportDraft>) => {
      if (!draft || locked || savingLock.current) return;
      savingLock.current = true;
      setSaving(true);
      let rollbackDraft = draft;
      try {
        const latest =
          (await loadCaseStudyReportDraft(caseStudyTaskId)) ?? draft;
        rollbackDraft = latest;
        if (latest.status === CaseStudyReportStatuses.Issued) {
          setDraft(latest);
          showToast("التقرير صادر — المطابقة للعرض فقط", "error");
          return;
        }
        const next = { ...latest, ...patch };
        setDraft(next);
        const result = await saveCaseStudyReportDraft(next);
        if (!result.ok) {
          setDraft(latest);
          showToast(result.error, "error");
          return;
        }
        if (result.draft) setDraft(result.draft);
        const saved = result.draft ?? next;
        notifyCaseStudyDeedMatchChanged({
          taskId: saved.taskId,
          deedNatureMatchOutcome: saved.deedNatureMatchOutcome ?? "",
          deedNatureMatchNotes: saved.deedNatureMatchNotes ?? "",
        });
      } catch (err) {
        setDraft(rollbackDraft);
        showToast(
          err instanceof Error ? err.message : "تعذّر حفظ نتيجة المطابقة",
          "error",
        );
      } finally {
        savingLock.current = false;
        setSaving(false);
      }
    },
    [caseStudyTaskId, draft, locked, showToast],
  );

  // The deed's own kind (the issue gate's rule) — a traditional deed with a registration number
  // still needs the match verdict, so the control must stay reachable.
  if (propertyDeedKindIsRegisteredTitle(property)) {
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
        sides={sides}
        dissent={deedMatchDissent(
          proposal?.source === "inspector" &&
            !proposal.waiting &&
            proposal.suggested === DeedNatureMatchOutcomes.Differences,
          Boolean(proposal?.engineeringSaidNotMatched),
        )}
        suggestedNotes={proposal?.inspectorMismatchNotes}
        officeDetails={officeSent ? officeDetails : undefined}
        onPatch={(p) => void persist(p)}
      />
    </div>
  );
}