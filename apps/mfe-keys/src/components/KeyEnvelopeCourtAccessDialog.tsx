"use client";

/**
 * Court-access editor for one linked property — the «لا يوجد / تمكين / محظر
 * إخلاء» tiles, the two attachment pickers, contact phones and notes. Draft
 * transitions and the request body come from `key-envelope-dialogs-state`.
 */
import { useRef, useState } from "react";
import {
  Button,
  Input,
  Label,
  ModalBody,
  ModalCard,
  ModalFooter,
  ModalOverlay,
  StatusPill,
  cn,
  useToast,
} from "@platform/ui-kit";
import { savePropertyCourtAccess } from "../lib/keys-envelope-api";
import {
  studyHoldLabel,
  type KeyEnvelopeLinkedProperty,
  type PropertyCourtAccessRow,
} from "../lib/keys-envelope-types";
import {
  COURT_ACCESS_OPTIONS,
  courtAccessOptionActive,
  courtAccessPreviewStatus,
  studyHoldColor,
} from "./key-envelope-detail-state";
import {
  applyCourtAccessOption,
  attachmentTileTitle,
  buildCourtAccessBody,
  courtAccessAttachmentRemoved,
  courtAccessAttachmentUploaded,
  courtAccessSavedMessage,
  initialCourtAccessDraft,
} from "./key-envelope-dialogs-state";
import {
  DialogAttachmentPicker,
  DialogErrorBanner,
  DialogHeader,
  SaveCheckIcon,
} from "./KeyEnvelopeDialogShared";

export function CourtAccessModal({
  property,
  current,
  onClose,
  onSaved,
}: {
  property: KeyEnvelopeLinkedProperty;
  current?: PropertyCourtAccessRow;
  onClose: () => void;
  onSaved: (row: PropertyCourtAccessRow) => void;
}) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [draft, setDraft] = useState(() => initialCourtAccessDraft(current));

  const enablingFileRef = useRef<HTMLInputElement>(null);
  const evictionFileRef = useRef<HTMLInputElement>(null);

  const previewStatus = courtAccessPreviewStatus(
    draft.hasEnablingLetter,
    draft.hasEvictionNotice,
  );
  const previewColor = studyHoldColor(previewStatus);

  return (
    <ModalOverlay onClick={onClose}>
      <ModalCard
        onClick={(e) => e.stopPropagation()}
        className="max-w-[560px] p-0 max-lg:max-h-[min(92dvh,100%)]"
      >
        <DialogHeader
          title={<>التمكين / محظر الإخلاء — صك {property.deedNumber}</>}
          onClose={onClose}
        />
        <ModalBody className="max-h-[min(70vh,560px)] space-y-3.5 overflow-y-auto px-5 py-5 max-lg:max-h-none">
          <DialogErrorBanner error={err} />

          <div className="flex items-center justify-between rounded-[10px] border border-border bg-surface-2/50 px-3.5 py-2.5">
            <span className="text-[12.5px] font-semibold text-text-2">
              الحالة الحالية
            </span>
            <StatusPill
              label={studyHoldLabel(previewStatus)}
              style={{ base: previewColor, fg: previewColor }}
            />
          </div>

          <div>
            <Label>مسار الدخول</Label>
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {COURT_ACCESS_OPTIONS.map((opt) => {
                const active = courtAccessOptionActive(
                  opt.id,
                  draft.hasEnablingLetter,
                  draft.hasEvictionNotice,
                );
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={cn(
                      "min-h-[40px] rounded-[10px] border text-[12.5px] font-extrabold transition-colors",
                      active
                        ? "border-gold bg-gold-soft text-gold-d"
                        : "border-border bg-surface text-text-2 hover:bg-row-hover",
                    )}
                    onClick={() => {
                      const next = applyCourtAccessOption(opt.id, draft);
                      setDraft(next.draft);
                      if (next.pickFile === "enabling") {
                        enablingFileRef.current?.click();
                      } else if (next.pickFile === "eviction") {
                        evictionFileRef.current?.click();
                      }
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11.5px] text-text-3">
              «لا يوجد» يلغي التمكين ومحظر الإخلاء ويرفع تعليق الدراسة إن وُجد.
            </p>
          </div>

          <div>
            <Label>خطاب التمكين (بدون مفتاح)</Label>
            <DialogAttachmentPicker
              inputRef={enablingFileRef}
              kind="enabling"
              scopeKey={property.propertyId}
              tone="gold"
              active={Boolean(draft.enablingLetterId)}
              title={attachmentTileTitle(
                draft.enablingLetterName,
                current?.enablingLetterAttachmentId,
                {
                  replace: "استبدال خطاب التمكين المرفق",
                  upload: "رفع خطاب التمكين",
                },
              )}
              hint="إثبات السماح بدخول العقار دون تسليم مفتاح"
              onUploaded={(id, fileName) =>
                setDraft((prev) =>
                  courtAccessAttachmentUploaded(prev, "enabling", id, fileName),
                )
              }
            />
            {draft.hasEnablingLetter || draft.enablingLetterId ? (
              <button
                type="button"
                className="mt-1.5 text-[12px] font-semibold text-[#a32d2d] hover:underline"
                onClick={() =>
                  setDraft((prev) =>
                    courtAccessAttachmentRemoved(prev, "enabling"),
                  )
                }
              >
                إزالة خطاب التمكين
              </button>
            ) : null}
          </div>

          <div>
            <Label>محظر الإخلاء (تعليق الدراسة)</Label>
            <DialogAttachmentPicker
              inputRef={evictionFileRef}
              kind="eviction"
              scopeKey={property.propertyId}
              tone="red"
              active={Boolean(draft.evictionNoticeId)}
              title={attachmentTileTitle(
                draft.evictionNoticeName,
                current?.evictionNoticeAttachmentId,
                {
                  replace: "استبدال محضر الإخلاء المرفق",
                  upload: "رفع محظر الإخلاء",
                },
              )}
              hint="يعلّق الدراسة تلقائياً حتى رفع محظر الإخلاء"
              onUploaded={(id, fileName) =>
                setDraft((prev) =>
                  courtAccessAttachmentUploaded(prev, "eviction", id, fileName),
                )
              }
            />
            {draft.hasEvictionNotice || draft.evictionNoticeId ? (
              <button
                type="button"
                className="mt-1.5 text-[12px] font-semibold text-[#a32d2d] hover:underline"
                onClick={() =>
                  setDraft((prev) =>
                    courtAccessAttachmentRemoved(prev, "eviction"),
                  )
                }
              >
                إزالة محظر الإخلاء
              </button>
            ) : null}
          </div>

          <div>
            <Label htmlFor="ca-phones">أرقام تواصل (اختياري)</Label>
            <Input
              id="ca-phones"
              dir="ltr"
              placeholder="05xxxxxxxx"
              value={draft.contactPhones}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, contactPhones: e.target.value }))
              }
            />
          </div>

          <div>
            <Label htmlFor="ca-notes">ملاحظات (اختياري)</Label>
            <Input
              id="ca-notes"
              value={draft.notes}
              placeholder="ملاحظات إضافية عن مسار الدخول"
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, notes: e.target.value }))
              }
            />
          </div>
        </ModalBody>
        <ModalFooter className="justify-start gap-2 border-t border-border px-5 py-3.5">
          <Button
            variant="outline"
            disabled={busy}
            showActionToast={false}
            onClick={onClose}
          >
            إلغاء
          </Button>
          <Button
            variant="primary"
            loading={busy}
            showActionToast={false}
            onClick={async () => {
              setErr("");
              setBusy(true);
              const result = await savePropertyCourtAccess(
                buildCourtAccessBody(property.propertyId, draft, current),
              );
              setBusy(false);
              if (!result.ok) {
                setErr(result.error);
                return;
              }
              showToast(courtAccessSavedMessage(property.deedNumber), "success");
              onSaved(result.data);
            }}
          >
            <SaveCheckIcon />
            حفظ
          </Button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}
