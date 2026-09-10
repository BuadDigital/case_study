"use client";

/**
 * Upload a property document by type, or re-type an existing one. The type always comes from
 * the defined list; «مستند غير معرّف» asks for a name and a reason and goes to review.
 */

import { useEffect, useState } from "react";
import { AppModal, Button, Input, Label, Select, Textarea } from "@platform/ui-kit";
import { UNLISTED_DOCUMENT_KEY } from "@platform/app-shared/domain/property-documents/property-document-types";
import type { GovernedDocumentTypeInput } from "../../lib/app-data/governed-property-documents-commands";
import type { PropertyDocumentTypeOption } from "../../lib/app-data/property-document-checklist";
import {
  UNLISTED_LABEL_MAX_LENGTH,
  UNLISTED_REASON_MAX_LENGTH,
  propertyDocumentFileAccept,
  validatePropertyDocumentFile,
  validateUnlistedDocumentFields,
} from "../../lib/app-data/property-document-upload-rules";

export type PropertyDocumentDialogState =
  | { mode: "upload"; typeKey?: string }
  | {
      mode: "classify";
      attachmentId: string;
      fileName: string;
      customLabel?: string;
      customReason?: string;
    };

export function PropertyDocumentUploadDialog({
  state,
  options,
  busy,
  onClose,
  onUpload,
  onClassify,
}: {
  state: PropertyDocumentDialogState | null;
  options: PropertyDocumentTypeOption[];
  busy: boolean;
  onClose: () => void;
  onUpload: (input: GovernedDocumentTypeInput & { file: File }) => Promise<boolean>;
  onClassify: (attachmentId: string, input: GovernedDocumentTypeInput) => Promise<boolean>;
}) {
  const [typeKey, setTypeKey] = useState("");
  const [label, setLabel] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!state) return;
    setTypeKey(state.mode === "upload" ? (state.typeKey ?? "") : "");
    setLabel(state.mode === "classify" ? (state.customLabel ?? "") : "");
    setReason(state.mode === "classify" ? (state.customReason ?? "") : "");
    setFile(null);
    setError(null);
  }, [state]);

  if (!state) return null;

  const option = options.find((o) => o.key === typeKey);
  const isUnlisted = typeKey === UNLISTED_DOCUMENT_KEY;
  const groupTitles = [...new Set(options.map((o) => o.groupTitle))];

  async function submit() {
    if (!state) return;
    if (!option) {
      setError("اختر نوع المستند من القائمة");
      return;
    }
    if (isUnlisted) {
      const problem = validateUnlistedDocumentFields(label, reason);
      if (problem) {
        setError(problem);
        return;
      }
    }
    const input: GovernedDocumentTypeInput = {
      documentTypeKey: option.key,
      customLabel: label,
      customReason: reason,
    };
    if (state.mode === "classify") {
      if (await onClassify(state.attachmentId, input)) onClose();
      return;
    }
    if (!file) {
      setError("اختر ملف المستند");
      return;
    }
    const fileError = validatePropertyDocumentFile(file, option.pdfOnly);
    if (fileError) {
      setError(fileError);
      return;
    }
    if (await onUpload({ ...input, file })) onClose();
  }

  return (
    <AppModal
      open
      title={state.mode === "upload" ? "إضافة مستند للعقار" : "تصنيف المستند"}
      subtitle={
        state.mode === "classify"
          ? state.fileName
          : "اختر نوع المستند من القائمة المعرّفة — «مستند غير معرّف» للحالات النادرة فقط"
      }
      onClose={onClose}
      maxWidthPx={520}
      footer={
        <>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose}>
            إلغاء
          </Button>
          <Button type="button" size="sm" disabled={busy} onClick={() => void submit()}>
            {busy
              ? "جارٍ الحفظ…"
              : state.mode === "upload"
                ? "رفع المستند"
                : "حفظ التصنيف"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <div>
          <Label className="mb-1 text-[11px]" htmlFor="property-document-type">
            نوع المستند *
          </Label>
          <Select
            id="property-document-type"
            value={typeKey}
            onChange={(e) => {
              setTypeKey(e.target.value);
              setError(null);
            }}
          >
            <option value="">— اختر من القائمة المعرّفة —</option>
            {groupTitles.map((title) => (
              <optgroup key={title} label={title}>
                {options
                  .filter((o) => o.groupTitle === title)
                  .map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </Select>
        </div>

        {isUnlisted ? (
          <>
            <p className="m-0 rounded-md border border-[#e8d3a3] bg-[#fbf5e6] px-3 py-2 text-[11.5px] leading-relaxed text-[#7a5a14]">
              المستند غير المعرّف يُحفظ بانتظار مراجعة مشرف القسم، ولا يُحتسب ضمن
              المستندات الإلزامية ولا يُطبع في التقرير.
            </p>
            <div>
              <Label className="mb-1 text-[11px]" htmlFor="property-document-label">
                اسم المستند *
              </Label>
              <Input
                id="property-document-label"
                value={label}
                maxLength={UNLISTED_LABEL_MAX_LENGTH}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div>
              <Label className="mb-1 text-[11px]" htmlFor="property-document-reason">
                سبب رفعه *
              </Label>
              <Textarea
                id="property-document-reason"
                value={reason}
                rows={3}
                maxLength={UNLISTED_REASON_MAX_LENGTH}
                placeholder="لماذا لا يندرج تحت نوع معرّف؟"
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </>
        ) : null}

        {state.mode === "upload" ? (
          <div>
            <Label className="mb-1 text-[11px]" htmlFor="property-document-file">
              الملف *
            </Label>
            <input
              id="property-document-file"
              type="file"
              accept={propertyDocumentFileAccept(option?.pdfOnly ?? false)}
              className="block w-full text-[12px]"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setError(null);
              }}
            />
            <p className="m-0 mt-1 text-[10.5px] text-text-3">
              {option?.pdfOnly ? "PDF فقط" : "PDF أو صورة JPG / PNG / WebP"}
            </p>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="m-0 text-[11px] text-danger-text">
            {error}
          </p>
        ) : null}
      </div>
    </AppModal>
  );
}
