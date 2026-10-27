"use client";

/** Infath upload assistant tab — deposit, attachments, and copyable sections. */

import { InlineLoadingSkeleton } from "@platform/ui-kit";
import { EmptyState, SectionHeader } from "./PropertyDetailFields";
import type { PropertyDetailDocumentSection } from "../../lib/app-data/property-detail-documents";
import type { PropertyDetailPartySubmissionsMap } from "../../lib/app-data/property-detail-party-submissions";
import type {
  PoIntakeRecord,
  PoPropertyIntake,
} from "../../lib/app-data/po-intake-data";
import type { WorkflowTask } from "../../lib/app-data/tasks";
import type { CaseStudyReportDeeds } from "../../lib/app-data/case-study-report-document-model";
import { InfathSectionBlock } from "./PropertyDetailUploadAssistantRows";
import {
  InfathAttachmentsPanel,
  InfathCollapseControls,
} from "./PropertyDetailUploadAssistantPanels";
import { usePropertyDetailEnfathUploadWorkflow } from "./usePropertyDetailUploadAssistantWorkflow";

export function PropertyDetailEnfathUpload({
  record,
  property,
  task,
  studyTask,
  reportDeeds,
  hasSurveyTask,
  parties,
  documentSections,
  loading,
}: {
  record: PoIntakeRecord;
  property: PoPropertyIntake;
  task: WorkflowTask | null;
  /** The task holding the transaction's case-study report (the holder deed's for linked deeds). */
  studyTask: WorkflowTask | null;
  reportDeeds?: CaseStudyReportDeeds;
  /** The transaction has a survey task. */
  hasSurveyTask: boolean;
  parties: PropertyDetailPartySubmissionsMap | null | undefined;
  documentSections: PropertyDetailDocumentSection[];
  loading?: boolean;
}) {
  const flow = usePropertyDetailEnfathUploadWorkflow({
    record,
    property,
    parties,
    documentSections,
    studyTask,
    reportDeeds,
    hasSurveyTask,
  });

  if (!task) {
    return (
      <>
        <SectionHeader>الرفع على إنفاذ</SectionHeader>
        <EmptyState
          icon="⬆"
          title="لم تُبدأ دراسة الحالة"
          sub="يظهر مساعد الرفع على إنفاذ بعد بدء دراسة الحالة لهذا العقار."
        />
      </>
    );
  }

  if (loading) {
    return (
      <>
        <SectionHeader>الرفع على إنفاذ</SectionHeader>
        <InlineLoadingSkeleton />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <InfathCollapseControls onSetAllCollapsed={flow.setAllCollapsed} />

      <InfathAttachmentsPanel
        attachments={flow.model.attachments}
        downloadingIds={flow.downloadingIds}
        onDownload={flow.handleDownloadAttachment}
        onDownloadAll={flow.handleDownloadAll}
      />

      <div className="flex flex-col gap-3">
        {flow.model.sections.map((section) => (
          <InfathSectionBlock
            key={section.id}
            section={section}
            collapsed={flow.collapsedSections.has(section.id)}
            copiedKeys={flow.copiedKeys}
            flashKey={flow.flashKey}
            onToggle={() => flow.toggleSection(section.id)}
            onCopyField={flow.handleCopyField}
            onCopyArea={flow.handleCopyArea}
            onDownloadFile={flow.handleDownloadFile}
          />
        ))}
      </div>
    </div>
  );
}
