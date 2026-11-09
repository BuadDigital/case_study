"use client";

/**
 * Intake «other documents» are documents outside the defined list: each file is kept for supervisor
 * review and never counts toward required documents. No name or reason is asked here (Omar 2026-11-09:
 * «we don't need them anymore») — the file is listed under its file name.
 * Defined documents (lease contract, building permit…) go through the documents tab by type.
 */

import { useToast, useWorkDensity } from "@platform/ui-kit";
import {
  cacheOtherPropertyDoc,
  removeCachedPropertyDoc,
} from "../../lib/app-data/assignment-doc-attachments";
import { PropertyFileUploadField } from "./PropertyFileUploadField";
import { usePropertyDocUpload } from "./use-property-doc-upload";
import {
  withoutFileName,
  type EnfathSectionProps,
} from "./po-property-deed-form-state";

export function PoPropertyUnlistedDocumentField({
  property,
  onPatch,
  attachPo,
}: Pick<EnfathSectionProps, "property" | "onPatch"> & { attachPo: string }) {
  const { showToast } = useToast();
  const upload = usePropertyDocUpload();
  const work = useWorkDensity();
  const uploadOther = (file: File) => {
    if (!attachPo) {
      showToast("احفظ العقار أولاً ثم ارفع المستند غير المعرّف", "error");
      return;
    }
    const details = { customDocumentLabel: "", customDocumentReason: "" };
    void upload.run(
      "other",
      file,
      () => cacheOtherPropertyDoc(attachPo, property.id, file, details),
      (name) => {
        onPatch("otherDocumentFileNames", [
          ...property.otherDocumentFileNames.filter((n) => n !== name),
          name,
        ]);
      },
      "تعذّر حفظ المستند غير المعرّف — حاول مرة أخرى",
    );
  };
  const removeOther = (name: string) => {
    onPatch(
      "otherDocumentFileNames",
      withoutFileName(property.otherDocumentFileNames, name),
    );
    if (attachPo) {
      void removeCachedPropertyDoc("other", attachPo, property.id, name);
    }
  };

  // The work page (Omar 2026-11-09: «make it beautiful»): one document card like the defined
  // documents beside it, with no hint line (Omar 2026-11-09).
  if (work) {
    return (
      <PropertyFileUploadField
        id={`other_docs_${property.id}`}
        label="مستند غير معرّف (اختياري)"
        fileNames={property.otherDocumentFileNames}
        attachPo={attachPo}
        propertyId={property.id}
        docKind="other"
        multiple
        uploading={upload.isUploading("other")}
        onUpload={uploadOther}
        onRemove={removeOther}
        onClear={() => onPatch("otherDocumentFileNames", [])}
      />
    );
  }

  return (
    <div className="mt-2 w-full rounded-[10px] border border-border bg-surface-2 p-3">
      <p className="m-0 mb-2 text-[11px] leading-relaxed text-text-3">
        للمستندات النادرة غير المعرّفة فقط. المستندات المعرّفة (عقد الإيجار، رخصة
        البناء، هوية المالك…) تُرفع بنوعها من تبويب «مستندات العقار». يُحفظ المستند
        غير المعرّف بانتظار مراجعة مشرف القسم.
      </p>
      <PropertyFileUploadField
        id={`other_docs_${property.id}`}
        label="مستند غير معرّف (اختياري)"
        fileNames={property.otherDocumentFileNames}
        attachPo={attachPo}
        propertyId={property.id}
        docKind="other"
        multiple
        uploading={upload.isUploading("other")}
        onUpload={uploadOther}
        onRemove={removeOther}
        onClear={() => onPatch("otherDocumentFileNames", [])}
      />
    </div>
  );
}
