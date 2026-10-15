"use client";

/**
 * The PDFs appended beside the primary survey report: one chip per file with حذف, and a
 * dropzone for the next one. The first file keeps its own box above (it is the required one).
 */

import { Button } from "@platform/ui-kit";
import type { EngineeringSurveyExtraReport } from "../lib/engineering-survey-data";
import { openEngineeringSurveyDocumentPreview } from "../lib/engineering-survey-attachments";
import { EngUploadBox } from "./EngineeringSurveyHtmlPrimitives";

export function EngExtraReportsList({
  extras,
  disabled,
  onPick,
  onRemove,
}: {
  extras: EngineeringSurveyExtraReport[];
  disabled: boolean;
  onPick: (file: File | null) => void;
  onRemove: (attachmentId: string) => void;
}) {
  return (
    <div className="mt-3">
      <div className="mb-1.5 text-[11.5px] font-bold text-text-2">
        ملفات إضافية للتقرير المساحي{extras.length > 0 ? ` (${extras.length})` : ""}
      </div>
      {extras.length > 0 ? (
        <ul className="m-0 mb-2 grid list-none gap-1.5 p-0">
          {extras.map((extra, index) => (
            <li
              key={extra.attachmentId}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-heading"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-text-3">ملحق {index + 1}</span>
                <bdi dir="ltr" className="truncate">
                  {extra.fileName}
                </bdi>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => openEngineeringSurveyDocumentPreview(extra)}
                >
                  معاينة
                </Button>
                {!disabled ? (
                  <Button
                    type="button"
                    variant="dangerOutline"
                    size="sm"
                    onClick={() => onRemove(extra.attachmentId)}
                  >
                    حذف
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {!disabled ? (
        <EngUploadBox
          id="eng-survey-report-extra"
          title="إضافة ملف PDF آخر للتقرير المساحي"
          hint="PDF — الحجم الأقصى 20 ميجابايت"
          fileName=""
          disabled={disabled}
          onPick={onPick}
          onClear={() => undefined}
        />
      ) : null}
    </div>
  );
}
