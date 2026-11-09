"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppModal, Badge, Button, Label, Note, useToast } from "@platform/ui-kit";
import {
  PROPERTY_PHOTO_CLASSES,
  REPORT_PHOTO_LIMIT,
  photoClassOf,
  withPhotoClass,
  type PropertyDetailDocumentEntry,
  type PropertyPhotoClass,
  type PropertyPhotoMarks,
} from "@platform/app-shared/app-data/property-detail-document-types";
import {
  PROPERTY_DOCUMENT_TYPES,
  UNLISTED_DOCUMENT_KEY,
  VALUED_DOCUMENT_KEY,
} from "@platform/app-shared/domain/property-documents/property-document-types";
import { uploadGovernedPropertyDocument } from "../../lib/app-data/governed-property-documents-commands";
import { governedPropertyDocumentsQueryKey } from "../../query/governed-property-documents-query";
import { usePhotoDataUrl } from "../po-intake/PropertyReportPhotoBoard";
import { usePropertyPhotoMarks } from "../po-intake/usePropertyPhotoMarks";

/** The registry types a photographed document can become: listed, uploadable from the tab, not PDF-only. */
const PHOTO_DOCUMENT_TYPES = PROPERTY_DOCUMENT_TYPES.filter(
  (t) => t.uploadableFromTab && !t.pdfOnly && t.key !== UNLISTED_DOCUMENT_KEY && t.key !== VALUED_DOCUMENT_KEY,
);

const CLASS_TONE: Record<PropertyPhotoClass, "info" | "primary" | "warning" | "default"> = {
  exterior: "info",
  interior: "primary",
  surroundings: "warning",
  document: "default",
};

/** The photo's file from its data URL — decoded here: the page's CSP refuses `fetch` on `data:` URLs. */
async function photoFile(dataUrl: string, name: string): Promise<File> {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(dataUrl);
  let blob: Blob;
  if (match) {
    const payload = match[2] ? atob(match[3] ?? "") : decodeURIComponent(match[3] ?? "");
    const bytes = new Uint8Array(payload.length);
    for (let i = 0; i < payload.length; i++) bytes[i] = payload.charCodeAt(i);
    blob = new Blob([bytes], { type: match[1] || "image/jpeg" });
  } else {
    blob = await (await fetch(dataUrl)).blob();
  }
  const ext = blob.type === "image/png" ? "png" : "jpg";
  return new File([blob], `${name.replace(/[\\/:*?"<>|]/g, "-").slice(0, 60) || "مستند"}.${ext}`, {
    type: blob.type || "image/jpeg",
  });
}

/** One photo with its class picker. */
function ClassifiedPhoto({
  photo,
  value,
  editable,
  onChange,
}: {
  photo: PropertyDetailDocumentEntry;
  value: PropertyPhotoClass;
  editable: boolean;
  onChange: (photo: PropertyDetailDocumentEntry, value: PropertyPhotoClass, dataUrl: string | undefined) => void;
}) {
  const dataUrl = usePhotoDataUrl(photo);
  return (
    <div className="flex flex-col gap-1">
      <div className="aspect-[4/3] w-full overflow-hidden rounded border border-border bg-surface-2">
        {dataUrl ? <img src={dataUrl} alt={photo.name} className="block h-full w-full object-cover" /> : null}
      </div>
      <span className="truncate text-[11px] text-text-3" title={photo.name}>
        {photo.name}
      </span>
      {editable && value !== "document" ? (
        <select
          aria-label={`تصنيف ${photo.name}`}
          className="h-8 rounded-md border border-border bg-surface px-1 text-[12px]"
          value={value}
          onChange={(e) => onChange(photo, e.target.value as PropertyPhotoClass, dataUrl)}
        >
          {PROPERTY_PHOTO_CLASSES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      ) : (
        <Badge tone={CLASS_TONE[value]}>{PROPERTY_PHOTO_CLASSES.find((c) => c.key === value)?.label}</Badge>
      )}
    </div>
  );
}

/**
 * «تصنيف صور المعاين» (Omar 2026-11-08): every inspector photo is exterior (the meters with it),
 * interior (the movables with it), the property's surroundings (kept inside the system, never sent to
 * Enfaz) or a document. The Enfaz exterior / interior photo files are built from these classes.
 *
 * How it works: the photos are grouped by their class (the stored one, else the one their name
 * suggests); changing a picker saves the photo marks at once (the same save as the photos tab). Choosing
 * «مستند» asks for the document's type and adds the photo as that property document (the documents tab
 * shows it), then classes it «مستند» so it leaves the photo files — the inspector's package keeps the
 * original as it was delivered.
 * Edge cases: the classes lock with the photo marks once the study report is issued; a photo whose file
 * is not loaded yet cannot become a document; the coordinator classifies first, the study may change it.
 */
export function InspectorPhotoClassification({
  poNumber,
  propertyId,
  photos,
  stored,
  studyTaskId,
  inspectionTaskId,
}: {
  poNumber: string;
  propertyId: string;
  photos: readonly PropertyDetailDocumentEntry[];
  stored: PropertyPhotoMarks | undefined;
  studyTaskId: string | null;
  inspectionTaskId: string | null;
}) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const photoMarks = usePropertyPhotoMarks({
    poNumber,
    propertyId,
    stored,
    studyTaskId,
    inspectionTaskId,
    enabled: true,
    reportLimit: REPORT_PHOTO_LIMIT,
  });
  const [toDocument, setToDocument] = useState<{ photo: PropertyDetailDocumentEntry; dataUrl: string } | null>(null);
  const [documentType, setDocumentType] = useState(PHOTO_DOCUMENT_TYPES[0]?.key ?? "");
  const [converting, setConverting] = useState(false);

  const inspectorPhotos = useMemo(
    () => photos.filter((p) => p.kind === "image" && p.documentTypeKey === "inspection-photo"),
    [photos],
  );
  const groups = useMemo(
    () =>
      PROPERTY_PHOTO_CLASSES.map((c) => ({
        ...c,
        photos: inspectorPhotos.filter((p) => photoClassOf(p, photoMarks.marks) === c.key),
      })),
    [inspectorPhotos, photoMarks.marks],
  );

  const choose = (photo: PropertyDetailDocumentEntry, value: PropertyPhotoClass, dataUrl: string | undefined) => {
    if (value === "document") {
      if (!dataUrl) {
        showToast("لم يُحمَّل ملف الصورة بعد — أعد المحاولة بعد لحظة", "error");
        return;
      }
      setToDocument({ photo, dataUrl });
      return;
    }
    photoMarks.change(inspectorPhotos, (m) => withPhotoClass(m, photo, value));
  };

  async function convert() {
    if (!toDocument || !documentType) return;
    setConverting(true);
    try {
      const file = await photoFile(toDocument.dataUrl, toDocument.photo.name);
      const result = await uploadGovernedPropertyDocument({ poNumber, propertyId, file, documentTypeKey: documentType });
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      photoMarks.change(inspectorPhotos, (m) => withPhotoClass(m, toDocument.photo, "document"));
      await queryClient.invalidateQueries({ queryKey: governedPropertyDocumentsQueryKey(poNumber, propertyId) });
      showToast("أُضيفت الصورة مستندًا للعقار", "success");
      setToDocument(null);
    } catch {
      showToast("تعذّر قراءة ملف الصورة — أعد المحاولة", "error");
    } finally {
      setConverting(false);
    }
  }

  if (inspectorPhotos.length === 0) return null;
  return (
    <section className="mb-5 flex flex-col gap-3" data-testid="inspector-photo-classification">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="h-[17px] w-[3px] rounded-full bg-gold" aria-hidden />
        <h3 className="m-0 text-[14px] font-extrabold text-heading">تصنيف صور المعاين</h3>
      </div>
      <p className="m-0 text-[11.5px] leading-relaxed text-text-3">
        يُبنى منه ملفّا صور إنفاذ: الخارجية (ومعها عدادا الماء والكهرباء) والداخلية (ومعها المنقولات). «محيط العقار» يبقى
        داخل النظام ولا يُرسل لإنفاذ، و«مستند» يُضاف إلى مستندات العقار بنوعه. اختيار صور التقرير يبقى لدارس العقار.
      </p>
      {!photoMarks.canEdit ? (
        <Note tone="info">التصنيف مقفل — صدر تقرير الدراسة أو لا تملك تعديله.</Note>
      ) : null}
      {groups.map((group) =>
        group.photos.length > 0 ? (
          <div key={group.key} className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[12.5px] font-bold text-heading">
              {group.label}
              <Badge tone={CLASS_TONE[group.key]}>{group.photos.length}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
              {group.photos.map((photo) => (
                <ClassifiedPhoto
                  key={photo.id}
                  photo={photo}
                  value={group.key}
                  editable={photoMarks.canEdit}
                  onChange={choose}
                />
              ))}
            </div>
          </div>
        ) : null,
      )}
      <AppModal
        open={Boolean(toDocument)}
        title="تحويل الصورة إلى مستند"
        subtitle="تُضاف الصورة إلى مستندات العقار بالنوع الذي تختاره، وتخرج من ملفّي صور إنفاذ."
        onClose={() => (converting ? undefined : setToDocument(null))}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" disabled={converting} onClick={() => setToDocument(null)}>
              إلغاء
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={converting}
              disabled={converting || !documentType}
              onClick={() => void convert()}
            >
              إضافة كمستند
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-1">
          <Label htmlFor="photo-document-type">نوع المستند</Label>
          <select
            id="photo-document-type"
            className="h-9 rounded-md border border-border bg-surface px-2 text-[13px]"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
          >
            {PHOTO_DOCUMENT_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.labelAr}
              </option>
            ))}
          </select>
        </div>
      </AppModal>
    </section>
  );
}
