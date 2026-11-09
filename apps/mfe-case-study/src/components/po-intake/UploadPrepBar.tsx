"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Note, useToast } from "@platform/ui-kit";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { notifyTasksChanged } from "@platform/app-shared/workflow/task-types";
import { canHandOverToEnfaz } from "../../lib/app-data/po-roles";
import { prepareUpload } from "../../lib/app-data/enfaz-handover-commands";
import { enfazCardState, uploadPackageGaps } from "../../lib/app-data/enfaz-handover-state";
import type { InfathUploadAttachment } from "../../lib/app-data/infath-upload-types";
import {
  transactionStateQueryKey,
  useTransactionStateQuery,
} from "../../query/use-transaction-state-query";

/**
 * «تجهيز المعاملة للرفع» (Omar 2026-11-08) — review's check of the upload package before the deed enters
 * the upload queue.
 *
 * How it works: reads the deed's transaction state; lists the package rows still missing
 * (`uploadPackageGaps`) and what the server says blocks the upload; the button is live only when both
 * are empty, and stamps the deed ready (`prepareUpload`) — the server checks the final report and the
 * blockers again. Once ready it says so.
 * Edge cases: nothing for a viewer without the review sub-role or a deed already uploaded; a refusal
 * shows the server's reason and refetches the state.
 */
export function UploadPrepBar({
  workOrderId,
  propertyId,
  attachments,
}: {
  workOrderId: string;
  propertyId: string;
  attachments: readonly InfathUploadAttachment[];
}) {
  const { access } = useAppAccess();
  const mayPrepare = canHandOverToEnfaz(access);
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const query = useTransactionStateQuery(workOrderId, propertyId, { enabled: mayPrepare });

  if (!mayPrepare || !query.data) return null;
  const card = enfazCardState(query.data);
  if (card.handedOver) return null;
  if (card.readyForUpload) {
    return (
      <Note tone="success" data-testid="upload-prep-bar">
        جُهّزت المعاملة للرفع — تحققت حزمة الرفع وهي في صفوف الرفع على إنفاذ.
      </Note>
    );
  }

  const gaps = uploadPackageGaps(attachments);
  const blocked = gaps.length > 0 || !card.canPrepareUpload;

  async function prepare() {
    if (busy || blocked) return;
    setBusy(true);
    try {
      const result = await prepareUpload(workOrderId, propertyId);
      if (!result.ok) {
        showToast(result.error, "error");
        void query.refetch();
        return;
      }
      queryClient.setQueryData(transactionStateQueryKey(workOrderId, propertyId), result.data);
      showToast("جُهّزت المعاملة للرفع — انتقلت إلى صفوف الرفع", "success");
      notifyTasksChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-[10px] border border-border bg-surface-2/50 px-3.5 py-3"
      data-testid="upload-prep-bar"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12.5px] font-bold text-heading">تجهيز المعاملة للرفع</span>
        <Button
          type="button"
          size="sm"
          variant="primary"
          loading={busy}
          disabled={blocked}
          showActionToast={false}
          onClick={() => void prepare()}
        >
          تجهيز المعاملة للرفع
        </Button>
      </div>
      {gaps.length > 0 || card.blockReasons.length > 0 ? (
        <Note tone="warn">
          لا تُجهَّز قبل اكتمال الحزمة:
          <ul className="m-0 list-disc ps-4">
            {[...gaps.map((g) => `${g} — غير متوفر`), ...card.blockReasons].map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Note>
      ) : (
        <p className="m-0 text-[11.5px] text-text-3">
          اكتملت الحزمة — بعد التجهيز تنتقل المعاملة إلى صفوف الرفع على إنفاذ.
        </p>
      )}
    </div>
  );
}
