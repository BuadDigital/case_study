"use client";

/**
 * Registers case-study helpers into `@platform/app-shared` so
 * `@evaluator/mfe` never imports `@case-study/mfe` directly.
 * Call once from the shell at boot.
 */

import { registerEvaluatorCaseStudyBridge } from "@platform/app-shared/evaluator/case-study-bridge";
import { registerComparablePropertyEntryFields } from "@platform/app-shared/evaluator/comparable-entry-fields-slot";
import { registerPropertyDetailMediaGlance } from "@platform/app-shared/evaluator/property-detail-media-glance-slot";
import { ComparablePropertyEntryFields } from "../components/comparables/ComparablePropertyEntryFields";
import { PropertyDetailMediaGlance } from "../components/po-intake/PropertyDetailMediaGlance";
import { fetchInspectorWorkspaceReadOnly } from "../lib/app-data/inspector-workspace-reads";
import { prefetchInspectorWorkspacePhotos } from "../lib/app-data/inspector-photo-upload";
import {
  collectFieldInspectionDocumentsFromSubmission,
  downloadPropertyDetailDocument,
  openPropertyDetailDocumentPreview,
} from "../lib/app-data/property-detail-documents";
import { loadPartyCaseStudyReportDraft } from "../lib/app-data/case-study-report-reads";
import { savePartyCaseStudyReportDraft } from "../lib/app-data/case-study-report-commands";
import {
  usePoRecordQuery,
  useWorkflowTasksQuery,
} from "../query/case-study-queries";
import { usePropertyDetailDocuments } from "../query/property-detail-documents-query";

let registered = false;

export function ensureEvaluatorCaseStudyBridgeRegistered(): void {
  if (registered) return;
  registered = true;
  registerEvaluatorCaseStudyBridge({
    // The evaluator only reads the inspector's package — never the owner path (it would PUT).
    fetchInspectorWorkspace: fetchInspectorWorkspaceReadOnly,
    prefetchInspectorWorkspacePhotos,
    usePoRecordQuery,
    useWorkflowTasksQuery,
    usePropertyDetailDocuments,
    loadPartyCaseStudyReportDraft,
    savePartyCaseStudyReportDraft,
    collectFieldInspectionDocumentsFromSubmission,
    downloadPropertyDetailDocument,
    openPropertyDetailDocumentPreview,
  });
  registerComparablePropertyEntryFields(ComparablePropertyEntryFields);
  registerPropertyDetailMediaGlance(PropertyDetailMediaGlance);
}
