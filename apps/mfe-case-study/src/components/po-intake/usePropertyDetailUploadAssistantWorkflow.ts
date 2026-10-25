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
  type InfathReportContext,
} from "../../lib/app-data/infath-upload-model";
import type {
  InfathUploadAttachment,
  InfathUploadModel,
} from "../../lib/app-data/infath-upload-types";
import type {
  PropertyDetailDocumentEntry,
  PropertyDetailDocumentSection,
} from "../../lib/app-data/property-detail-documents";
import type { PropertyDetailPartySubmissionsMap } from "../../lib/app-data/property-detail-party-submissions";
import {
  formatPropertyDeedDisplay,
  type PoIntakeRecord,
  type PoPropertyIntake,
} from "../../lib/app-data/po-intake-data";
import { usePropertyOperationsTasks } from "../../query/use-property-operations-tasks";
import {
  downloadFinalReport,
  getBuildingInventory,
  getOrganizationSettings,
  type BuildingInventoryLineDto,
} from "@platform/api-client";
import { apiConfig } from "@platform/app-shared/auth/api-config";
import { blobToDataUrl } from "@platform/app-shared/media/file-encoding";
import { workOrdersApiConfig } from "../../lib/work-orders-api-config";
import {
  resolveEnvelopeIdFromSources,
  usePropertyKeyGateQuery,
} from "../../query/use-property-key-gate-query";
import { usePropertyReportDraftQuery } from "../../query/use-property-report-draft-query";
import {
  COPIED_FLASH_MS,
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

type PropertyDetailEnfathUploadWorkflow = {
  model: InfathUploadModel;
  collapsedSections: Set<string>;
  /** Every key copied in this visit — the rows keep their tint as a progress marker. */
  copiedKeys: Set<CopyKey>;
  /** The key copied within the last `COPIED_FLASH_MS` — only its button shows the check. */
  flashKey: CopyKey | null;
  toggleSection: (sectionId: string) => void;
  setAllCollapsed: (collapse: boolean) => void;
  handleCopyField: (key: CopyKey, text: string) => Promise<void>;
  handleCopyArea: (key: CopyKey, text: string) => Promise<void>;
  handleDownloadFile: (fileName: string) => void;
  handleDownloadAttachment: (item: InfathUploadAttachment) => void;
  handleDownloadAll: () => void;
};

/** The certified appraiser's identity — the one the printed report carries (organization settings). */
function useReportContext(): InfathReportContext | null {
  const [context, setContext] = useState<InfathReportContext | null>(null);
  useEffect(() => {
    const config = apiConfig();
    if (!config) return;
    let cancelled = false;
    void getOrganizationSettings(config).then((settings) => {
      if (cancelled || !settings.ok) return;
      const { evaluator, company } = settings.data;
      setContext({
        appraiserName: evaluator?.name?.trim() ?? "",
        appraiserLicenseNumber: evaluator?.licenseNumber?.trim() ?? "",
        // The report prints the practice-license date when the appraiser has none of his own.
        appraiserLicenseDate:
          evaluator?.licenseIssuedAt?.trim() || company?.practiceLicenseIssuedAt?.trim() || "",
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return context;
}

/** The generated final report as a downloadable document, once the server has it ready. */
function useFinalReportDocument(
  valuationRequestId: string | null | undefined,
  finalReportStatus: string | undefined,
  version: number | undefined,
): PropertyDetailDocumentEntry | null {
  const [document, setDocument] = useState<PropertyDetailDocumentEntry | null>(null);
  useEffect(() => {
    const config = apiConfig();
    if (!config || !valuationRequestId || finalReportStatus !== "ready") {
      setDocument(null);
      return;
    }
    let cancelled = false;
    void downloadFinalReport(config, valuationRequestId).then(async (res) => {
      if (cancelled || !res.ok) return;
      const dataUrl = await blobToDataUrl(res.data);
      if (cancelled) return;
      setDocument({
        id: `final-report-${valuationRequestId}`,
        name: "تقرير التقييم النهائي",
        fileName: `final-report-v${version ?? 1}.pdf`,
        source: "المقيّم العقاري",
        kind: "pdf",
        dataUrl,
        documentTypeKey: "valuation-report",
      });
    });
    return () => {
      cancelled = true;
    };
  }, [valuationRequestId, finalReportStatus, version]);
  return document;
}

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

  const reportContext = useReportContext();
  const finalReportDocument = useFinalReportDocument(
    reportDraft?.valuationRequestId,
    reportDraft?.finalReportStatus,
    reportDraft?.version,
  );
  // The generated final report is the «مرفق التقييم المعتمد»: it joins the property documents as the valuation report.
  const sectionsWithFinalReport = useMemo(
    () =>
      finalReportDocument
        ? [...documentSections, { id: "final-report", title: "التقرير النهائي", documents: [finalReportDocument] }]
        : documentSections,
    [documentSections, finalReportDocument],
  );

  const model = useMemo(
    () =>
      buildInfathUploadModel({
        record,
        property,
        parties: parties ?? null,
        documentSections: sectionsWithFinalReport,
        opsContext,
        componentLines,
        reportContext,
      }),
    [record, property, parties, sectionsWithFinalReport, opsContext, componentLines, reportContext],
  );

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    () => new Set(),
  );
  const [copiedKeys, setCopiedKeys] = useState<Set<CopyKey>>(() => new Set());
  const [flashKey, setFlashKey] = useState<CopyKey | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { showToast } = useToast();
  const initializedCollapseRef = useRef(false);

  useEffect(() => {
    if (initializedCollapseRef.current) return;
    initializedCollapseRef.current = true;
    setCollapsedSections(initialCollapsedSectionIds(model.sections));
  }, [model.sections]);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const markCopied = useCallback(
    (key: CopyKey, text: string) => {
      setCopiedKeys((prev) => withCopiedKey(prev, key));
      setFlashKey(key);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => {
        flashTimer.current = null;
        setFlashKey((current) => (current === key ? null : current));
      }, COPIED_FLASH_MS);
      showToast(`تم النسخ: ${copyToastPreview(text)}`);
    },
    [showToast],
  );

  const handleCopyField = useCallback(
    async (key: CopyKey, text: string) => {
      const copied = await copyInfathText(text);
      if (copied) markCopied(key, text);
      else showToast("تعذّر النسخ — حاول يدوياً", "error");
    },
    [markCopied, showToast],
  );

  const handleCopyArea = useCallback(
    async (key: CopyKey, text: string) => {
      const copied = await copyInfathText(text);
      if (copied) markCopied(key, text);
      else showToast("تعذّر النسخ — حاول يدوياً", "error");
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
    flashKey,
    toggleSection,
    setAllCollapsed,
    handleCopyField,
    handleCopyArea,
    handleDownloadFile,
    handleDownloadAttachment,
    handleDownloadAll,
  };
}
