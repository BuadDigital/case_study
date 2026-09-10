"use client";

/**
 * Intake «other documents» are documents outside the defined list: every file needs a name and
 * a reason, is kept for supervisor review, and never counts toward required documents.
 * Defined documents (lease contract, building permit…) go through the documents tab by type.
 */

import { useState } from "react";
import { Input, Label, Textarea, useToast } from "@platform/ui-kit";
import {
  cacheOtherPropertyDoc,
  removeCachedPropertyDoc,
} from "../../lib/app-data/assignment-doc-attachments";
import {
  UNLISTED_LABEL_MAX_LENGTH,
  UNLISTED_REASON_MAX_LENGTH,
  validateUnlistedDocumentFields,
} from "../../lib/app-data/property-document-upload-rules";
import { PropertyFileUploadField } from "./PropertyFileUploadField";
import {
  withoutFileName,
  type EnfathSectionProps,
} from "./po-property-enfath-form-state";

export function PoPropertyUnlistedDocumentField({
  property,
  onPatch,
  attachPo,
}: Pick<EnfathSectionProps, "property" | "onPatch"> & { attachPo: string }) {
  const { showToast } = useToast();
  const [label, setLabel] = useState("");
  const [reason, setReason] = useState("");

  return (
    <div className="mt-2 w-full rounded-[10px] border border-border bg-surface-2 p-3">
      <p className="m-0 mb-2 text-[11px] leading-relaxed text-text-3">
        للمستندات النادرة غير المعرّفة فقط. المستندات المعرّفة (عقد الإيجار، رخصة
        البناء، هوية المالك…) تُرفع بنوعها من تبويب «مستندات العقار». يُحفظ المستند
        غير المعرّف بانتظار مراجعة مشرف القسم.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label className="mb-1 text-[11px]" htmlFor={`unlisted_label_${property.id}`}>
            اسم المستند
          </Label>
          <Input
            id={`unlisted_label_${property.id}`}
            value={label}
            maxLength={UNLISTED_LABEL_MAX_LENGTH}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div>
          <Label className="mb-1 text-[11px]" htmlFor={`unlisted_reason_${property.id}`}>
            سبب رفعه
          </Label>
          <Textarea
            id={`unlisted_reason_${property.id}`}
            value={reason}
            rows={2}
            maxLength={UNLISTED_REASON_MAX_LENGTH}
            placeholder="لماذا لا يندرج تحت نوع معرّف؟"
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </div>
      <PropertyFileUploadField
        id={`other_docs_${property.id}`}
        label="مستند غير معرّف (اختياري)"
        fileNames={property.otherDocumentFileNames}
        attachPo={attachPo}
        propertyId={property.id}
        docKind="other"
        multiple
        onUpload={(file) => {
          const problem = validateUnlistedDocumentFields(label, reason);
          if (problem) {
            showToast(problem, "error");
            return;
          }
          if (!attachPo) {
            showToast("احفظ العقار أولاً ثم ارفع المستند غير المعرّف", "error");
            return;
          }
          onPatch("otherDocumentFileNames", [
            ...property.otherDocumentFileNames,
            file.name,
          ]);
          void cacheOtherPropertyDoc(attachPo, property.id, file, {
            customDocumentLabel: label.trim(),
            customDocumentReason: reason.trim(),
          })
            .then((result) => {
              if (!result.ok) showToast(result.error, "error");
            })
            .catch(() => {
              showToast("تعذّر حفظ المستند غير المعرّف — حاول مرة أخرى", "error");
            });
          setLabel("");
          setReason("");
        }}
        onRemove={(name) => {
          onPatch(
            "otherDocumentFileNames",
            withoutFileName(property.otherDocumentFileNames, name),
          );
          if (attachPo) {
            void removeCachedPropertyDoc("other", attachPo, property.id, name);
          }
        }}
        onClear={() => onPatch("otherDocumentFileNames", [])}
      />
    </div>
  );
}
