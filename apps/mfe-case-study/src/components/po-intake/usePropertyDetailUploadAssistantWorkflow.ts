"use client";

/**
 * Workflow behind the Infath upload assistant: the upload model (from record,
 * property, party submissions, documents and ops context), the deposit draft,
 * the collapse / copied sets, and the copy + download handlers.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@platform/ui-kit";
import {
  buildInfathUploadModel,
  copyInfathText,
  downloadInfathDocument,
  type InfathOpsContext,
} from "../../lib/app-data/infath-upload-model";
import type {
  InfathUploadAttachment,
  InfathUploadModel,
} from "../../lib/app-data/infath-upload-types";
import type { PropertyDetailDocumentSection } from "../../lib/app-data/property-detail-documents";
import type { PropertyDetailPartySubmissionsMap } from "../../lib/app-data/property-detail-party-submissions";
import {
  formatPropertyDeedDisplay,
  type PoIntakeRecord,
  type PoPropertyIntake,
} from "../../lib/app-data/po-intake-data";
import { usePropertyOperationsTasks } from "../../query/use-property-operations-tasks";
import { getBuildingInventory, type BuildingInventoryLineDto } from "@platform/api-client";
import { workOrdersApiConfig } from "../../lib/work-orders-api-config";
import {
  resolveEnvelopeIdFromSources,
  usePropertyKeyGateQuery,
} from "../../query/use-property-key-gate-query";
import { usePropertyReportDraftQuery } from "../../query/use-property-report-draft-query";
import {
  collapsedSectionIds,
  copyToastPreview,
  courtVisitOpsFields,
  findInfathDocumentByName,
  initialCollapsedSectionIds,
  readyAttachments,
  toggledSet,
  withCopiedKey,
  type CopyKey,
} from "./property-detail-upload-assistant-state";

export type PropertyDetailEnfathUploadWorkflow = {
  model: InfathUploadModel;
  collapsedSections: Set<string>;
  copiedKeys: Set<CopyKey>;
  toggleSection: (sectionId: string) => void;
  setAllCollapsed: (collapse: boolean) => void;
  handleCopyField: (key: CopyKey, text: string) => Promise<void>;
  handleCopyArea: (key: CopyKey, text: string) => Promise<void>;
  handleDownloadFile: (fileName: string) => void;
  handleDownloadAttachment: (item: InfathUploadAttachment) => void;
  handleDownloadAll: () => void;
};

export function usePropertyDetailEnfathUploadWorkflow({
  record,
  property,
  parties,
  documentSections,
}: {
  record: PoIntakeRecord;
  property: PoPropertyIntake;
  parties: PropertyDetailPartySubmissionsMap | null | undefined;
  documentSections: PropertyDetailDocumentSection[];
}): PropertyDetailEnfathUploadWorkflow {
  const poNumber = record.poNumber.trim();
  const deedNumber = property.deedNumber.trim();
  const deedDisplay = formatPropertyDeedDisplay(property) || deedNumber;

  const { primaryCourtVisit } = usePropertyOperationsTasks(
    { poNumber, deedNumber, deedDisplay },
    { live: true },
  );
  const { data: keyGate } = usePropertyKeyGateQuery({
    propertyId: property.id,
    poNumber,
    deedNumber,
    requestNumber: property.requestNumber.trim() || undefined,
  });

  // The deposit code and the certificate are recorded on the valuation report's issuance — nowhere else.
  const { data: reportDraft } = usePropertyReportDraftQuery(property.id);

  const opsContext = useMemo((): InfathOpsContext => {
    const visit = primaryCourtVisit;
    const envelopeId = resolveEnvelopeIdFromSources(
      keyGate,
      visit?.linkedEnvelopeId,
    );
    return {
      ...courtVisitOpsFields(visit),
      keysStatus: keyGate?.keysStatus ?? null,
      keyAvailable: keyGate?.keyAvailable,
      envelopeId,
      depositCode: reportDraft?.depositCode?.trim() ?? "",
      depositCertificateName: reportDraft?.certificateFileName?.trim() ?? "",
    };
  }, [primaryCourtVisit, keyGate, reportDraft]);

  // Building areas come from the specialist's «جدول المكونات» (the inspector no longer enters them).
  const [componentLines, setComponentLines] = useState<BuildingInventoryLineDto[] | null>(null);
  useEffect(() => {
    const config = workOrdersApiConfig();
    if (!config || !poNumber || !property.id) return;
    let cancelled = false;
    void getBuildingInventory(config, poNumber, property.id).then((res) => {
      if (!cancelled && res.ok) setComponentLines(res.data.lines);
    });
    return () => {
      cancelled = true;
    };
  }, [poNumber, property.id]);

  const model = useMemo(
    () =>
      buildInfathUploadModel({
        record,
        property,
        parties: parties ?? null,
        documentSections,
        opsContext,
        componentLines,
      }),
    [record, property, parties, documentSections, opsContext, componentLines],
  );

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    () => new Set(),
  );
  const [copiedKeys, setCopiedKeys] = useState<Set<CopyKey>>(() => new Set());
  const { showToast } = useToast();
  const initializedCollapseRef = useRef(false);

  useEffect(() => {
    if (initializedCollapseRef.current) return;
    initializedCollapseRef.current = true;
    setCollapsedSections(initialCollapsedSectionIds(model.sections));
  }, [model.sections]);

  const markCopied = useCallback(
    (key: CopyKey, text: string) => {
      setCopiedKeys((prev) => withCopiedKey(prev, key));
      showToast(`تم النسخ: ${copyToastPreview(text)}`);
    },
    [showToast],
  );

  const handleCopyField = useCallback(
    async (key: CopyKey, text: string) => {
      const copied = await copyInfathText(text);
      if (copied) markCopied(key, text);
      else showToast("تعذّر نسخ النص — حاول يدوياً", "error");
    },
    [markCopied, showToast],
  );

  const handleCopyArea = useCallback(
    async (key: CopyKey, text: string) => {
      const copied = await copyInfathText(text);
      if (copied) markCopied(key, text);
      else showToast("تعذّر نسخ النص — حاول يدوياً", "error");
    },
    [markCopied, showToast],
  );

  const handleDownloadFile = useCallback(
    (fileName: string) => {
      const doc = findInfathDocumentByName(
        model.attachments,
        documentSections,
        fileName,
      );
      if (doc?.dataUrl) {
        downloadInfathDocument(doc);
        showToast(`جارٍ تحميل: ${fileName}`);
      } else {
        showToast(`لا يتوفر ملف للتحميل: ${fileName}`);
      }
    },
    [documentSections, model.attachments, showToast],
  );

  const handleDownloadAttachment = useCallback(
    (item: InfathUploadAttachment) => {
      if (item.document?.dataUrl) {
        downloadInfathDocument(item.document);
        showToast(`جارٍ تحميل: ${item.name}`);
      } else {
        showToast(`غير متوفر: ${item.name}`);
      }
    },
    [showToast],
  );

  const handleDownloadAll = useCallback(() => {
    const ready = readyAttachments(model.attachments);
    if (ready.length === 0) {
      showToast("لا توجد مرفقات جاهزة للتحميل");
      return;
    }
    for (const item of ready) {
      downloadInfathDocument(item.document);
    }
    showToast(`جارٍ تحميل كل المرفقات…`);
  }, [model.attachments, showToast]);

  const setAllCollapsed = useCallback(
    (collapse: boolean) => {
      setCollapsedSections(collapsedSectionIds(model.sections, collapse));
    },
    [model.sections],
  );

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => toggledSet(prev, sectionId));
  }, []);

  return {
    model,
    collapsedSections,
    copiedKeys,
    toggleSection,
    setAllCollapsed,
    handleCopyField,
    handleCopyArea,
    handleDownloadFile,
    handleDownloadAttachment,
    handleDownloadAll,
  };
}
