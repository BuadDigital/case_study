"use client";

import { Note } from "@platform/design-system";
import { AppModal } from "../ui/AppModal";
import { InternalDelegationLetterPanel } from "./InternalDelegationLetterPanel";
import { useGovernmentReviewDelegationLetters } from "./use-government-review-delegation-letters";
import { formatPoDisplay, type PoIntakeRecord } from "../../lib/prototype/po-intake-data";
import { showsCourtFields } from "../../lib/prototype/po-intake-data";

type Props = {
  open: boolean;
  record: PoIntakeRecord | null;
  onClose: () => void;
};

export function InternalDelegationLettersModal({
  open,
  record,
  onClose,
}: Props) {
  const { letters, refreshLetters } = useGovernmentReviewDelegationLetters(
    record ?? undefined,
  );
  const supportsCourts = record
    ? showsCourtFields(record.assignmentType)
    : false;

  return (
    <AppModal
      open={open}
      wide
      title={
        record
          ? `خطاب التفويض الداخلي — ${formatPoDisplay(record.poNumber)}`
          : "خطاب التفويض الداخلي"
      }
      onClose={onClose}
    >
      {!record ? (
        <Note tone="warn">تعذّر تحميل أمر العمل.</Note>
      ) : !supportsCourts ? (
        <Note tone="info">
          نوع الإسناد الحالي لا يتطلّب محاكم — لا يوجد خطاب تفويض داخلي لهذا الأمر.
        </Note>
      ) : letters.length === 0 ? (
        <Note tone="info">
          لا توجد محاكم مسجّلة على عقارات هذا الأمر بعد. أكمل بيانات المحكمة أولاً.
        </Note>
      ) : (
        <div className="flex flex-col gap-3">
          {letters.map((letter) => (
            <InternalDelegationLetterPanel
              key={letter.id}
              letter={letter}
              record={record}
              onRefresh={refreshLetters}
            />
          ))}
        </div>
      )}
    </AppModal>
  );
}
