"use client";

import type { ReactNode } from "react";
import { Button, Input, Label } from "@platform/design-system";
import {
  clearCachedPropertyDoc,
  type PropertyDocKind,
} from "../../lib/prototype/assignment-doc-attachments";
import { AssignmentDocAttachment } from "./AssignmentDocAttachment";

export function PropertyFileUploadField({
  id,
  label,
  fileName,
  error,
  attachPo,
  propertyId,
  docKind,
  multiple,
  onUpload,
  onClear,
}: {
  id: string;
  label: ReactNode;
  fileName: string;
  error?: string;
  attachPo?: string;
  propertyId?: string;
  docKind?: PropertyDocKind;
  multiple?: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
}) {
  const hasFile = Boolean(fileName.trim());
  const showPreview = Boolean(docKind && attachPo && propertyId);

  const handleReplace = () => {
    if (docKind && attachPo && propertyId) {
      clearCachedPropertyDoc(docKind, attachPo, propertyId);
    }
    onClear();
  };

  if (hasFile) {
    return (
      <div className="mt-2 w-full">
        <Label className="mb-1 text-[11px]">{label}</Label>
        {showPreview ? (
          <AssignmentDocAttachment
            key={`${docKind}-${attachPo}-${propertyId}-${fileName}`}
            poNumber={attachPo!}
            propertyId={propertyId!}
            fileName={fileName}
            docKind={docKind}
            variant="inline"
          />
        ) : (
          <p className="text-[11px] text-text-2">{fileName}</p>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1.5 h-auto px-0 text-[11px] text-primary"
          onClick={handleReplace}
        >
          استبدال الملف
        </Button>
        {error ? (
          <p className="mt-1 text-[10px] text-danger-text" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-2 w-full">
      <Label className="mb-1 text-[11px]" htmlFor={id}>
        {label}
      </Label>
      <Input
        id={id}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        multiple={multiple}
        className="text-xs"
        onChange={(e) => {
          const file = multiple
            ? Array.from(e.target.files ?? [])[0]
            : e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }}
      />
      {error ? (
        <p className="mt-1 text-[10px] text-danger-text" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
