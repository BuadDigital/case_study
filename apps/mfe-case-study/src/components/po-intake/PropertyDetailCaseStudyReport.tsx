"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { emptyCaseStudyInfoRolesConfig } from "@settings/mfe";
import { useCaseStudyInfoRolesQuery } from "@settings/mfe/query/settings-queries";
import { CaseStudyReportDocument } from "../case-study/CaseStudyReportDocument";
import { CaseStudyPartyProgressRings } from "../case-study/CaseStudyPartyProgressRings";
import { buildCaseStudyReportModel } from "../../lib/prototype/case-study-report-model";
import {
  computePartyCaseStudyProgress,
  loadPartyCaseStudyAnswersByParty,
} from "../../lib/prototype/case-study-party-progress";
import {
  loadCaseStudyFormDraft,
  PARTY_CASE_STUDY_FORM_CHANGED_EVENT,
  type CaseStudyFormDraft,
} from "../../lib/prototype/case-study-form-storage";
import type { PoIntakeRecord, PoPropertyIntake } from "../../lib/prototype/po-intake-data";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";
import { caseStudyWorkspacePath } from "../../lib/my-task-routes";
import { useWorkflowTasksQuery } from "../../query/case-study-queries";
import { EmptyState, InfoBox } from "./PropertyDetailFields";
import { cn, InlineLoadingSkeleton } from "@platform/design-system";

const DEFAULT_INFO_ROLES = emptyCaseStudyInfoRolesConfig();

const linkButtonPrimarySmClass = cn(
  "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-DEFAULT)] border font-normal whitespace-nowrap transition-colors",
  "px-2 py-1 text-[11px]",
  "border-primary bg-primary text-white hover:border-primary-mid hover:bg-primary-mid",
);

export function PropertyDetailCaseStudyReport({
  record,
  property,
  task,
}: {
  record: PoIntakeRecord;
  property: PoPropertyIntake;
  task: WorkflowTask | null;
}) {
  const [draft, setDraft] = useState<CaseStudyFormDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [partyRevision, setPartyRevision] = useState(0);

  const { data: tasks = [] } = useWorkflowTasksQuery();
  const { data: infoRolesData } = useCaseStudyInfoRolesQuery();
  const infoRolesMatrix = infoRolesData?.matrix ?? DEFAULT_INFO_ROLES.matrix;

  const refreshDraft = useCallback(async () => {
    if (!task) {
      setDraft(null);
      return;
    }
    setLoading(true);
    const loaded = await loadCaseStudyFormDraft(task.id);
    setDraft(loaded);
    setLoading(false);
  }, [task]);

  useEffect(() => {
    void refreshDraft();
  }, [refreshDraft, partyRevision]);

  useEffect(() => {
    const bump = () => setPartyRevision((n) => n + 1);
    window.addEventListener(PARTY_CASE_STUDY_FORM_CHANGED_EVENT, bump);
    return () =>
      window.removeEventListener(PARTY_CASE_STUDY_FORM_CHANGED_EVENT, bump);
  }, []);

  const [partyAnswers, setPartyAnswers] = useState<
    Awaited<ReturnType<typeof loadPartyCaseStudyAnswersByParty>> | null
  >(null);

  useEffect(() => {
    if (!task) {
      setPartyAnswers(null);
      return;
    }
    let cancelled = false;
    void loadPartyCaseStudyAnswersByParty(task, tasks).then((loaded) => {
      if (!cancelled) setPartyAnswers(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [task, tasks, partyRevision, draft]);

  const reportModel = useMemo(() => {
    if (!task || !draft) return null;
    return buildCaseStudyReportModel(draft, property, task, record);
  }, [draft, property, record, task]);

  const partyProgress = useMemo(() => {
    if (!partyAnswers) return [];
    return computePartyCaseStudyProgress(infoRolesMatrix, partyAnswers);
  }, [infoRolesMatrix, partyAnswers]);

  if (!task) {
    return (
      <InfoBox variant="amber" icon="ℹ">
        لم يُبدأ بنموذج دراسة الحالة بعد — افتح مسار دراسة حالة العقارات
        لإكماله.
      </InfoBox>
    );
  }

  if (loading) {
    return (
      <InlineLoadingSkeleton />
    );
  }

  if (!draft || !reportModel) {
    return (
      <>
        <EmptyState
          icon="📋"
          title="لم يُبدأ النموذج بعد"
          sub="سيظهر هنا نموذج دراسة الحالة مع جميع الأسئلة والإجابات بعد البدء في تعبئته."
        />
        <p className="mt-3">
          <Link href={caseStudyWorkspacePath(task.id)} className={linkButtonPrimarySmClass}>
            دراسة حالة العقار
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <CaseStudyPartyProgressRings items={partyProgress} />
      <div className="mt-1">
        <CaseStudyReportDocument model={reportModel} />
      </div>
      <p className="mt-3">
        <Link href={caseStudyWorkspacePath(task.id)} className={linkButtonPrimarySmClass}>
          دراسة حالة العقار
        </Link>
      </p>
    </>
  );
}
