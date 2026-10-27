"use client";

/**
 * Files of the Enfaz upload sheet that do not come from the property's documents list: the issued case-study
 * report (printed to PDF on download), the deposit certificate and the keys handover proof.
 */
import { useQuery } from "@tanstack/react-query";
import {
  listAttachmentsForProperty,
  renderPrintPdf,
  type FileAttachmentMetaDto,
} from "@platform/api-client";
import { apiConfig } from "@platform/app-shared/auth/api-config";
import { prototypeModulesApiConfig } from "@platform/app-shared/app-data/modules-api-config";
import { inlinePrintHtmlAssets } from "@platform/app-shared/media/inline-print-assets";
import { ensureOrganizationSettingsLoaded } from "@platform/app-shared/organization/organization-settings-cache";
import {
  buildCaseStudyReportModel,
  type CaseStudyReportDeeds,
} from "../../lib/app-data/case-study-report-document-model";
import { buildCaseStudyReportPrintHtml } from "../../lib/app-data/case-study-report-html";
import type { CaseStudyReportDraft } from "../../lib/app-data/case-study-report-model";
import { loadCaseStudyReportDraft } from "../../lib/app-data/case-study-report-reads";
import type { PoIntakeRecord, PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import type { PropertyDetailDocumentEntry } from "../../lib/app-data/property-detail-documents";
import type { WorkflowTask } from "../../lib/app-data/tasks";

/** Where the valuation service keeps the deposit certificate (key `{propertyId}:deposit:v{n}`). */
const DEPOSIT_CERTIFICATE_SCOPE = "evaluator-deposit-certificate";
/** Where the keys handover proof is uploaded (key `{poNumber}:{propertyId}`). */
const KEYS_PROOF_SCOPE = "government-keys-proof";

function entryFromMeta(meta: FileAttachmentMetaDto, name: string, source: string): PropertyDetailDocumentEntry {
  const pdf = meta.contentType === "application/pdf" || /\.pdf$/i.test(meta.fileName);
  return {
    id: meta.id,
    name,
    fileName: meta.fileName,
    source,
    kind: pdf ? "pdf" : meta.contentType.startsWith("image/") ? "image" : "file",
    attachmentId: meta.id,
  };
}

function newestFirst(a: FileAttachmentMetaDto, b: FileAttachmentMetaDto): number {
  return b.createdAtUtc.localeCompare(a.createdAtUtc);
}

/**
 * The stored deposit certificate and keys proof of a property, as downloadable document entries.
 *
 * How it works: lists the attachments whose key starts with the property id (the certificate, one per report
 * cycle) and those under `{poNumber}:{propertyId}` (the keys proof), then keeps the certificate of the current
 * cycle — or the newest one when no cycle matches — and the newest keys proof.
 *
 * Edge cases and how they were fixed: the upload sheet only knew the certificate's file name, so its row had no
 * file and the download never worked. A read that fails leaves both `null` (the rows say «غير متوفر») instead of
 * blocking the sheet.
 */
export function useInfathStoredFiles(input: {
  poNumber: string;
  propertyId: string;
  /** The report cycle whose certificate is wanted (1 before any reopen). */
  reportVersion: number | undefined;
}) {
  const { poNumber, propertyId, reportVersion } = input;
  return useQuery({
    queryKey: ["infath-upload-stored-files", poNumber, propertyId, reportVersion ?? 0],
    enabled: Boolean(propertyId.trim()),
    staleTime: 15_000,
    queryFn: async (): Promise<{
      depositCertificate: PropertyDetailDocumentEntry | null;
      keysProof: PropertyDetailDocumentEntry | null;
    }> => {
      const config = prototypeModulesApiConfig();
      if (!config) return { depositCertificate: null, keysProof: null };
      const poKey = poNumber.trim() ? `${poNumber.trim()}:${propertyId}` : "";
      const [byProperty, byPo] = await Promise.all([
        listAttachmentsForProperty(config, propertyId),
        poKey ? listAttachmentsForProperty(config, poKey) : Promise.resolve(null),
      ]);

      const certificates = (byProperty.ok ? byProperty.data : [])
        .filter((m) => m.scope === DEPOSIT_CERTIFICATE_SCOPE)
        .sort(newestFirst);
      const currentKey = `${propertyId}:deposit:v${reportVersion ?? 1}`;
      const certificate = certificates.find((m) => m.scopeKey === currentKey) ?? certificates[0] ?? null;

      const proof =
        (byPo?.ok ? byPo.data : [])
          .filter((m) => m.scope === KEYS_PROOF_SCOPE && m.scopeKey === poKey)
          .sort(newestFirst)[0] ?? null;

      return {
        depositCertificate: certificate ? entryFromMeta(certificate, "شهادة إيداع التقرير", "المقيّم العقاري") : null,
        keysProof: proof ? entryFromMeta(proof, "إثبات استلام المفتاح", "المراجع الحكومي") : null,
      };
    },
  });
}

/**
 * The case-study report of the transaction (the study lives on the holder deed's task), or null before one
 * was started. Its `status` tells the sheet whether the report is issued.
 */
export function useInfathCaseStudyReportDraft(studyTaskId: string | null | undefined) {
  const id = (studyTaskId ?? "").trim();
  return useQuery({
    queryKey: ["infath-upload-case-study-report", id],
    enabled: id.length > 0,
    staleTime: 15_000,
    queryFn: (): Promise<CaseStudyReportDraft | null> => loadCaseStudyReportDraft(id),
  });
}

export type CaseStudyReportPdfResult = { ok: true; blob: Blob } | { ok: false; message: string };

/**
 * Prints the issued case-study report to a PDF file — the same page as «تحميل التقرير» in the report tab.
 *
 * How it works: builds the report page from the draft (with the organization's letterhead loaded first),
 * embeds its images and the Google Fonts sheet with its fonts as data URLs, and sends it to the server
 * renderer (`/api/print-pdf`), which prints it on A4 once the page has laid out its sheets.
 *
 * Edge cases: the server renderer has no network, so anything not embedded would be missing from the PDF; a font
 * that cannot be fetched falls back to the next font of the page. A refusal returns the server's Arabic reason
 * (e.g. the renderer is down) so the sheet can show it.
 */
export async function renderCaseStudyReportPdf(input: {
  draft: CaseStudyReportDraft;
  property: PoPropertyIntake;
  task: WorkflowTask;
  record: PoIntakeRecord;
  deeds?: CaseStudyReportDeeds;
}): Promise<CaseStudyReportPdfResult> {
  const config = apiConfig();
  if (!config) return { ok: false, message: "انتهت الجلسة — سجّل الدخول من جديد." };
  await ensureOrganizationSettingsLoaded();
  const model = buildCaseStudyReportModel(input.draft, input.property, input.task, input.record, undefined, input.deeds);
  const html = buildCaseStudyReportPrintHtml(model, { origin: window.location.origin, embedded: true });
  const selfContained = await inlinePrintHtmlAssets(html, {
    token: config.token,
    // An empty base means the API is on this origin: let the inliner fall back to it so API images get the token.
    apiBase: config.baseUrl || undefined,
    inlineStylesheets: true,
  });
  const res = await renderPrintPdf(config, selfContained);
  if (res.ok) return { ok: true, blob: res.data };
  return {
    ok: false,
    message: res.message?.trim() || "تعذّر إنشاء ملف تقرير دراسة الحالة — حاول مرة أخرى.",
  };
}
