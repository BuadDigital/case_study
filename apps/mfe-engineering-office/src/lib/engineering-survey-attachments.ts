import {
  clearTaskScopedAttachments,
  downloadTaskAttachmentAsync,
  ensureTaskAttachmentPreview,
  getCachedTaskAttachment,
  openTaskAttachmentPreviewAsync,
  prefetchTaskAttachment,
  uploadTaskScopedAttachment,
  type TaskAttachmentPreview,
} from "@platform/app-shared/app-data/task-attachments-api";
import { getCachedPartySubmission } from "@platform/app-shared/app-data/party-submission-api";
import { persistPartySubmissionPayload } from "@platform/app-shared/app-data/party-submission-api";
import { dispatchPartySubmissionChanged } from "@platform/app-shared/app-data/party-submission-changed-event";
import {
  ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT,
  loadEngineeringSurveySubmission,
} from "./engineering-survey-submission-model";

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

function stripDataUrl(file: CachedEngineeringSurveyFile): CachedEngineeringSurveyFile {
  return {
    fileName: file.fileName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    attachmentId: file.attachmentId,
  };
}

function attachmentFromPayload(
  payload: Record<string, unknown>,
  field: EngineeringSurveyDocField,
): CachedEngineeringSurveyFile | null {
  const { attachmentKey, fileNameKey } = FIELD_META[field];
  const raw = payload[attachmentKey];
  if (raw && typeof raw === "object" && "fileName" in raw) {
    const att = raw as CachedEngineeringSurveyFile;
    if (att.fileName?.trim()) {
      return stripDataUrl({
        fileName: att.fileName,
        mimeType: att.mimeType || "application/pdf",
        sizeBytes: att.sizeBytes,
        attachmentId: att.attachmentId,
      });
    }
  }
  const fileName = String(payload[fileNameKey] ?? "").trim();
  if (!fileName) return null;
  return { fileName, mimeType: "application/pdf" };
}

function getEngineeringSurveyAttachment(
  taskId: string,
  field: EngineeringSurveyDocField,
): CachedEngineeringSurveyFile | null {
  if (!taskId) return null;

  const scope = FIELD_META[field].scope;
  const cached = getCachedTaskAttachment(scope, taskId);
  if (cached?.fileName) {
    return {
      fileName: cached.fileName,
      mimeType: cached.mimeType,
      dataUrl: cached.dataUrl,
      sizeBytes: cached.sizeBytes,
      attachmentId: cached.attachmentId,
    };
  }

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

async function prefetchEngineeringSurveyAttachment(
  taskId: string,
  field: EngineeringSurveyDocField,
): Promise<CachedEngineeringSurveyFile | null> {
  if (!taskId) return null;
  const meta = FIELD_META[field];
  const fromPayload = getEngineeringSurveyAttachment(taskId, field);
  if (fromPayload?.attachmentId) {
    const hydrated = await ensureTaskAttachmentPreview(
      fromPayload,
      meta.scope,
      taskId,
    );
    return hydrated ?? fromPayload;
  }
  return prefetchTaskAttachment(meta.scope, taskId);
}

export async function prefetchEngineeringSurveyDocuments(
  taskId: string | null | undefined,
): Promise<void> {
  if (!taskId) return;
  await Promise.all([
    prefetchEngineeringSurveyAttachment(taskId, "surveyReport"),
    prefetchEngineeringSurveyAttachment(taskId, "siteLetter"),
  ]);
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
  if (!uploaded?.attachmentId) {
    return { ok: false, error: "تعذّر حفظ الملف عبر خدمة المرفقات." };
  }

  // Persist metadata + attachmentId only — never dataUrl bytes in the payload.
  const attachment = stripDataUrl({
    fileName: uploaded.fileName,
    mimeType: uploaded.mimeType,
    sizeBytes: uploaded.sizeBytes,
    attachmentId: uploaded.attachmentId,
  });

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
  field?: EngineeringSurveyDocField,
  taskId?: string,
): void {
  const scope = field ? FIELD_META[field].scope : undefined;
  void openTaskAttachmentPreviewAsync(attachment as TaskAttachmentPreview, scope, taskId);
}

export function downloadEngineeringSurveyDocument(
  attachment: CachedEngineeringSurveyFile,
  field?: EngineeringSurveyDocField,
  taskId?: string,
): void {
  const scope = field ? FIELD_META[field].scope : undefined;
  void downloadTaskAttachmentAsync(attachment as TaskAttachmentPreview, scope, taskId);
}
