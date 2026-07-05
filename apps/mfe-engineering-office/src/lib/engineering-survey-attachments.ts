import {
  clearTaskScopedAttachments,
  getCachedTaskAttachment,
  openTaskAttachmentPreview,
  prefetchTaskAttachment,
  uploadTaskScopedAttachment,
  type TaskAttachmentPreview,
} from "@platform/app-shared/prototype/task-attachments-api";
import { getCachedPartySubmission } from "@platform/app-shared/prototype/party-submission-api";
import { persistPartySubmissionPayload } from "@platform/app-shared/prototype/party-submission-api";
import { dispatchPartySubmissionChanged } from "@platform/app-shared/prototype/party-submission-changed-event";
import { ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT } from "./engineering-survey-submission-storage";
import { loadEngineeringSurveySubmission } from "./engineering-survey-submission-storage";

export type CachedEngineeringSurveyFile = {
  fileName: string;
  mimeType: string;
  dataUrl?: string;
  sizeBytes?: number;
  attachmentId?: string;
};

export type EngineeringSurveyDocField = "surveyReport" | "siteLetter";

const MAX_SURVEY_REPORT_BYTES = 20 * 1024 * 1024;
const MAX_SITE_LETTER_BYTES = 10 * 1024 * 1024;

const FIELD_META: Record<
  EngineeringSurveyDocField,
  {
    fileNameKey: "surveyReportFileName" | "siteLetterFileName";
    attachmentKey: "surveyReportAttachment" | "siteLetterAttachment";
    scope: string;
    maxBytes: number;
    title: string;
  }
> = {
  surveyReport: {
    fileNameKey: "surveyReportFileName",
    attachmentKey: "surveyReportAttachment",
    scope: "engineering-survey-report",
    maxBytes: MAX_SURVEY_REPORT_BYTES,
    title: "تقرير الرفع المساحي",
  },
  siteLetter: {
    fileNameKey: "siteLetterFileName",
    attachmentKey: "siteLetterAttachment",
    scope: "engineering-site-letter",
    maxBytes: MAX_SITE_LETTER_BYTES,
    title: "خطاب إقرار صحة الموقع",
  },
};

function notifyChanged(): void {
  dispatchPartySubmissionChanged(ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT);
}

function attachmentFromPayload(
  payload: Record<string, unknown>,
  field: EngineeringSurveyDocField,
): CachedEngineeringSurveyFile | null {
  const { attachmentKey, fileNameKey } = FIELD_META[field];
  const raw = payload[attachmentKey];
  if (raw && typeof raw === "object" && "fileName" in raw) {
    const att = raw as CachedEngineeringSurveyFile;
    if (att.fileName?.trim()) return att;
  }
  const fileName = String(payload[fileNameKey] ?? "").trim();
  if (!fileName) return null;
  return { fileName, mimeType: "application/pdf" };
}

export function getEngineeringSurveyAttachment(
  taskId: string,
  field: EngineeringSurveyDocField,
): CachedEngineeringSurveyFile | null {
  if (!taskId) return null;

  const scope = FIELD_META[field].scope;
  const cached = getCachedTaskAttachment(scope, taskId);
  if (cached?.fileName) return cached;

  const dto = getCachedPartySubmission(taskId);
  if (dto?.payload) {
    return attachmentFromPayload(dto.payload, field);
  }
  const sub = loadEngineeringSurveySubmission(taskId);
  if (!sub) return null;
  const fileName = sub[FIELD_META[field].fileNameKey].trim();
  if (!fileName) return null;
  return { fileName, mimeType: "application/pdf" };
}

export async function prefetchEngineeringSurveyAttachment(
  taskId: string,
  field: EngineeringSurveyDocField,
): Promise<CachedEngineeringSurveyFile | null> {
  if (!taskId) return null;
  return prefetchTaskAttachment(FIELD_META[field].scope, taskId);
}

export type EngineeringSurveyDocumentEntry = {
  id: string;
  field: EngineeringSurveyDocField;
  name: string;
  sub: string;
  attachment: CachedEngineeringSurveyFile;
};

export function listEngineeringSurveyDocuments(
  taskId: string | null | undefined,
): EngineeringSurveyDocumentEntry[] {
  if (!taskId) return [];
  const entries: EngineeringSurveyDocumentEntry[] = [];
  for (const field of ["surveyReport", "siteLetter"] as const) {
    const attachment = getEngineeringSurveyAttachment(taskId, field);
    if (!attachment?.fileName.trim()) continue;
    entries.push({
      id: `eng-${field}`,
      field,
      name: FIELD_META[field].title,
      sub: attachment.fileName.trim(),
      attachment,
    });
  }
  return entries;
}

export async function cacheEngineeringSurveyFile(
  taskId: string,
  field: EngineeringSurveyDocField,
  file: File,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!taskId) return { ok: false, error: "تعذّر حفظ الملف." };
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return { ok: false, error: "يُقبل ملف PDF فقط." };
  }

  const meta = FIELD_META[field];
  if (file.size > meta.maxBytes) {
    return {
      ok: false,
      error:
        field === "surveyReport"
          ? "الحجم الأقصى 20 ميجابايت."
          : "الحجم الأقصى 10 ميجابايت.",
    };
  }

  const current = loadEngineeringSurveySubmission(taskId);
  if (!current || current.status === "submitted") {
    return { ok: false, error: "لا يمكن تعديل الرفع بعد الإرسال." };
  }

  const uploaded = await uploadTaskScopedAttachment(meta.scope, taskId, file);
  if (!uploaded) return { ok: false, error: "تعذّر حفظ الملف." };

  const attachment: CachedEngineeringSurveyFile = {
    fileName: uploaded.fileName,
    mimeType: uploaded.mimeType,
    sizeBytes: uploaded.sizeBytes,
    attachmentId: uploaded.attachmentId,
  };

  const dto = getCachedPartySubmission(taskId);
  const payload: Record<string, unknown> = {
    ...(dto?.payload ?? {}),
    ...current,
    [meta.fileNameKey]: file.name,
    [meta.attachmentKey]: attachment,
    updatedAtUtc: new Date().toISOString(),
  };
  const saved = await persistPartySubmissionPayload(taskId, payload);
  if (!saved) return { ok: false, error: "تعذّر حفظ الملف." };
  notifyChanged();
  return { ok: true };
}

export async function clearEngineeringSurveyFile(
  taskId: string,
  field: EngineeringSurveyDocField,
): Promise<boolean> {
  if (!taskId) return false;
  const current = loadEngineeringSurveySubmission(taskId);
  if (!current || current.status === "submitted") return false;

  const meta = FIELD_META[field];
  await clearTaskScopedAttachments(meta.scope, taskId);

  const dto = getCachedPartySubmission(taskId);
  const payload: Record<string, unknown> = {
    ...(dto?.payload ?? {}),
    ...current,
    [meta.fileNameKey]: "",
    updatedAtUtc: new Date().toISOString(),
  };
  delete payload[meta.attachmentKey];
  const saved = await persistPartySubmissionPayload(taskId, payload);
  if (!saved) return false;
  notifyChanged();
  return true;
}

export function openEngineeringSurveyDocumentPreview(
  attachment: CachedEngineeringSurveyFile,
): void {
  if (!attachment.dataUrl) return;
  openTaskAttachmentPreview(attachment as TaskAttachmentPreview);
}

export function downloadEngineeringSurveyDocument(
  attachment: CachedEngineeringSurveyFile,
): void {
  if (!attachment.dataUrl) return;
  const link = document.createElement("a");
  link.href = attachment.dataUrl;
  link.download = attachment.fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
