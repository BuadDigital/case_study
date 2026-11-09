"use client";

/** Infath upload assistant tab — deposit, attachments, and copyable sections. */

import { useState } from "react";
import {
  AppModal,
  Button,
  InlineLoadingSkeleton,
  OpsIcon,
  useWorkDensity,
} from "@platform/ui-kit";
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
import { UploadPrepBar } from "./UploadPrepBar";
import { enfathPackageLine } from "./property-detail-upload-assistant-state";

/** «مساعد الرفع على إنفاذ» upload arrow (lucide «upload» paths). */
const UPLOAD_PATH = "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12";

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
  // Inside the work page's layout (`work` density) the assistant opens in a window (Omar 2026-11-09).
  const inWorkPage = useWorkDensity();
  const [assistantOpen, setAssistantOpen] = useState(false);

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

  const assistant = (
    <>
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
    </>
  );

  const prepBar = (
    <UploadPrepBar workOrderId={record.id} propertyId={property.id} attachments={flow.model.attachments} />
  );

  if (inWorkPage) {
    // The work page (Omar 2026-11-09): like the report draft — a status line and «مساعد الرفع على إنفاذ»,
    // which opens the data to upload (attachments + fields to copy) in a window; the prep check stays on the page.
    return (
      <div className="flex flex-col gap-3">
        {prepBar}
        <div
          className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-2/50 px-3.5 py-2.5"
          data-testid="enfath-assistant-compact"
        >
          <span className="flex-1 text-[12.5px] text-text">{enfathPackageLine(flow.model)}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => setAssistantOpen(true)}>
            <span className="inline-flex items-center gap-1.5">
              <OpsIcon path={UPLOAD_PATH} size={15} />
              مساعد الرفع على إنفاذ
            </span>
          </Button>
        </div>
        <AppModal
          open={assistantOpen}
          onClose={() => setAssistantOpen(false)}
          title="مساعد الرفع على إنفاذ"
          subtitle="البيانات والمرفقات التي تُرفع على إنفاذ — انسخ كل حقل أو نزّل المرفق"
          maxWidthPx={1180}
        >
          {assistantOpen ? <div className="flex flex-col gap-4">{assistant}</div> : null}
        </AppModal>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {prepBar}
      {assistant}
    </div>
  );
}
