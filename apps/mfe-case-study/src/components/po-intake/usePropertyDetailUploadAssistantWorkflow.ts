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
  saveInfathBlob,
  type InfathOpsContext,
  type InfathReportContext,
} from "../../lib/app-data/infath-upload-model";
import type { CaseStudyReportDeeds } from "../../lib/app-data/case-study-report-document-model";
import type { WorkflowTask } from "../../lib/app-data/tasks";
import {
  renderCaseStudyReportPdf,
  useInfathCaseStudyReportDraft,
  useInfathStoredFiles,
} from "./useInfathUploadFiles";
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
  attachmentReady,
  collapsedSectionIds,
  copyToastPreview,
  courtVisitOpsFields,
  documentHasFile,
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
  /** Attachment rows whose file is being fetched or printed. */
  downloadingIds: ReadonlySet<string>;
};

/**
 * The certified appraiser's name, license number and license date for the Infath upload sheet.
 *
 * How it works: reads the organization settings once on mount and maps `evaluator.name`, `evaluator.licenseNumber`
 * and the license date to `InfathReportContext`; it is `null` until the read succeeds (and when it fails).
 *
 * Edge cases and how they were fixed: the appraiser used to type these into his package, and the new evaluator
 * screens have no such fields, so the sheet showed them empty. The date falls back to the company's practice-license
 * date because the organization has no personal license date for the appraiser, and that is the date the printed
 * report carries. An unmounted component ignores a late response.
 */
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

/**
 * The generated final report (report + deposit code + certificate page) as a downloadable document entry.
 *
 * How it works: when the report draft says the final PDF is `ready`, it downloads the PDF for the valuation
 * request, turns it into a data URL and exposes it as a document typed `valuation-report` named
 * `final-report-v{version}.pdf`; `buildInfathUploadModel` then treats it as «مرفق التقييم المعتمد».
 *
 * Edge cases: while the PDF is `none` or still `preparing` (it takes seconds, up to a minute under load) the hook
 * returns `null`, cleared during render so a stale document is never shown for another request. A failed
 * download leaves `null` (the sheet row stays «غير متوفر»). A response that arrives after the request or the
 * version changed is discarded.
 */
function useFinalReportDocument(
  valuationRequestId: string | null | undefined,
  finalReportStatus: string | undefined,
  version: number | undefined,
): PropertyDetailDocumentEntry | null {
  const [document, setDocument] = useState<PropertyDetailDocumentEntry | null>(null);
  // Not ready (or no request): no document — cleared during render, before the effect would run.
  const readyRequestId = finalReportStatus === "ready" ? (valuationRequestId ?? "") : "";
  const [documentFor, setDocumentFor] = useState(readyRequestId);
  if (documentFor !== readyRequestId) {
    setDocumentFor(readyRequestId);
    if (!readyRequestId) setDocument(null);
  }
  useEffect(() => {
    if (!valuationRequestId || finalReportStatus !== "ready") return;
    const config = apiConfig();
    if (!config) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no API session: the report cannot be downloaded, so none is shown; the fetch path sets it in its callback
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
  studyTask,
  reportDeeds,
  hasSurveyTask,
}: {
  record: PoIntakeRecord;
  property: PoPropertyIntake;
  parties: PropertyDetailPartySubmissionsMap | null | undefined;
  documentSections: PropertyDetailDocumentSection[];
  /** The task that holds the transaction's case-study report (the holder deed's, for linked deeds). */
  studyTask: WorkflowTask | null;
  /** The transaction's deeds as the report prints them (several deeds only). */
  reportDeeds?: CaseStudyReportDeeds;
  /** The transaction has a survey task — without one the survey row says «لا يوجد رفع مساحي». */
  hasSurveyTask: boolean;
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

  const { data: storedFiles } = useInfathStoredFiles({
    poNumber,
    propertyId: property.id,
    reportVersion: reportDraft?.version,
  });
  const { data: caseStudyDraft } = useInfathCaseStudyReportDraft(studyTask?.id);
  const caseStudyReportIssued = caseStudyDraft?.status === "issued";

  const attachmentSources = useMemo(
    () => ({
      caseStudyReportIssued,
      hasSurveyTask,
      depositCertificate: storedFiles?.depositCertificate ?? null,
      keysProof: storedFiles?.keysProof ?? null,
    }),
    [caseStudyReportIssued, hasSurveyTask, storedFiles],
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
        attachmentSources,
      }),
    [record, property, parties, sectionsWithFinalReport, opsContext, componentLines, reportContext, attachmentSources],
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

  /**
   * Marks a field as copied to Infath after a successful clipboard write.
   *
   * How it works: adds `key` to `copiedKeys` (the row's lasting tint, «already moved to
   * Infath»), sets `flashKey = key` (the button's check), restarts one shared timer that clears
   * `flashKey` after `COPIED_FLASH_MS`, and toasts a preview of the copied text.
   *
   * Edge cases (Omar, 2026-10-20: a check that never went away read as a stuck state):
   * - The timer clears the flash only if `key` is still the flashing one, so a quick second
   *   copy keeps its own check for the full 2 s.
   * - The timer is cleared on unmount (effect above), so no state update lands after leaving.
   */
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

  const [downloadingIds, setDownloadingIds] = useState<ReadonlySet<string>>(() => new Set());
  // The rows in flight, read synchronously so a double click cannot start a second download.
  const inFlightRef = useRef<Set<string>>(new Set());

  /**
   * Downloads one attachment row; resolves to whether a file was saved.
   *
   * How it works: the case-study report is printed to PDF by the server from the issued report; every other row
   * downloads its stored file (or the generated bytes of the final report). The row's button spins meanwhile.
   *
   * Edge cases and how they were fixed: rows used to download only bytes already in this browser, so most rows
   * could not be downloaded on another device; and the case-study report had no file at all. A second click while
   * the same row is still downloading is ignored. A failure says why («خدمة إنشاء ملفات PDF غير متاحة…» etc.).
   */
  const downloadAttachment = useCallback(
    async (item: InfathUploadAttachment, quiet = false): Promise<boolean> => {
      if (!attachmentReady(item)) {
        if (!quiet) showToast(`غير متوفر: ${item.name}`);
        return false;
      }
      if (inFlightRef.current.has(item.id)) return false;
      inFlightRef.current.add(item.id);
      setDownloadingIds(new Set(inFlightRef.current));
      try {
        if (item.id === "case-study") {
          if (!caseStudyDraft || !studyTask) {
            showToast("تقرير دراسة الحالة غير جاهز بعد.", "error");
            return false;
          }
          if (!quiet) showToast("جارٍ إنشاء ملف تقرير دراسة الحالة…");
          const res = await renderCaseStudyReportPdf({
            draft: caseStudyDraft,
            property,
            task: studyTask,
            record,
            deeds: reportDeeds,
          });
          if (!res.ok) {
            showToast(res.message, "error");
            return false;
          }
          saveInfathBlob(res.blob, item.document?.fileName || "تقرير دراسة الحالة.pdf");
          return true;
        }
        if (!quiet) showToast(`جارٍ تحميل: ${item.name}`);
        const saved = await downloadInfathDocument(item.document);
        if (!saved) showToast(`تعذّر تحميل: ${item.name}`, "error");
        return saved;
      } finally {
        inFlightRef.current.delete(item.id);
        setDownloadingIds(new Set(inFlightRef.current));
      }
    },
    [caseStudyDraft, studyTask, property, record, reportDeeds, showToast],
  );

  /**
   * Downloads the file behind a file field of a section (e.g. «مرفق التقييم المعتمد»).
   *
   * How it works: finds the document by its name among the attachment rows, then the property's documents; a
   * document that is an attachment row goes through that row (so the case-study report is printed and the
   * button spins), any other downloads its stored file.
   *
   * Edge cases and how they were fixed: these buttons used to need bytes already in this browser, so a file
   * stored on the server said «لا يتوفر ملف للتحميل».
   */
  const handleDownloadFile = useCallback(
    (fileName: string) => {
      const doc = findInfathDocumentByName(
        model.attachments,
        sectionsWithFinalReport,
        fileName,
      );
      const row = doc ? model.attachments.find((a) => a.document === doc) : undefined;
      if (row) {
        void downloadAttachment(row);
        return;
      }
      if (!documentHasFile(doc)) {
        showToast(`لا يتوفر ملف للتحميل: ${fileName}`);
        return;
      }
      showToast(`جارٍ تحميل: ${fileName}`);
      void downloadInfathDocument(doc).then((saved) => {
        if (!saved) showToast(`تعذّر تحميل: ${fileName}`, "error");
      });
    },
    [sectionsWithFinalReport, model.attachments, showToast, downloadAttachment],
  );

  const handleDownloadAttachment = useCallback(
    (item: InfathUploadAttachment) => {
      void downloadAttachment(item);
    },
    [downloadAttachment],
  );

  /** Downloads every ready row one after another (browsers block a burst of simultaneous downloads). */
  const handleDownloadAll = useCallback(() => {
    const ready = readyAttachments(model.attachments);
    if (ready.length === 0) {
      showToast("لا توجد مرفقات جاهزة للتحميل");
      return;
    }
    showToast(`جارٍ تحميل كل المرفقات…`);
    void (async () => {
      for (const item of ready) {
        await downloadAttachment(item, true);
      }
    })();
  }, [model.attachments, showToast, downloadAttachment]);

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
    downloadingIds,
  };
}
