import {
  listEngineeringSurveyDocuments,
  type EngineeringSurveyDocumentEntry,
} from "@engineering-office/mfe";
import { getCachedEvaluatorReport } from "@evaluator/mfe";
import {
  getCachedPropertyDocMatching,
  isImageMime,
} from "./assignment-doc-attachments";
import type { PoPropertyIntake } from "./po-intake-data";
import {
  INSPECTOR_DEFINED_PHOTOS,
  type InspectorWorkspaceDraft,
} from "./inspector-workspace-data";
import { getInspectorPhotoDataUrl } from "./inspector-photo-upload";
import { loadInspectorWorkspace } from "./inspector-workspace-storage";

export type PropertyDetailDocumentEntry = {
  id: string;
  name: string;
  fileName: string;
  source: string;
  kind: "pdf" | "file" | "image";
  dataUrl?: string;
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

export function collectIntakeDocuments(input: {
  property: PoPropertyIntake;
  showDecree: boolean;
  poNumber: string;
}): PropertyDetailDocumentEntry[] {
  const { property, showDecree, poNumber } = input;
  const docs: PropertyDetailDocumentEntry[] = [];
  const source = "البيانات الأولية";

  if (property.realEstateRegFileName?.trim()) {
    pushEntry(docs, {
      id: "intake-reg",
      name: "السجل العقاري",
      fileName: property.realEstateRegFileName.trim(),
      source,
      kind: fileKind(property.realEstateRegFileName),
    });
  }

  if (showDecree && property.assignmentDocFileName?.trim()) {
    const cached = getCachedPropertyDocMatching(
      "decree",
      poNumber,
      property.id,
      property.assignmentDocFileName,
    );
    pushEntry(docs, {
      id: "intake-assignment",
      name: "قرار الإسناد",
      fileName: property.assignmentDocFileName.trim(),
      source,
      kind: fileKind(
        property.assignmentDocFileName,
        cached?.mimeType,
      ),
      dataUrl: cached?.dataUrl,
    });
  }

  if (property.delegationLetterFileName?.trim()) {
    const cached = getCachedPropertyDocMatching(
      "delegation",
      poNumber,
      property.id,
      property.delegationLetterFileName,
    );
    pushEntry(docs, {
      id: "intake-delegation",
      name: "خطاب التفويض",
      fileName: property.delegationLetterFileName.trim(),
      source,
      kind: fileKind(
        property.delegationLetterFileName,
        cached?.mimeType,
      ),
      dataUrl: cached?.dataUrl,
    });
  }

  if (
    property.boundariesAvailability === "doc" &&
    property.boundariesExternalDocName?.trim()
  ) {
    pushEntry(docs, {
      id: "intake-boundaries",
      name: "مستند الحدود",
      fileName: property.boundariesExternalDocName.trim(),
      source,
      kind: fileKind(property.boundariesExternalDocName),
    });
  }

  property.otherDocumentFileNames.forEach((name, i) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    pushEntry(docs, {
      id: `intake-other-${i}`,
      name: "مستند إضافي",
      fileName: trimmed,
      source,
      kind: fileKind(trimmed),
    });
  });

  return docs;
}

export function collectEngineeringDocuments(
  surveyTaskId: string | null | undefined,
): PropertyDetailDocumentEntry[] {
  if (!surveyTaskId) return [];
  return listEngineeringSurveyDocuments(surveyTaskId).map(mapEngineeringDoc);
}

function mapEngineeringDoc(
  doc: EngineeringSurveyDocumentEntry,
): PropertyDetailDocumentEntry {
  return {
    id: doc.id,
    name: doc.name,
    fileName: doc.sub,
    source: "المكتب الهندسي",
    kind: "pdf",
    dataUrl: doc.attachment.dataUrl,
  };
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

  for (const def of INSPECTOR_DEFINED_PHOTOS) {
    const slot = submission.definedPhotos[def.id];
    if (!slot || slot.none) continue;
    slot.photos
      .filter((photo) => photo.approved)
      .forEach((photo, i) => {
        const photoRef = `slot:${def.id}:${photo.id}`;
        pushEntry(docs, {
          id: `inspection-photo-${def.id}-${photo.id}`,
          name: slot.photos.length > 1 ? `${def.name} ${i + 1}` : def.name,
          fileName: photo.fileName,
          source,
          kind: fileKind(photo.fileName, photo.mimeType),
          dataUrl: getInspectorPhotoDataUrl(taskId, photoRef),
        });
      });
  }

  submission.freePhotos
    .filter((photo) => photo.approved)
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
      name: `صورة توثيقية — ${key}`,
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
      name: key === "showroom" ? "صورة المعرض" : "صورة البئر",
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
    const sectionId = sectionIdForSource(doc.source);
    const bucket = bySectionId.get(sectionId);
    if (bucket) bucket.push(doc);
  }

  return PROPERTY_DETAIL_DOCUMENT_SECTIONS.map((def) => ({
    id: def.id,
    title: def.title,
    documents: bySectionId.get(def.id) ?? [],
  }));
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
    .filter((section) => section.id === "inspection")
    .flatMap((section) => section.documents)
    .filter((doc) => doc.kind === "image" && Boolean(doc.dataUrl));
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
  if (!entry.dataUrl) return;
  window.open(entry.dataUrl, "_blank", "noopener,noreferrer");
}

export function downloadPropertyDetailDocument(
  entry: PropertyDetailDocumentEntry,
): void {
  if (!entry.dataUrl) return;
  const link = document.createElement("a");
  link.href = entry.dataUrl;
  link.download = entry.fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
