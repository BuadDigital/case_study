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
  fileNames,
  error,
  attachPo,
  propertyId,
  docKind,
  multiple,
  onUpload,
  onUploadMany,
  onClear,
  onRemove,
}: {
  id: string;
  label: ReactNode;
  /** Single-file mode display name. */
  fileName?: string;
  /** Multi-file mode names. */
  fileNames?: string[];
  error?: string;
  attachPo?: string;
  propertyId?: string;
  docKind?: PropertyDocKind;
  multiple?: boolean;
  onUpload: (file: File) => void;
  onUploadMany?: (files: File[]) => void;
  onClear: () => void;
  /** Remove one file in multi mode. */
  onRemove?: (fileName: string) => void;
}) {
  const names = multiple
    ? (fileNames ?? []).map((n) => n.trim()).filter(Boolean)
    : fileName?.trim()
      ? [fileName.trim()]
      : [];
  const hasFiles = names.length > 0;
  const showPreview = Boolean(docKind && attachPo && propertyId);

  const handleClearAll = () => {
    if (docKind && attachPo && propertyId) {
      clearCachedPropertyDoc(docKind, attachPo, propertyId);
    }
    onClear();
  };

  return (
    <div className="mt-2 w-full">
      <Label className="mb-1 text-[11px]" htmlFor={id}>
        {label}
      </Label>

      {hasFiles ? (
        <ul className="mb-2 space-y-2">
          {names.map((name) => (
            <li key={name} className="rounded border border-border bg-surface-2 p-2">
              {showPreview ? (
                <AssignmentDocAttachment
                  key={`${docKind}-${attachPo}-${propertyId}-${name}`}
                  poNumber={attachPo!}
                  propertyId={propertyId!}
                  fileName={name}
                  docKind={docKind}
                  variant="inline"
                />
              ) : (
                <p className="text-[11px] text-text-2">{name}</p>
              )}
              {multiple && onRemove ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-auto px-0 text-[11px] text-danger-text"
                  onClick={() => onRemove(name)}
                >
                  إزالة
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <Input
        id={id}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        multiple={multiple}
        className="text-xs"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (picked.length === 0) return;
          if (multiple) {
            if (onUploadMany) onUploadMany(picked);
            else picked.forEach((file) => onUpload(file));
          } else {
            onUpload(picked[0]!);
          }
        }}
      />

      {hasFiles ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1.5 h-auto px-0 text-[11px] text-primary"
          onClick={handleClearAll}
        >
          {multiple ? "مسح كل الملفات" : "استبدال الملف"}
        </Button>
      ) : null}

      {error ? (
        <p className="mt-1 text-[10px] text-danger-text" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
