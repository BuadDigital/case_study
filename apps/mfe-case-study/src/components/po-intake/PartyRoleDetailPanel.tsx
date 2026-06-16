"use client";

import {
  EmptyState,
  FieldBox,
  FieldsGrid,
  SectionDivider,
  SectionHeader,
} from "./PropertyDetailFields";
import type { PropertyDetailPartySubmission } from "../../lib/prototype/property-detail-party-submissions";
import type { PropertyDetailPartyCard } from "../../lib/prototype/property-detail-parties";
import { cn } from "@platform/design-system";

export function PartyRoleDetailPanel({
  card,
  submission,
  loading,
}: {
  card: PropertyDetailPartyCard;
  submission: PropertyDetailPartySubmission | null;
  loading: boolean;
}) {
  return (
    <div
      className="mt-4 rounded-[var(--radius-DEFAULT)] border border-border bg-surface p-4"
      role="region"
      aria-label={`بيانات ${card.role}`}
    >
      <SectionHeader>
        بيانات {card.role}
        {card.name && !card.unassigned ? (
          <span className="text-xs font-normal text-text-2"> — {card.name}</span>
        ) : null}
      </SectionHeader>

      {loading ? (
        <p className="m-0 text-xs text-text-3">جاري التحميل…</p>
      ) : !submission || !submission.hasData ? (
        <EmptyState
          icon="📋"
          title={submission?.emptyReason ?? "لم يُقدَّم بعد"}
          sub={
            card.unassigned
              ? "لم يُعيَّن طرف لهذا الدور بعد."
              : "سيظهر هنا ما يقدّمه الطرف عند إكمال عمله."
          }
        />
      ) : (
        <>
          {submission.fields.length > 0 ? (
            <FieldsGrid>
              {submission.fields.map((field) => (
                <FieldBox
                  key={field.label}
                  label={field.label}
                  value={field.value}
                  ltr={field.ltr}
                />
              ))}
            </FieldsGrid>
          ) : null}

          {submission.remarks.length > 0 ? (
            <>
              <SectionDivider />
              <SectionHeader>ملاحظات</SectionHeader>
              <FieldsGrid cols={2}>
                {submission.remarks.map((remark) => (
                  <FieldBox
                    key={remark.label}
                    label={remark.label}
                    value={remark.value}
                    span={2}
                  />
                ))}
              </FieldsGrid>
            </>
          ) : null}

          {submission.answers.length > 0 ? (
            <>
              <SectionDivider />
              <SectionHeader>الإجابات المقدّمة</SectionHeader>
              <div className="flex flex-col gap-0 overflow-hidden rounded-[var(--radius-DEFAULT)] border border-border">
                {submission.answers.map((row, index) => (
                  <div
                    key={`${row.question}-${index}`}
                    className={cn(
                      "grid grid-cols-[1fr_auto] items-start gap-3 border-b border-border bg-surface-2 px-3 py-2.5 last:border-b-0",
                    )}
                  >
                    <div className="text-xs leading-snug text-text">
                      {row.question}
                    </div>
                    <div className="whitespace-nowrap text-xs font-medium text-success-text">
                      {row.answer}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
