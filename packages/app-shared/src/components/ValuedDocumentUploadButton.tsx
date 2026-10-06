"use client";

/**
 * «إضافة مستند ذي قيمة» for party screens (appraiser, inspector, engineering office). The
 * uploader names the document and attaches the file; it then waits for the case specialist's
 * approval. The file is no longer reachable from the uploader's screen, but its name and the
 * specialist's decision stay listed under the button.
 */

import { useRef, useState } from "react";
import { AppModal, Button, Input, Label, useToast } from "@platform/ui-kit";
import { OwnValuedDocumentsList } from "./OwnValuedDocumentsList";
import {
  VALUED_DOCUMENT_FILE_ACCEPT,
  VALUED_DOCUMENT_NAME_MAX_LENGTH,
  uploadValuedDocument,
  validateValuedDocumentUpload,
} from "../domain/property-documents/valued-document-upload";

export function ValuedDocumentUploadButton({
  poNumber,
  propertyId,
  disabled,
  showOwnList = true,
  canReview = false,
  onUploaded,
}: {
  poNumber: string;
  propertyId: string;
  disabled?: boolean;
  /** List what this user uploaded (name + decision) under the button; the appraiser's panel already lists all. */
  showOwnList?: boolean;
  /** The case specialist: approve / reject the listed documents. */
  canReview?: boolean;
  onUploaded?: () => void;
}) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!poNumber.trim() || !propertyId.trim()) return null;

  function reset() {
    setName("");
    setFile(null);
    setError(null);
  }

  function close() {
    if (busy) return;
    setOpen(false);
    reset();
  }

  async function submit() {
    const problem = validateValuedDocumentUpload(name, file);
    if (problem || !file) {
      setError(problem ?? "اختر ملف المستند");
      return;
    }
    setBusy(true);
    const result = await uploadValuedDocument({ poNumber, propertyId, name, file });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    showToast("تم رفع المستند — بانتظار اعتماد أخصائي دراسة الحالة", "success");
    setOpen(false);
    reset();
    setReloadKey((k) => k + 1);
    onUploaded?.();
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        + إضافة مستند ذي قيمة
      </Button>
      {showOwnList ? (
        // Full width: drops under the button inside a wrapping flex row as well as a block parent.
        <div className="w-full basis-full">
          <OwnValuedDocumentsList
            poNumber={poNumber}
            propertyId={propertyId}
            reloadKey={reloadKey}
            canReview={canReview}
          />
        </div>
      ) : null}
      {open ? (
        <AppModal
          open
          title="إضافة مستند ذي قيمة"
          subtitle="مستند يحمل قيمة قد يستخدمها المقيّم — مثل تقرير تقييم الآلات أو دراسة الدخل"
          onClose={close}
          maxWidthPx={480}
          footer={
            <>
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={close}>
                إلغاء
              </Button>
              <Button type="button" size="sm" disabled={busy} onClick={() => void submit()}>
                {busy ? "جارٍ الرفع…" : "رفع المستند"}
              </Button>
            </>
          }
        >
          <div className="grid gap-3">
            <p className="m-0 rounded-md border border-[color-mix(in_srgb,var(--amber)_40%,var(--border))] bg-warning-bg px-3 py-2 text-[11.5px] leading-relaxed text-amber-text">
              يراجعه أخصائي دراسة الحالة ويعتمده، ولا يطّلع عليه بعد الرفع إلا الأخصائي والمقيّم.
            </p>
            <div>
              <Label className="mb-1 text-[11px]" htmlFor="valued-document-name">
                اسم المستند *
              </Label>
              <Input
                id="valued-document-name"
                value={name}
                maxLength={VALUED_DOCUMENT_NAME_MAX_LENGTH}
                placeholder="مثال: تقرير تقييم الآلات"
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
              />
            </div>
            <div>
              <Label className="mb-1 text-[11px]" htmlFor="valued-document-file">
                الملف *
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {file ? "استبدال الملف" : "اختيار ملف"}
                </Button>
                <span className="min-w-0 truncate text-[12px] text-text-2">
                  {file ? file.name : "PDF أو صورة JPG / PNG / WebP"}
                </span>
              </div>
              <input
                ref={fileInputRef}
                id="valued-document-file"
                type="file"
                accept={VALUED_DOCUMENT_FILE_ACCEPT}
                className="sr-only"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setError(null);
                  e.target.value = "";
                }}
              />
            </div>
            {error ? (
              <p role="alert" className="m-0 text-[11px] text-danger-text">
                {error}
              </p>
            ) : null}
          </div>
        </AppModal>
      ) : null}
    </>
  );
}
