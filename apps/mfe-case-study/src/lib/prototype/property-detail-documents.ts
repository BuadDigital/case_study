import {
  listEngineeringSurveyDocuments,
  openEngineeringSurveyDocumentPreview,
  downloadEngineeringSurveyDocument,
  type EngineeringSurveyDocumentEntry,
} from "@engineering-office/mfe";
import { getCachedEvaluatorReport } from "@evaluator/mfe";
import {
  getCachedPropertyDocMatching,
  isImageMime,
} from "./assignment-doc-attachments";
import type { PoPropertyIntake } from "./po-intake-data";
import {
  INSPECTOR_FEATURE_FIELDS,
  listServiceAmenityPhotoSlots,
  type InspectorWorkspaceDraft,
} from "./inspector-workspace-data";
import { getInspectorPhotoDataUrl } from "./inspector-photo-upload";
import { loadInspectorWorkspace } from "./inspector-workspace-storage";

const FEATURE_FIELD_LABEL_BY_KEY = Object.fromEntries(
  INSPECTOR_FEATURE_FIELDS.map((field) => [field.key, field.label]),
) as Record<string, string>;

const COMPONENT_PHOTO_LABEL_BY_KEY: Record<string, string> = {
  showroom: "صورة المعرض",
  well: "صورة البئر",
};

/** Arabic label for inspector feature photo keys (never show camelCase keys in UI). */
export function inspectorFeaturePhotoLabel(key: string): string {
  const known = FEATURE_FIELD_LABEL_BY_KEY[key]?.trim();
  if (known) return known;
  return key.trim() || "حقل";
}

export function inspectorComponentPhotoLabel(key: string): string {
  const known = COMPONENT_PHOTO_LABEL_BY_KEY[key]?.trim();
  if (known) return known;
  return key.trim() || "صورة مكوّن";
}

export type PropertyDetailDocumentEntry = {
  id: string;
  name: string;
  fileName: string;
  source: string;
  kind: "pdf" | "file" | "image";
  dataUrl?: string;
  attachmentId?: string;
  /** Engineering survey field — used to resolve blob via attachments API. */
  engineeringField?: "surveyReport" | "siteLetter";
  engineeringTaskId?: string;
};

function fileKind(fileName: string, mimeType?: string): "pdf" | "file" | "image" {
  if (mimeType && isImageMime(mimeType)) return "image";
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (/\.(jpe?g|png|gif|webp)$/i.test(lower)) return "image";
  return "file";
}

function pushEntry(
  list: PropertyDetailDocumentEntry[],
  entry: PropertyDetailDocumentEntry,
): void {
  if (!entry.fileName.trim()) return;
  if (list.some((d) => d.id === entry.id)) return;
  list.push(entry);
}

/** Real file only — exclude name-only rows that render as empty placeholders. */
export function isPropertyDetailDocumentAvailable(
  entry: PropertyDetailDocumentEntry,
): boolean {
  return Boolean(
    entry.dataUrl || entry.attachmentId || entry.engineeringTaskId,
  );
}

export function collectIntakeDocuments(input: {
  property: PoPropertyIntake;
  showDecree: boolean;
  poNumber: string;
}): PropertyDetailDocumentEntry[] {
  const { property, showDecree, poNumber } = input;
  const docs: PropertyDetailDocumentEntry[] = [];
  const source = "البيانات الأولية";

  if (property.realEstateRegFileName?.trim()) {
    const name = property.realEstateRegFileName.trim();
    const cached = getCachedPropertyDocMatching(
      "registry",
      poNumber,
      property.id,
      name,
    );
    pushEntry(docs, {
      id: "intake-reg",
      name: "السجل العقاري",
      fileName: name,
      source,
      kind: fileKind(name, cached?.mimeType),
      dataUrl: cached?.dataUrl,
      attachmentId: cached?.attachmentId,
    });
  }

  if (showDecree) {
    property.assignmentDocFileNames.forEach((fileName, index) => {
      const name = fileName.trim();
      if (!name) return;
      const cached = getCachedPropertyDocMatching(
        "decree",
        poNumber,
        property.id,
        name,
      );
      pushEntry(docs, {
        id: `intake-assignment-${index}-${name}`,
        name: property.assignmentDocFileNames.length > 1
          ? `قرار الإسناد (${index + 1})`
          : "قرار الإسناد",
        fileName: name,
        source,
        kind: fileKind(name, cached?.mimeType),
        dataUrl: cached?.dataUrl,
        attachmentId: cached?.attachmentId,
      });
    });
  }

  property.delegationLetterFileNames.forEach((fileName, index) => {
    const name = fileName.trim();
    if (!name) return;
    const cached = getCachedPropertyDocMatching(
      "delegation",
      poNumber,
      property.id,
      name,
    );
    pushEntry(docs, {
      id: `intake-delegation-${index}-${name}`,
      name: property.delegationLetterFileNames.length > 1
        ? `خطاب التفويض (${index + 1})`
        : "خطاب التفويض",
      fileName: name,
      source,
      kind: fileKind(name, cached?.mimeType),
      dataUrl: cached?.dataUrl,
      attachmentId: cached?.attachmentId,
    });
  });

  if (
    property.boundariesAvailability === "doc" &&
    property.boundariesExternalDocName?.trim()
  ) {
    const name = property.boundariesExternalDocName.trim();
    const cached = getCachedPropertyDocMatching(
      "boundaries",
      poNumber,
      property.id,
      name,
    );
    pushEntry(docs, {
      id: "intake-boundaries",
      name: "مستند الحدود",
      fileName: name,
      source,
      kind: fileKind(name, cached?.mimeType),
      dataUrl: cached?.dataUrl,
      attachmentId: cached?.attachmentId,
    });
  }

  property.otherDocumentFileNames.forEach((name, i) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const cached = getCachedPropertyDocMatching(
      "other",
      poNumber,
      property.id,
      trimmed,
    );
    pushEntry(docs, {
      id: `intake-other-${i}`,
      name: "مستند إضافي",
      fileName: trimmed,
      source,
      kind: fileKind(trimmed, cached?.mimeType),
      dataUrl: cached?.dataUrl,
      attachmentId: cached?.attachmentId,
    });
  });

  return docs;
}

function mapEngineeringDoc(
  doc: EngineeringSurveyDocumentEntry,
  surveyTaskId: string,
): PropertyDetailDocumentEntry {
  return {
    id: doc.id,
    name: doc.name,
    fileName: doc.sub,
    source: "المكتب الهندسي",
    kind: "pdf",
    dataUrl: doc.attachment.dataUrl,
    attachmentId: doc.attachment.attachmentId,
    engineeringField: doc.field,
    engineeringTaskId: surveyTaskId,
  };
}

export function collectEngineeringDocuments(
  surveyTaskId: string | null | undefined,
): PropertyDetailDocumentEntry[] {
  if (!surveyTaskId) return [];
  return listEngineeringSurveyDocuments(surveyTaskId).map((doc) =>
    mapEngineeringDoc(doc, surveyTaskId),
  );
}

export function collectAppraisalDocuments(
  appraisalTaskId: string | null | undefined,
): PropertyDetailDocumentEntry[] {
  if (!appraisalTaskId) return [];
  const cached = getCachedEvaluatorReport(appraisalTaskId);
  if (!cached?.fileName?.trim()) return [];
  return [
    {
      id: "appraisal-report",
      name: "تقرير التقييم",
      fileName: cached.fileName.trim(),
      source: "المقيّم العقاري",
      kind: "pdf",
      dataUrl: cached.dataUrl,
      attachmentId: cached.attachmentId,
    },
  ];
}

export function collectFieldInspectionDocuments(
  inspectionTaskId: string | null | undefined,
): PropertyDetailDocumentEntry[] {
  if (!inspectionTaskId) return [];
  const submission = loadInspectorWorkspace(inspectionTaskId);
  if (!submission) return [];
  return collectFieldInspectionDocumentsFromSubmission(submission);
}

export function collectFieldInspectionDocumentsFromSubmission(
  submission: InspectorWorkspaceDraft,
): PropertyDetailDocumentEntry[] {
  const docs: PropertyDetailDocumentEntry[] = [];
  const source = "المعاين الميداني";
  const taskId = submission.taskId;

  for (const def of listServiceAmenityPhotoSlots(submission)) {
    const slot = submission.definedPhotos[def.id];
    if (!slot || slot.none) continue;
    slot.photos
      .filter(
        (photo) =>
          photo.approved || submission.status === "submitted",
      )
      .forEach((photo, i) => {
        const photoRef = `slot:${def.id}:${photo.id}`;
        const kindLabel = def.kind === "service" ? "خدمة" : "مرفق";
        pushEntry(docs, {
          id: `inspection-photo-${def.id}-${photo.id}`,
          name:
            slot.photos.length > 1
              ? `${kindLabel}: ${def.label} ${i + 1}`
              : `${kindLabel}: ${def.label}`,
          fileName: photo.fileName,
          source,
          kind: fileKind(photo.fileName, photo.mimeType),
          dataUrl: getInspectorPhotoDataUrl(taskId, photoRef),
        });
      });
  }

  submission.freePhotos
    .filter(
      (photo) =>
        photo.approved || submission.status === "submitted",
    )
    .forEach((photo) => {
      const photoRef = `free:${photo.id}`;
      pushEntry(docs, {
        id: `inspection-free-${photo.id}`,
        name: photo.category?.trim() || "صورة إضافية",
        fileName: photo.fileName,
        source,
        kind: fileKind(photo.fileName, photo.mimeType),
        dataUrl: getInspectorPhotoDataUrl(taskId, photoRef),
      });
    });

  for (const [key, attachment] of Object.entries(
    submission.featurePhotoAttachments,
  )) {
    if (!attachment?.fileName) continue;
    const photoRef = `feature:${key}`;
    pushEntry(docs, {
      id: `inspection-feature-${key}`,
      name: `صورة توثيقية — ${inspectorFeaturePhotoLabel(key)}`,
      fileName: attachment.fileName,
      source,
      kind: fileKind(attachment.fileName, attachment.mimeType),
      dataUrl: getInspectorPhotoDataUrl(taskId, photoRef),
    });
  }

  for (const [key, attachment] of Object.entries(
    submission.componentPhotoAttachments,
  )) {
    if (!attachment?.fileName) continue;
    const photoRef = `component:${key}`;
    pushEntry(docs, {
      id: `inspection-component-${key}`,
      name: inspectorComponentPhotoLabel(key),
      fileName: attachment.fileName,
      source,
      kind: fileKind(attachment.fileName, attachment.mimeType),
      dataUrl: getInspectorPhotoDataUrl(taskId, photoRef),
    });
  }

  submission.observations.forEach((obs) => {
    if (!obs.photo?.fileName) return;
    const photoRef = `observation:${obs.id}`;
    pushEntry(docs, {
      id: `inspection-observation-${obs.id}`,
      name: obs.category.trim() || obs.text.trim() || "ملاحظة موثّقة",
      fileName: obs.photo.fileName,
      source,
      kind: fileKind(obs.photo.fileName, obs.photo.mimeType),
      dataUrl: getInspectorPhotoDataUrl(taskId, photoRef),
    });
  });

  return docs;
}

export function collectAllPropertyDetailDocuments(input: {
  property: PoPropertyIntake;
  showDecree: boolean;
  poNumber: string;
  surveyTaskId?: string | null;
  appraisalTaskId?: string | null;
  inspectionTaskId?: string | null;
}): PropertyDetailDocumentEntry[] {
  return collectPropertyDetailDocumentSections(input).flatMap(
    (section) => section.documents,
  );
}

export type PropertyDetailDocumentSection = {
  id: string;
  title: string;
  documents: PropertyDetailDocumentEntry[];
};

/** Display order for مستندات العقار — one section per upload source. */
export const PROPERTY_DETAIL_DOCUMENT_SECTIONS: {
  id: string;
  title: string;
}[] = [
  { id: "intake", title: "البيانات الأولية" },
  { id: "engineering", title: "المكتب الهندسي" },
  { id: "appraisal", title: "المقيّم العقاري" },
  { id: "inspection", title: "المعاين الميداني" },
];

const SECTION_TITLE_BY_ID = Object.fromEntries(
  PROPERTY_DETAIL_DOCUMENT_SECTIONS.map((s) => [s.id, s.title]),
) as Record<string, string>;

function sectionIdForSource(source: string): string {
  if (source === "البيانات الأولية") return "intake";
  if (source === "المكتب الهندسي") return "engineering";
  if (source === "المقيّم العقاري") return "appraisal";
  if (source === "المعاين الميداني") return "inspection";
  return "other";
}

export function collectPropertyDetailDocumentSections(input: {
  property: PoPropertyIntake;
  showDecree: boolean;
  poNumber: string;
  surveyTaskId?: string | null;
  appraisalTaskId?: string | null;
  inspectionTaskId?: string | null;
}): PropertyDetailDocumentSection[] {
  const all = [
    ...collectIntakeDocuments(input),
    ...collectEngineeringDocuments(input.surveyTaskId),
    ...collectAppraisalDocuments(input.appraisalTaskId),
    ...collectFieldInspectionDocuments(input.inspectionTaskId),
  ];

  const bySectionId = new Map<string, PropertyDetailDocumentEntry[]>();
  for (const def of PROPERTY_DETAIL_DOCUMENT_SECTIONS) {
    bySectionId.set(def.id, []);
  }

  for (const doc of all) {
    if (!isPropertyDetailDocumentAvailable(doc)) continue;
    const sectionId = sectionIdForSource(doc.source);
    const bucket = bySectionId.get(sectionId);
    if (bucket) bucket.push(doc);
  }

  return PROPERTY_DETAIL_DOCUMENT_SECTIONS.map((def) => ({
    id: def.id,
    title: def.title,
    documents: bySectionId.get(def.id) ?? [],
  })).filter((section) => section.documents.length > 0);
}

export function countPropertyDetailDocuments(
  sections: PropertyDetailDocumentSection[],
): number {
  return sections.reduce((total, section) => total + section.documents.length, 0);
}

export function listPropertyDetailPhotos(
  sections: PropertyDetailDocumentSection[],
): PropertyDetailDocumentEntry[] {
  return sections
    .flatMap((section) => section.documents)
    .filter((doc) => doc.kind === "image");
}

export function countPropertyDetailPhotos(
  sections: PropertyDetailDocumentSection[],
): number {
  return listPropertyDetailPhotos(sections).length;
}

export function sectionTitleForPreviewHint(source: string): boolean {
  return source === SECTION_TITLE_BY_ID.engineering || source === SECTION_TITLE_BY_ID.appraisal;
}

export function openPropertyDetailDocumentPreview(
  entry: PropertyDetailDocumentEntry,
): void {
  if (entry.engineeringField && entry.engineeringTaskId) {
    openEngineeringSurveyDocumentPreview(
      {
        fileName: entry.fileName,
        mimeType: "application/pdf",
        dataUrl: entry.dataUrl,
        attachmentId: entry.attachmentId,
      },
      entry.engineeringField,
      entry.engineeringTaskId,
    );
    return;
  }
  if (!entry.dataUrl) return;
  window.open(entry.dataUrl, "_blank", "noopener,noreferrer");
}

export function downloadPropertyDetailDocument(
  entry: PropertyDetailDocumentEntry,
): void {
  if (entry.engineeringField && entry.engineeringTaskId) {
    downloadEngineeringSurveyDocument(
      {
        fileName: entry.fileName,
        mimeType: "application/pdf",
        dataUrl: entry.dataUrl,
        attachmentId: entry.attachmentId,
      },
      entry.engineeringField,
      entry.engineeringTaskId,
    );
    return;
  }
  if (!entry.dataUrl) return;
  const link = document.createElement("a");
  link.href = entry.dataUrl;
  link.download = entry.fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
