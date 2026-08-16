"use client";

import { useEffect, useState } from "react";
import {
  getCachedPropertyDocMatching,
  subscribeAssignmentDocCache,
  type PropertyDocKind,
} from "../../lib/prototype/assignment-doc-attachments";
import { AssignmentDocAttachment } from "./AssignmentDocAttachment";
import { ReportAttachmentClassifyControls } from "./ReportAttachmentClassifyControls";

/** Property doc preview + optional report-print classification. */
export function AssignmentDocWithReportClassify({
  poNumber,
  propertyId,
  fileName,
  variant = "detail",
  docKind = "decree",
}: {
  poNumber: string;
  propertyId: string;
  fileName?: string;
  variant?: "inline" | "detail" | "thumb" | "card" | "panel";
  docKind?: PropertyDocKind;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => subscribeAssignmentDocCache(() => setTick((n) => n + 1)), []);
  void tick;

  const cached = getCachedPropertyDocMatching(
    docKind,
    poNumber,
    propertyId,
    fileName,
  );

  return (
    <div className="flex w-full flex-col gap-1">
      <AssignmentDocAttachment
        poNumber={poNumber}
        propertyId={propertyId}
        fileName={fileName}
        variant={variant}
        docKind={docKind}
      />
      {cached?.attachmentId ? (
        <ReportAttachmentClassifyControls
          attachmentId={cached.attachmentId}
          docKind={docKind}
        />
      ) : null}
    </div>
  );
}
