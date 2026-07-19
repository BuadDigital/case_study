"use client";

import { Note } from "@platform/design-system";
import { AppModal } from "../ui/AppModal";
import { InternalDelegationLetterPanel } from "./InternalDelegationLetterPanel";
import { useGovernmentReviewDelegationLetters } from "./use-government-review-delegation-letters";
import type { DelegationAgentInfo } from "../../lib/prototype/internal-delegation-letters";
import {
  formatPoDisplay,
  showsCourtFields,
  type PoIntakeRecord,
} from "../../lib/prototype/po-intake-data";

type Props = {
  open: boolean;
  records: PoIntakeRecord[];
  scopeKey: string;
  agent: DelegationAgentInfo;
  focusPoNumber?: string | null;
  onClose: () => void;
};

export function InternalDelegationLettersModal({
  open,
  records,
  scopeKey,
  agent,
  focusPoNumber,
  onClose,
}: Props) {
  const { letters, refreshLetters } = useGovernmentReviewDelegationLetters(
    records,
    scopeKey,
    focusPoNumber,
  );

  const focusRecord = focusPoNumber
    ? records.find((r) => r.poNumber.trim() === focusPoNumber.trim())
    : null;
  const supportsCourts = focusRecord
    ? showsCourtFields(focusRecord.assignmentType)
    : records.some((r) => showsCourtFields(r.assignmentType));

  return (
    <AppModal
      open={open}
      wide
      title={
        focusPoNumber
          ? `خطاب التفويض الداخلي — ${formatPoDisplay(focusPoNumber)}`
          : "خطاب التفويض الداخلي"
      }
      onClose={onClose}
    >
      {!scopeKey ? (
        <Note tone="warn">تعذّر تحديد نطاق المراجع.</Note>
      ) : !supportsCourts ? (
        <Note tone="info">
          نوع الإسناد الحالي لا يتطلّب محاكم — لا يوجد خطاب تفويض داخلي لهذا
          الأمر.
        </Note>
      ) : letters.length === 0 ? (
        <Note tone="info">
          لا توجد محاكم/دوائر مسجّلة على عقارات هذا النطاق بعد. أكمل بيانات
          المحكمة والدائرة أولاً.
        </Note>
      ) : (
        <div className="flex flex-col gap-3">
          <Note tone="info" className="text-[11px]">
            يُجمَّع الخطاب حسب المحكمة + الدائرة، وقد يضم أوامر عمل متعددة لنفس
            الدائرة.
          </Note>
          {letters.map((letter) => (
            <InternalDelegationLetterPanel
              key={letter.id}
              letter={letter}
              records={records}
              scopeKey={scopeKey}
              agent={agent}
              onRefresh={refreshLetters}
            />
          ))}
        </div>
      )}
    </AppModal>
  );
}
