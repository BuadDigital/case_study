"use client";

import { InlineLoadingSkeleton } from "@platform/ui-kit";
import { EmptyState } from "./PropertyDetailFields";
import {
  EngineeringPartyNotesSection,
  type PartyNoteRow,
} from "../fees/EngineeringPartyNotesSection";

type PartyRemarksSection = {
  id: string;
  title: string;
  remarks: PartyNoteRow[];
};

/**
 * Read-only notes board: what the intake wrote on the work order, the case
 * specialist's remarks, and the engineering office, field inspector and
 * appraiser remarks (no compose / chat UI).
 */
export function PropertyDetailSurveyNotesTab({
  sections,
  loading,
}: {
  sections: PartyRemarksSection[];
  loading: boolean;
  /** @deprecated unused — remarks are read-only from party submissions */
  remarks?: PartyNoteRow[];
  poNumber?: string;
  propertyId?: string;
  authorName?: string;
}) {
  if (loading) {
    return <InlineLoadingSkeleton />;
  }

  const filled = sections
    .map((section) => ({
      ...section,
      remarks: section.remarks.filter((row) => row.value.trim()),
    }))
    .filter((section) => section.remarks.length > 0);

  if (filled.length === 0) {
    return (
      <EmptyState
        title="لا توجد ملاحظات بعد"
        sub="تظهر هنا ملاحظات أمر العمل من البيانات الأولية، وملاحظات أخصائي دراسة الحالة والمكتب الهندسي والمعاين الميداني والمقيّم العقاري عند كتابتها."
      />
    );
  }

  return (
    <div className="grid gap-4">
      <p className="m-0 text-[12px] leading-relaxed text-text-3">
        عرض فقط — ملاحظات أمر العمل وملاحظات الأطراف المعيّنين على المعاملة
        (بدون إمكانية الرد أو الإنشاء من هنا).
      </p>
      {filled.map((section) => (
        <EngineeringPartyNotesSection
          key={section.id}
          title={section.title}
          remarks={section.remarks}
        />
      ))}
    </div>
  );
}

/**
 * Build ordered sections for the notes tab: the work-order description typed on the
 * intake screen first, then the specialist, then the three executing parties.
 */
export function buildPartyRemarksSections(input: {
  /** «ملاحظات أو وصف عام لأمر العمل» from البيانات الأولية. */
  workOrderDescription?: string | null;
  specialist?: { remarks?: PartyNoteRow[] } | null;
  survey?: { remarks?: PartyNoteRow[] } | null;
  inspection?: { remarks?: PartyNoteRow[] } | null;
  appraisal?: { remarks?: PartyNoteRow[] } | null;
}): PartyRemarksSection[] {
  const description = input.workOrderDescription?.trim() ?? "";
  return [
    {
      id: "intake",
      title: "ملاحظات أمر العمل (البيانات الأولية)",
      remarks: description ? [{ label: "وصف أمر العمل", value: description }] : [],
    },
    {
      id: "specialist",
      title: "ملاحظات أخصائي دراسة الحالة",
      remarks: input.specialist?.remarks ?? [],
    },
    {
      id: "survey",
      title: "ملاحظات المكتب الهندسي",
      remarks: input.survey?.remarks ?? [],
    },
    {
      id: "inspection",
      title: "ملاحظات المعاين الميداني",
      remarks: input.inspection?.remarks ?? [],
    },
    {
      id: "appraisal",
      title: "ملاحظات المقيّم العقاري",
      remarks: input.appraisal?.remarks ?? [],
    },
  ];
}
