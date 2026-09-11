import type { InspectorPhotoAttachment } from "./inspector-workspace-data";

/** One row in the property-detail documents / media lists. */
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
  /**
   * Field-inspection source — lets a caller hydrate this one photo through
   * `prefetchInspectorPhoto` without the whole-workspace prefetch.
   */
  inspectionPhoto?: {
    taskId: string;
    photoRef: string;
    attachment: InspectorPhotoAttachment;
  };
  /** Governed registry key (`property-document-types.ts`) the row belongs to. */
  documentTypeKey?: string;
  /** Uploaded from the documents tab itself (scope `property-document`) — deletable there. */
  governed?: boolean;
  /** Documents outside the defined list: the uploader's name + reason and the review state. */
  unlisted?: {
    customLabel: string;
    customReason: string;
    reviewStatus: "pending" | "approved" | "rejected";
    reviewNote?: string | null;
  };
};

export type PropertyDetailDocumentSection = {
  id: string;
  title: string;
  documents: PropertyDetailDocumentEntry[];
};

/** Prefer a named primary/main photo, else any hydrated image, else the first. */
export function pickPrimaryPropertyDetailPhoto(
  photos: PropertyDetailDocumentEntry[],
): PropertyDetailDocumentEntry | null {
  const preferred = photos.find((p) =>
    /رئيس|main|primary/i.test(`${p.name} ${p.fileName}`),
  );
  return (
    preferred ??
    photos.find((p) => Boolean(p.dataUrl)) ??
    photos[0] ??
    null
  );
}
