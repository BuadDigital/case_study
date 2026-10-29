"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppModal, Button, Note, PanelSkeleton, useToast } from "@platform/ui-kit";
import {
  previewTransactionCancellation,
  requestTransactionCancellation,
  type TransactionCancellationDeedDto,
  type TransactionCancellationReason,
} from "@platform/api-client";
import {
  mutationFromApiResult,
  requireWorkOrdersApiConfig,
  unwrapApiResult,
} from "@platform/app-shared/app-data/work-orders-api-config";
import { FailureChoiceCards, type FailureChoice } from "@failures/mfe/components/failures/FailureChoiceCards";
import { failuresFieldTextareaClass } from "@failures/mfe/views/FailuresViewResolveForm";
import { invalidateAfterTransactionCancellation } from "../../query/use-transaction-cancellation-query";

const REASONS: FailureChoice<TransactionCancellationReason>[] = [
  { value: "duplicate", label: "معاملة مكررة", hint: "أُدخلت المعاملة نفسها مرتين" },
  { value: "wrong_entry", label: "إدخال خاطئ", hint: "أُدخلت بيانات لا تخص هذا الإسناد" },
  { value: "other", label: "أخرى", hint: "اذكر السبب في الملاحظة" },
];

export type TransactionCancelScope = { propertyId: string } | { poNumber: string };

/**
 * «إلغاء المعاملة» dialog — one transaction (from the property ⋮ menu) or every live transaction of
 * a work order (from the work-order ⋮ menu). The case specialist sends a request the supervisor
 * decides; the supervisor's own request cancels at once (`decides`).
 *
 * How it works: on open it previews what would be cancelled — the deeds (a linked deed in another
 * work order is listed with its order) and the deeds left out with their reason — then posts the
 * reason and the note. The toast says whether the transaction was cancelled or the request is
 * waiting for the supervisor; every app-data query is refreshed.
 *
 * Edge cases: nothing cancellable → the confirm stays disabled and the preview says why; a server
 * refusal (a deed handed over meanwhile, a request already pending) keeps the dialog open with the
 * Arabic message. Closing is blocked while the request is in flight. A transaction stopped by Enfaz
 * is a failure, not a cancellation — the note under the reasons says so.
 */
export function TransactionCancelDialog({
  scope,
  label,
  decides,
  onClose,
}: {
  scope: TransactionCancelScope;
  /** Shown in the title — the transaction (or work-order) number. */
  label: string;
  /** The viewer approves at once (supervisor / CDO). */
  decides: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [reason, setReason] = useState<TransactionCancellationReason>("duplicate");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const isOrder = "poNumber" in scope;

  const preview = useQuery({
    queryKey: ["transaction-cancellation-preview", isOrder ? scope.poNumber : scope.propertyId],
    queryFn: async () =>
      unwrapApiResult(
        await previewTransactionCancellation(requireWorkOrdersApiConfig(), scope),
        "تعذّر تحميل المعاملات",
      ),
    staleTime: 0,
  });
  const deeds = preview.data?.deeds ?? [];
  const excluded = preview.data?.excluded ?? [];
  const canSubmit = deeds.length > 0 && note.trim().length > 0 && !saving;

  const noun = isOrder ? "أمر العمل" : "المعاملة";
  const title = `${decides ? "إلغاء" : "طلب إلغاء"} ${noun} — ${label}`;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const result = mutationFromApiResult(
        await requestTransactionCancellation(requireWorkOrdersApiConfig(), {
          ...scope,
          reasonCode: reason,
          note: note.trim(),
        }),
        "تعذّر إرسال طلب الإلغاء",
      );
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      await invalidateAfterTransactionCancellation(queryClient);
      showToast(
        result.data.status === "approved"
          ? `أُلغيت ${result.data.deeds.length > 1 ? "صكوك المعاملة" : "المعاملة"} وأُخطر أصحاب المهام`
          : "أُرسل طلب الإلغاء إلى المشرف",
        "success",
      );
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppModal
      open
      title={title}
      wide
      onClose={() => {
        if (!saving) onClose();
      }}
      footer={
        <>
          <Button type="button" disabled={saving} onClick={onClose}>
            تراجع
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={saving}
            disabled={!canSubmit}
            showActionToast={false}
            onClick={() => void submit()}
          >
            {decides ? `إلغاء ${noun}` : "إرسال الطلب للمشرف"}
          </Button>
        </>
      }
    >
      <Note tone="warn" className="mb-3">
        {decides
          ? "تُلغى مهام الصكوك غير المكتملة وتختفي من صفوف الجميع، ويبقى المكتمل كما هو ويُستحق. يمكن إعادة التفعيل لاحقاً."
          : "يصل الطلب إلى المشرف؛ لا يتغيّر شيء حتى يعتمده."}{" "}
        المعاملة التي أوقفتها إنفاذ تُسجَّل تعذّراً لا إلغاءً.
      </Note>

      {preview.isPending ? (
        <PanelSkeleton />
      ) : preview.isError ? (
        <Note tone="danger" className="mb-3">
          {preview.error instanceof Error ? preview.error.message : "تعذّر تحميل المعاملات"}
        </Note>
      ) : (
        <>
          <DeedList title={`سيُلغى (${deeds.length})`} deeds={deeds} empty="لا توجد معاملة قابلة للإلغاء" />
          {excluded.length > 0 ? (
            <DeedList title={`لن يُلغى (${excluded.length})`} deeds={excluded} muted />
          ) : null}
        </>
      )}

      <FailureChoiceCards
        id={`cancel-reason-${label}`}
        label="سبب الإلغاء"
        options={REASONS}
        value={reason}
        onChange={setReason}
        disabled={saving}
      />

      <label
        htmlFor={`cancel-note-${label}`}
        className="mb-[7px] block text-[12px] font-semibold text-text-2"
      >
        ملاحظة{" "}
        <span className="font-bold text-danger-text" aria-hidden>
          *
        </span>
      </label>
      <textarea
        id={`cancel-note-${label}`}
        className={failuresFieldTextareaClass}
        rows={3}
        maxLength={2000}
        placeholder="مثال: المعاملة مكررة مع الصك 4213 في أمر العمل PO-1"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
    </AppModal>
  );
}

/**
 * The deeds a cancellation covers or leaves out: work order, deed and transaction, and the reason a
 * deed is left out. Edge cases: an empty list prints `empty` instead of a blank box.
 */
function DeedList({
  title,
  deeds,
  empty,
  muted = false,
}: {
  title: string;
  deeds: TransactionCancellationDeedDto[];
  empty?: string;
  muted?: boolean;
}) {
  return (
    <div className="mb-3">
      <p className="m-0 mb-1.5 text-[12px] font-semibold text-text-2">{title}</p>
      {deeds.length === 0 ? (
        <p className="m-0 text-[12px] text-text-3">{empty}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {deeds.map((deed) => (
            <li
              key={deed.propertyId}
              className={
                muted
                  ? "rounded-[var(--radius-DEFAULT)] bg-surface-2 px-2.5 py-1.5 text-[12px] text-text-3"
                  : "rounded-[var(--radius-DEFAULT)] border border-border-md px-2.5 py-1.5 text-[12px] text-text"
              }
            >
              <span className="font-semibold">صك {deed.deedNumber}</span>
              <span className="text-text-3"> · {deed.poNumber}</span>
              {deed.transactionNumber ? <span className="text-text-3"> · {deed.transactionNumber}</span> : null}
              {deed.blockedReason ? <span className="block text-[11.5px]">{deed.blockedReason}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
