"use client";

import { PropertyDetailEnfazHandoverCard } from "../components/po-intake/PropertyDetailEnfazHandoverCard";
import { PropertyDetailEnfathUpload } from "../components/po-intake/PropertyDetailUploadAssistant";
import type { CaseStudyReportDeeds } from "../lib/app-data/case-study-report-document-model";
import type { PoIntakeRecord, PoPropertyIntake } from "../lib/app-data/po-intake-data";
import type { WorkflowTask } from "../lib/app-data/tasks";
import { usePropertyDetailPartySubmissionsQuery } from "../query/property-detail-party-submissions-queries";
import { useWorkDeedDocuments } from "./use-work-deed-documents";

/**
 * The work page's «الرفع على إنفاذ» section (Omar 2026-11-08): the handover card, then the upload package
 * itself — its «تجهيز المعاملة للرفع» check, then «مساعد الرفع على إنفاذ» with the attachments and the
 * fields to copy (Omar 2026-11-09: in a window, like the report draft) — so review prepares and uploads
 * without leaving for the details page.
 *
 * How it works: `useWorkDeedDocuments` gives the party tasks and the deed's documents; with the parties'
 * packages they feed `PropertyDetailEnfathUpload` exactly as the details tab does.
 * Edge cases: mounted only when the section is opened (the frame mounts sections on first open), so the
 * documents fan-out runs only then.
 */
export function WorkUploadSection({
  record,
  property,
  task,
  studyTask,
  tasks,
  reportDeeds,
  showHandoverCard,
}: {
  record: PoIntakeRecord;
  property: PoPropertyIntake;
  /** The deed's own case-study task. */
  task: WorkflowTask | null;
  /** The task holding the transaction's study (the holder deed's for linked deeds). */
  studyTask: WorkflowTask | null;
  tasks: WorkflowTask[];
  reportDeeds?: CaseStudyReportDeeds;
  showHandoverCard: boolean;
}) {
  const { surveyTask, documentSections } = useWorkDeedDocuments({ record, property, task, tasks });
  const parties = usePropertyDetailPartySubmissionsQuery({ parentTask: task, allTasks: tasks });

  return (
    <div className="flex flex-col gap-3 pt-3">
      {showHandoverCard ? (
        <PropertyDetailEnfazHandoverCard workOrderId={record.id} propertyId={property.id} />
      ) : null}
      <PropertyDetailEnfathUpload
        record={record}
        property={property}
        task={task}
        studyTask={studyTask}
        reportDeeds={reportDeeds}
        hasSurveyTask={Boolean(surveyTask && surveyTask.status !== "cancelled")}
        parties={parties.data}
        documentSections={documentSections}
        loading={parties.isLoading}
      />
    </div>
  );
}
